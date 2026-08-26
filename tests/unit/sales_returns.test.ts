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
  SqliteStockMovementRepository,
  SqliteSaleRepository,
  SqliteSaleReturnRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { PharmacyBillingService } from '@medidesk/application';
import { SessionUser, RoleName, AuditAction } from '@medidesk/domain';

describe('Sales Returns & Inventory Restoration Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let billingService: PharmacyBillingService;
  let saleRepo: SqliteSaleRepository;
  let returnRepo: SqliteSaleReturnRepository;
  let batchRepo: SqliteInventoryBatchRepository;
  let movRepo: SqliteStockMovementRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let medRepo: SqliteMedicineRepository;
  let auditRepo: SqliteAuditRepository;

  const orgId = 'org-test-pharmacy-6';

  const ownerUser: SessionUser = {
    id: 'user-owner-6',
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
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-returns-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TC6')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    saleRepo = new SqliteSaleRepository(db);
    returnRepo = new SqliteSaleReturnRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movRepo = new SqliteStockMovementRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    medRepo = new SqliteMedicineRepository(db);
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

  it('should process customer return, restore batch inventory, and record SALE_RETURN movement', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Diclofenac',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Voveran 50',
      strength: '50mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      taxRatePercent: 12
    });

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'VOV-100',
      expiryDate: '2028-04-30',
      purchasePricePerUnit: 2,
      mrpPerUnit: 5,
      salePricePerUnit: 4.5,
      initialStockQuantity: 50
    });

    // 1. Initial Sale of 10 units -> Stock becomes 40
    const sale = await billingService.createSale({
      organizationId: orgId,
      customerType: 'WALK_IN',
      customerName: 'Customer Returned Item',
      paymentMode: 'CASH',
      items: [
        {
          productId: product.id,
          batchId: batch.id,
          quantity: 10,
          unitSalePrice: 4.5
        }
      ]
    }, ownerUser);

    expect(sale.items.length).toBe(1);
    const saleItemId = sale.items[0].id;

    const batchAfterSale = await batchRepo.findById(batch.id, orgId);
    expect(batchAfterSale?.currentStockQuantity).toBe(40);

    // 2. Customer returns 4 units
    const returnRecord = await billingService.createSaleReturn({
      organizationId: orgId,
      saleId: sale.id,
      reason: 'Patient changed prescription by doctor',
      refundMode: 'CASH',
      items: [
        {
          saleItemId,
          quantity: 4
        }
      ]
    }, ownerUser);

    expect(returnRecord.id).toBeDefined();
    expect(returnRecord.returnNumber).toContain('RET-');
    expect(returnRecord.items.length).toBe(1);
    expect(returnRecord.items[0].quantity).toBe(4);

    // 3. Verify stock restored from 40 to 44
    const batchAfterReturn = await batchRepo.findById(batch.id, orgId);
    expect(batchAfterReturn?.currentStockQuantity).toBe(44);

    // 4. Verify Stock Movement
    const movements = await movRepo.findByBatch(batch.id, orgId);
    const returnMovement = movements.find((m) => m.movementType === 'SALE_RETURN');
    expect(returnMovement).toBeDefined();
    expect(returnMovement?.quantityChange).toBe(4);
    expect(returnMovement?.balanceAfter).toBe(44);

    // 5. Verify Audit Log
    const audits = await auditRepo.listRecent(10);
    expect(audits.some((a) => a.action === AuditAction.SALE_RETURN_CREATED)).toBe(true);
  });
});
