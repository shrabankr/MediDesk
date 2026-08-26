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
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { PharmacyBillingService } from '@medidesk/application';
import { SessionUser, RoleName } from '@medidesk/domain';

describe('Phase 5: Financial Money Calculations & Tax Round-off Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let billingService: PharmacyBillingService;
  let batchRepo: SqliteInventoryBatchRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let medRepo: SqliteMedicineRepository;

  const orgId = 'org-test-money';

  const ownerUser: SessionUser = {
    id: 'user-owner-money',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'owner_money',
    email: 'owner@clinic.com',
    fullName: 'Owner Money',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-money-test-'));
    const testDbPath = path.join(testDir, 'money.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TCM')`).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    medRepo = new SqliteMedicineRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    const saleRepo = new SqliteSaleRepository(db);
    const auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    billingService = new PharmacyBillingService(saleRepo, undefined, batchRepo, prodRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('calculates deterministic GST, discount, and cash round-off for fractional decimal amounts', async () => {
    const generic = await medRepo.create({ organizationId: orgId, genericName: 'Cefixime' });
    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Taxim O 200',
      strength: '200mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      taxRatePercent: 18.0 // 18% GST slab
    });

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'TAX-01',
      expiryDate: '2028-06-30',
      purchasePricePerUnit: 8.5,
      mrpPerUnit: 15.5,
      salePricePerUnit: 14.75, // Fractional unit price
      initialStockQuantity: 100
    });

    // 7 units * 14.75 = 103.25 Gross
    // Discount = 5.00 -> Taxable = 98.25
    // Tax 18% of 98.25 = 17.685
    // Subtotal = 103.25 + 17.685 - 5.00 = 115.935
    // Round-off to integer rupee: round(115.935) = 116 (round-off = +0.065)
    const sale = await billingService.createSale({
      organizationId: orgId,
      customerType: 'WALK_IN',
      customerName: 'Fractional Buyer',
      paymentMode: 'CASH',
      discountAmount: 5.00,
      items: [
        {
          productId: product.id,
          batchId: batch.id,
          quantity: 7,
          unitSalePrice: 14.75
        }
      ]
    }, ownerUser);

    expect(sale.grossAmount).toBeCloseTo(103.25, 2);
    expect(sale.taxAmount).toBeCloseTo(18.585, 3);
    expect(sale.netAmount).toBe(117);
  });
});
