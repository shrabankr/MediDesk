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
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { InventoryService } from '@medidesk/application';
import { SessionUser, RoleName } from '@medidesk/domain';

describe('Inventory & FEFO Allocation Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let invService: InventoryService;
  let batchRepo: SqliteInventoryBatchRepository;
  let movRepo: SqliteStockMovementRepository;
  let medRepo: SqliteMedicineRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let auditRepo: SqliteAuditRepository;

  const orgId = 'org-test-pharmacy-3';

  const ownerUser: SessionUser = {
    id: 'user-owner-3',
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
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-fefo-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TC3')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    batchRepo = new SqliteInventoryBatchRepository(db);
    movRepo = new SqliteStockMovementRepository(db);
    medRepo = new SqliteMedicineRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    invService = new InventoryService(batchRepo, movRepo, prodRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should allocate batches strictly by First Expire First Out (FEFO)', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Azithromycin',
      scheduleCategory: 'H'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Azee 500',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '5 Tablets / Strip',
      packQuantity: 5
    });

    // Batch 1: Expiring in 2027-06 (15 units)
    await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'AZ-2027-06',
      expiryDate: '2027-06-30',
      purchasePricePerUnit: 15,
      mrpPerUnit: 25,
      salePricePerUnit: 24,
      initialStockQuantity: 15
    });

    // Batch 2: Expiring in 2026-11 (10 units) -> Earliest!
    await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'AZ-2026-11',
      expiryDate: '2026-11-30',
      purchasePricePerUnit: 14,
      mrpPerUnit: 25,
      salePricePerUnit: 24,
      initialStockQuantity: 10
    });

    // Batch 3: Expiring in 2028-12 (20 units)
    await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'AZ-2028-12',
      expiryDate: '2028-12-31',
      purchasePricePerUnit: 16,
      mrpPerUnit: 25,
      salePricePerUnit: 24,
      initialStockQuantity: 20
    });

    // Request 18 units -> Should take 10 from AZ-2026-11, then 8 from AZ-2027-06
    const result = await invService.allocateFefoStock({
      organizationId: orgId,
      productId: product.id,
      requestedQuantity: 18
    }, ownerUser);

    expect(result.isFullyAllocated).toBe(true);
    expect(result.allocatedQuantity).toBe(18);
    expect(result.allocations.length).toBe(2);

    expect(result.allocations[0].batchNumber).toBe('AZ-2026-11');
    expect(result.allocations[0].allocatedQuantity).toBe(10);

    expect(result.allocations[1].batchNumber).toBe('AZ-2027-06');
    expect(result.allocations[1].allocatedQuantity).toBe(8);
  });

  it('should exclude expired batches from FEFO allocation', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Pantoprazole',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Pan 40',
      strength: '40mg',
      dosageForm: 'TABLET',
      packSize: '15 Tablets / Strip',
      packQuantity: 15
    });

    // Expired Batch in the past (2025-01-01)
    await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'PAN-EXPIRED',
      expiryDate: '2025-01-01',
      purchasePricePerUnit: 5,
      mrpPerUnit: 10,
      salePricePerUnit: 9,
      initialStockQuantity: 50
    });

    // Valid Batch (2027-05-01)
    await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'PAN-VALID',
      expiryDate: '2027-05-01',
      purchasePricePerUnit: 6,
      mrpPerUnit: 10,
      salePricePerUnit: 9,
      initialStockQuantity: 10
    });

    // Request 15 units -> Cannot take from expired, only 10 available from valid
    const result = await invService.allocateFefoStock({
      organizationId: orgId,
      productId: product.id,
      requestedQuantity: 15
    }, ownerUser);

    expect(result.isFullyAllocated).toBe(false);
    expect(result.allocatedQuantity).toBe(10);
    expect(result.allocations.length).toBe(1);
    expect(result.allocations[0].batchNumber).toBe('PAN-VALID');
  });

  it('should report low stock alerts when total stock <= minStockLevel', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Metformin',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Glycomet 500',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '20 Tablets / Strip',
      packQuantity: 20,
      minStockLevel: 50 // Threshold = 50 units
    });

    // Stock only 30 units (below 50)
    await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'GLY-01',
      expiryDate: '2028-01-01',
      purchasePricePerUnit: 2,
      mrpPerUnit: 4,
      salePricePerUnit: 3.5,
      initialStockQuantity: 30
    });

    const lowStock = await invService.getLowStock(ownerUser);
    expect(lowStock.length).toBe(1);
    expect(lowStock[0].product.brandName).toBe('Glycomet 500');
    expect(lowStock[0].totalStock).toBe(30);
    expect(lowStock[0].minStock).toBe(50);
  });
});
