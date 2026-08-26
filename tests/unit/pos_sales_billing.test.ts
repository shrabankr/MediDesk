import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqliteInventoryBatchRepository,
  SqliteSaleRepository,
  SqliteSaleReturnRepository,
  SqlitePatientRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { PharmacyBillingService } from '@medidesk/application';
import {
  SessionUser,
  RoleName,
  InsufficientStockError,
  ExpiredBatchSaleError,
  AuditAction
} from '@medidesk/domain';

describe('Pharmacy POS Sales & Billing Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let billingService: PharmacyBillingService;
  let saleRepo: SqliteSaleRepository;
  let returnRepo: SqliteSaleReturnRepository;
  let batchRepo: SqliteInventoryBatchRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let medRepo: SqliteMedicineRepository;
  let patientRepo: SqlitePatientRepository;
  let auditRepo: SqliteAuditRepository;

  const orgId = 'org-test-pharmacy-5';

  const ownerUser: SessionUser = {
    id: 'user-owner-5',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'owner_user',
    email: 'owner@clinic.com',
    fullName: 'Owner Pharmacy',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-pos-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TC5')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    saleRepo = new SqliteSaleRepository(db);
    returnRepo = new SqliteSaleReturnRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    medRepo = new SqliteMedicineRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    billingService = new PharmacyBillingService(
      saleRepo,
      returnRepo,
      batchRepo,
      prodRepo,
      auditService,
      rbac
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should process a Walk-In customer sale without creating a patient entity', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Paracetamol',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Dolo 650',
      strength: '650mg',
      dosageForm: 'TABLET',
      packSize: '15 Tablets / Strip',
      packQuantity: 15,
      taxRatePercent: 12
    });

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'DL-991',
      expiryDate: '2028-06-30',
      purchasePricePerUnit: 1.5,
      mrpPerUnit: 2.2,
      salePricePerUnit: 2.0,
      initialStockQuantity: 100
    });

    // Walk-in customer buys 15 tablets
    const sale = await billingService.createSale({
      organizationId: orgId,
      customerType: 'WALK_IN',
      customerName: 'Anonymous Walk-in',
      customerPhone: '9988776655',
      paymentMode: 'CASH',
      discountAmount: 0,
      items: [
        {
          productId: product.id,
          batchId: batch.id,
          quantity: 15,
          unitSalePrice: 2.0
        }
      ]
    }, ownerUser);

    expect(sale.id).toBeDefined();
    expect(sale.billNumber).toContain('BILL-');
    expect(sale.customerType).toBe('WALK_IN');
    expect(sale.patientId).toBeUndefined();
    expect(sale.grossAmount).toBe(30.0); // 15 * 2.0
    expect(sale.taxAmount).toBe(3.6); // 30 * 12% = 3.6
    expect(sale.netAmount).toBe(34); // 30 + 3.6 = 33.6 -> Round to 34

    // Verify stock decreased from 100 to 85
    const updatedBatch = await batchRepo.findById(batch.id, orgId);
    expect(updatedBatch?.currentStockQuantity).toBe(85);

    // Verify patient database is completely empty (no spurious patient created)
    const allPatients = await patientRepo.search({ organizationId: orgId, query: 'Anonymous' });
    expect(allPatients.length).toBe(0);

    // Verify audit log
    const audits = await auditRepo.listRecent(10);
    expect(audits.some((a) => a.action === AuditAction.SALE_CREATED)).toBe(true);
  });

  it('should strictly deny sales if stock is insufficient (Available = 5, Sale = 6 -> DENY)', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Levocetirizine',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Levocet 5',
      strength: '5mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      taxRatePercent: 12
    });

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'LEV-55',
      expiryDate: '2028-01-01',
      purchasePricePerUnit: 2,
      mrpPerUnit: 4,
      salePricePerUnit: 3.8,
      initialStockQuantity: 5 // ONLY 5 AVAILABLE
    });

    // Attempt to sell 6 units
    await expect(
      billingService.createSale({
        organizationId: orgId,
        customerType: 'WALK_IN',
        customerName: 'Test Buyer',
        paymentMode: 'UPI',
        items: [
          {
            productId: product.id,
            batchId: batch.id,
            quantity: 6
          }
        ]
      }, ownerUser)
    ).rejects.toThrow(InsufficientStockError);

    // Verify stock remains untouched at 5
    const batchAfter = await batchRepo.findById(batch.id, orgId);
    expect(batchAfter?.currentStockQuantity).toBe(5);
  });

  it('should strictly deny selling expired batches at the application layer', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Ibuprofen',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Brufen 400',
      strength: '400mg',
      dosageForm: 'TABLET',
      packSize: '15 Tablets / Strip',
      packQuantity: 15
    });

    const expiredBatch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'BRU-EXPIRED',
      expiryDate: '2024-01-01', // In the past!
      purchasePricePerUnit: 1,
      mrpPerUnit: 3,
      salePricePerUnit: 2.5,
      initialStockQuantity: 20
    });

    await expect(
      billingService.createSale({
        organizationId: orgId,
        customerType: 'WALK_IN',
        customerName: 'Customer',
        paymentMode: 'CASH',
        items: [
          {
            productId: product.id,
            batchId: expiredBatch.id,
            quantity: 5
          }
        ]
      }, ownerUser)
    ).rejects.toThrow(ExpiredBatchSaleError);
  });
});
