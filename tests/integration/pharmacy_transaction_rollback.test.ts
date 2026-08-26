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
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { PharmacyBillingService } from '@medidesk/application';
import { SessionUser, RoleName, InsufficientStockError } from '@medidesk/domain';

describe('Pharmacy Transaction Rollback Integration Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let billingService: PharmacyBillingService;
  let batchRepo: SqliteInventoryBatchRepository;
  let movRepo: SqliteStockMovementRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let medRepo: SqliteMedicineRepository;

  const orgId = 'org-test-pharmacy-rollback';

  const ownerUser: SessionUser = {
    id: 'user-owner-rb',
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
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-rollback-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TCRB')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    const saleRepo = new SqliteSaleRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movRepo = new SqliteStockMovementRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    medRepo = new SqliteMedicineRepository(db);
    const auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    billingService = new PharmacyBillingService(
      saleRepo,
      undefined,
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

  it('should completely roll back all item deductions and movements if any line item fails in transaction', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Ciprofloxacin',
      scheduleCategory: 'H'
    });

    const product1 = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Cifran 500',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10
    });

    const product2 = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Ciplox 250',
      strength: '250mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10
    });

    // Batch 1 has plenty of stock (100 units)
    const batch1 = await batchRepo.create({
      organizationId: orgId,
      productId: product1.id,
      batchNumber: 'CIF-100',
      expiryDate: '2028-01-01',
      purchasePricePerUnit: 2,
      mrpPerUnit: 4,
      salePricePerUnit: 3.5,
      initialStockQuantity: 100
    });

    // Batch 2 has only 2 units
    const batch2 = await batchRepo.create({
      organizationId: orgId,
      productId: product2.id,
      batchNumber: 'CIP-2',
      expiryDate: '2028-01-01',
      purchasePricePerUnit: 1,
      mrpPerUnit: 2,
      salePricePerUnit: 1.8,
      initialStockQuantity: 2
    });

    // Multi-item sale: Item 1 takes 10 units from batch1 (would succeed), Item 2 takes 10 units from batch2 (fails due to insufficient stock)
    await expect(
      billingService.createSale({
        organizationId: orgId,
        customerType: 'WALK_IN',
        customerName: 'Rollback Buyer',
        paymentMode: 'CASH',
        items: [
          {
            productId: product1.id,
            batchId: batch1.id,
            quantity: 10
          },
          {
            productId: product2.id,
            batchId: batch2.id,
            quantity: 10 // FAIL!
          }
        ]
      }, ownerUser)
    ).rejects.toThrow(InsufficientStockError);

    // Assert batch1 stock was NOT deducted (must still be exactly 100)
    const batch1After = await batchRepo.findById(batch1.id, orgId);
    expect(batch1After?.currentStockQuantity).toBe(100);

    // Assert batch2 stock remains 2
    const batch2After = await batchRepo.findById(batch2.id, orgId);
    expect(batch2After?.currentStockQuantity).toBe(2);

    // Assert zero stock movements were persisted
    const movements = await movRepo.listRecent(orgId, 50);
    expect(movements.length).toBe(0);
  });
});
