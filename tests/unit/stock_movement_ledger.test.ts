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
import { SessionUser, RoleName, NegativeStockError, AuditAction } from '@medidesk/domain';

describe('Stock Movement Ledger & Negative Stock Invariant Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let invService: InventoryService;
  let batchRepo: SqliteInventoryBatchRepository;
  let movRepo: SqliteStockMovementRepository;
  let medRepo: SqliteMedicineRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let auditRepo: SqliteAuditRepository;

  const orgId = 'org-test-pharmacy-4';

  const ownerUser: SessionUser = {
    id: 'user-owner-4',
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
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-ledger-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TC4')
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

  it('should log audited stock movements upon manual adjustments', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Omeprazole',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Omez 20',
      strength: '20mg',
      dosageForm: 'CAPSULE',
      packSize: '15 Capsules / Strip',
      packQuantity: 15
    });

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'OMZ-01',
      expiryDate: '2027-10-31',
      purchasePricePerUnit: 3,
      mrpPerUnit: 6,
      salePricePerUnit: 5.5,
      initialStockQuantity: 50
    });

    // Adjust down from 50 to 45 (damaged 5 capsules)
    const updated = await invService.adjustStock({
      organizationId: orgId,
      batchId: batch.id,
      adjustedQuantity: 45,
      isDelta: false,
      movementType: 'DAMAGED_WRITE_OFF',
      reason: 'Physical damage to 5 capsules during shelf handling'
    }, ownerUser);

    expect(updated.currentStockQuantity).toBe(45);

    // Verify Stock Movement was created
    const movements = await movRepo.findByBatch(batch.id, orgId);
    expect(movements.length).toBe(1);
    expect(movements[0].movementType).toBe('DAMAGED_WRITE_OFF');
    expect(movements[0].quantityChange).toBe(-5);
    expect(movements[0].balanceAfter).toBe(45);

    // Verify Audit Event
    const audits = await auditRepo.listRecent(10);
    expect(audits.some((a) => a.action === AuditAction.STOCK_ADJUSTED)).toBe(true);
  });

  it('should reject adjustments that cause negative stock', async () => {
    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Ranitidine',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Rantac 150',
      strength: '150mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10
    });

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: product.id,
      batchNumber: 'RAN-01',
      expiryDate: '2027-10-31',
      purchasePricePerUnit: 1,
      mrpPerUnit: 2,
      salePricePerUnit: 1.8,
      initialStockQuantity: 5
    });

    // Try delta adjustment of -10 when only 5 exists
    await expect(
      invService.adjustStock({
        organizationId: orgId,
        batchId: batch.id,
        adjustedQuantity: -10,
        isDelta: true,
        reason: 'Incorrect count'
      }, ownerUser)
    ).rejects.toThrow(NegativeStockError);
  });
});
