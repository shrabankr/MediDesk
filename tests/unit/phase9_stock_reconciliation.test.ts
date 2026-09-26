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
  SqlitePackagingUnitRepository,
  SqliteStockReconciliationRepository,
  SqliteAuditRepository,
  SqliteOrganizationRepository,
  SqliteUserRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  StockReconciliationService,
  PackagingUnitService
} from '@medidesk/application';
import {
  SessionUser,
  RoleName,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';

describe('Phase 9A: Physical Inventory Reconciliation & Stock Audit Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let reconciliationService: StockReconciliationService;
  let packagingService: PackagingUnitService;
  let reconciliationRepo: SqliteStockReconciliationRepository;
  let batchRepo: SqliteInventoryBatchRepository;
  let movementRepo: SqliteStockMovementRepository;
  let productRepo: SqliteMedicineProductRepository;
  let medRepo: SqliteMedicineRepository;
  let packagingRepo: SqlitePackagingUnitRepository;
  let auditService: AuditService;
  let rbacEngine: RBACEngine;

  const orgId = 'org-p9-reconcile';
  const otherOrgId = 'org-other-clinic';

  const ownerUser: SessionUser = {
    id: 'user-owner-p9',
    organizationId: orgId,
    organizationName: 'City Care Clinic',
    username: 'dr_owner',
    email: 'owner@citycare.com',
    fullName: 'Dr. Owner',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const staffUser: SessionUser = {
    id: 'user-staff-p9',
    organizationId: orgId,
    organizationName: 'City Care Clinic',
    username: 'staff_pharmacy',
    email: 'staff@citycare.com',
    fullName: 'Staff Pharmacist',
    roles: [RoleName.STAFF],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const devUser: SessionUser = {
    id: 'user-dev-p9',
    organizationId: orgId,
    organizationName: 'City Care Clinic',
    username: 'dev_tech',
    email: 'dev@medidesk.internal',
    fullName: 'Technician Dev',
    roles: [RoleName.DEVELOPER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  let testProduct: any;
  let testBatch1: any;
  let testBatch2: any;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-p9a-test-'));
    const testDbPath = path.join(testDir, 'p9a.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    const auditRepo = new SqliteAuditRepository(db);
    auditService = new AuditService(auditRepo);
    rbacEngine = new RBACEngine();

    const orgRepo = new SqliteOrganizationRepository(db);
    await orgRepo.create({
      id: orgId,
      name: 'City Care Clinic',
      code: 'CCC',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
    await orgRepo.create({
      id: otherOrgId,
      name: 'Other Clinic',
      code: 'OTH',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });

    const userRepo = new SqliteUserRepository(db);
    await userRepo.create({
      id: ownerUser.id,
      organizationId: orgId,
      username: ownerUser.username,
      email: ownerUser.email,
      fullName: ownerUser.fullName,
      passwordHash: 'hash',
      roles: [RoleName.OWNER]
    });
    await userRepo.create({
      id: staffUser.id,
      organizationId: orgId,
      username: staffUser.username,
      email: staffUser.email,
      fullName: staffUser.fullName,
      passwordHash: 'hash',
      roles: [RoleName.STAFF]
    });

    medRepo = new SqliteMedicineRepository(db);
    productRepo = new SqliteMedicineProductRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movementRepo = new SqliteStockMovementRepository(db);
    packagingRepo = new SqlitePackagingUnitRepository(db);
    reconciliationRepo = new SqliteStockReconciliationRepository(db);

    packagingService = new PackagingUnitService(packagingRepo, productRepo, auditService);
    reconciliationService = new StockReconciliationService(
      reconciliationRepo,
      batchRepo,
      movementRepo,
      productRepo,
      packagingService,
      auditService,
      rbacEngine
    );

    // Setup base medicine and product
    const med = await medRepo.create({
      organizationId: orgId,
      genericName: 'Paracetamol',
      therapeuticClass: 'Analgesics'
    });

    testProduct = await productRepo.create({
      organizationId: orgId,
      medicineId: med.id,
      brandName: 'Calpol 500',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      unitOfMeasure: 'TABLET'
    });

    // Create Packaging Units: STRIP (10 tabs) and BOX (100 tabs)
    await packagingRepo.create({
      organizationId: orgId,
      productId: testProduct.id,
      unitName: 'STRIP',
      conversionFactor: 10,
      salePricePaise: 2000,
      mrpPaise: 2500,
      isDefaultSaleUnit: true
    });

    await packagingRepo.create({
      organizationId: orgId,
      productId: testProduct.id,
      unitName: 'BOX',
      conversionFactor: 100,
      salePricePaise: 18000,
      mrpPaise: 25000,
      isDefaultSaleUnit: false
    });

    // Create 2 batches: Batch A (100 units), Batch B (50 units)
    testBatch1 = await batchRepo.create({
      organizationId: orgId,
      productId: testProduct.id,
      batchNumber: 'BATCH-A1',
      expiryDate: '2027-12-31',
      purchasePricePerUnit: 1.0,
      mrpPerUnit: 2.5,
      salePricePerUnit: 2.0,
      initialStockQuantity: 100
    });

    testBatch2 = await batchRepo.create({
      organizationId: orgId,
      productId: testProduct.id,
      batchNumber: 'BATCH-B2',
      expiryDate: '2028-06-30',
      purchasePricePerUnit: 1.0,
      mrpPerUnit: 2.5,
      salePricePerUnit: 2.0,
      initialStockQuantity: 50
    });
  });

  afterEach(() => {
    try {
      db.close();
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // 1. Base-unit variance calculation
  it('1. calculates variance accurately in indivisible base units', async () => {
    const session = await reconciliationService.createSession({ notes: 'Audit session 1' }, staffUser);

    const item = await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 96,
        varianceReason: 'AUDIT_CORRECTION'
      },
      staffUser
    );

    expect(item.systemStockQuantity).toBe(100);
    expect(item.physicalStockQuantity).toBe(96);
    expect(item.varianceQuantity).toBe(-4);
  });

  // 2. Multi-pack conversion
  it('2. converts multi-pack count (e.g. Boxes and Strips) accurately to base units', async () => {
    const session = await reconciliationService.createSession({ notes: 'Packaging unit audit' }, staffUser);

    // Count entered as 2 Boxes = 2 * 100 = 200 base units
    const item = await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 0,
        packagingUnitName: 'BOX',
        packagingUnitQuantity: 2,
        varianceReason: 'AUDIT_CORRECTION'
      },
      staffUser
    );

    expect(item.physicalStockQuantity).toBe(200);
    expect(item.systemStockQuantity).toBe(100);
    expect(item.varianceQuantity).toBe(100);
  });

  // 3. Batch-specific reconciliation
  it('3. isolates adjustments to specific individual batches', async () => {
    const session = await reconciliationService.createSession({ notes: 'Multi batch audit' }, staffUser);

    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 80,
        varianceReason: 'DAMAGE'
      },
      staffUser
    );

    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch2.id,
        physicalStockQuantity: 60,
        varianceReason: 'AUDIT_CORRECTION'
      },
      staffUser
    );

    const detailed = await reconciliationService.getSessionById(session.id, staffUser);
    expect(detailed?.items.length).toBe(2);
    expect(detailed?.items.find((i) => i.batchId === testBatch1.id)?.varianceQuantity).toBe(-20);
    expect(detailed?.items.find((i) => i.batchId === testBatch2.id)?.varianceQuantity).toBe(10);
  });

  // 4. Positive variance
  it('4. records positive variance and posts ADJUSTMENT_IN on approval', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 115,
        varianceReason: 'AUDIT_CORRECTION'
      },
      staffUser
    );

    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    const posted = await reconciliationService.reviewSession(
      { sessionId: session.id, action: 'APPROVE', reviewNotes: 'Approved surplus' },
      ownerUser
    );

    expect(posted.status).toBe('POSTED');
    const updatedBatch = await batchRepo.findById(testBatch1.id, orgId);
    expect(updatedBatch?.currentStockQuantity).toBe(115);

    const movements = await movementRepo.findByBatch(testBatch1.id, orgId);
    expect(movements.some((m) => m.movementType === 'ADJUSTMENT_IN' && m.quantityChange === 15)).toBe(true);
  });

  // 5. Negative variance with damage reason
  it('5. records negative variance and posts DAMAGED_WRITE_OFF on approval', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 85,
        varianceReason: 'DAMAGE',
        notes: 'Water damage on shelf'
      },
      staffUser
    );

    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    const updatedBatch = await batchRepo.findById(testBatch1.id, orgId);
    expect(updatedBatch?.currentStockQuantity).toBe(85);

    const movements = await movementRepo.findByBatch(testBatch1.id, orgId);
    expect(movements.some((m) => m.movementType === 'DAMAGED_WRITE_OFF' && m.quantityChange === -15)).toBe(true);
  });

  // 6. Zero variance
  it('6. handles zero variance without mutating batch stock unnecessarily', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 100,
        varianceReason: 'AUDIT_CORRECTION'
      },
      staffUser
    );

    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    const posted = await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    expect(posted.status).toBe('POSTED');
    const updatedBatch = await batchRepo.findById(testBatch1.id, orgId);
    expect(updatedBatch?.currentStockQuantity).toBe(100);
  });

  // 7 & 8. Rejection leaves stock unchanged
  it('7 & 8. rejection marks session REJECTED and leaves batch stock completely unchanged', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 50,
        varianceReason: 'SHRINKAGE'
      },
      staffUser
    );

    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    const rejected = await reconciliationService.reviewSession(
      { sessionId: session.id, action: 'REJECT', reviewNotes: 'Recount requested' },
      ownerUser
    );

    expect(rejected.status).toBe('REJECTED');
    const batch = await batchRepo.findById(testBatch1.id, orgId);
    expect(batch?.currentStockQuantity).toBe(100); // untouched
  });

  // 9. Ledger posting immutability
  it('9. ensures historical stock movements are append-only without mutating past rows', async () => {
    const movementsBefore = await movementRepo.listRecent(orgId, 100);

    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 90,
        varianceReason: 'AUDIT_CORRECTION'
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    const movementsAfter = await movementRepo.listRecent(orgId, 100);
    expect(movementsAfter.length).toBe(movementsBefore.length + 1);
  });

  // 10. Audit event logging
  it('10. logs structured audit trail for lifecycle steps', async () => {
    const session = await reconciliationService.createSession({ notes: 'Audit logging test' }, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 95
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    const auditRepo = new SqliteAuditRepository(db);
    const logs = await auditRepo.listRecent(50);
    const actions = logs.map((l) => l.action);

    expect(actions).toContain('RECONCILIATION_CREATED');
    expect(actions).toContain('RECONCILIATION_ITEM_UPDATED');
    expect(actions).toContain('RECONCILIATION_SUBMITTED');
    expect(actions).toContain('RECONCILIATION_POSTED');
  });

  // 11. Developer access denial
  it('11. denies DEVELOPER role access to reconciliation APIs', async () => {
    await expect(
      reconciliationService.createSession({}, devUser)
    ).rejects.toThrow(AuthorizationError);

    await expect(
      reconciliationService.listSessions(devUser)
    ).rejects.toThrow(AuthorizationError);
  });

  // 12 & 13. Staff approval denial vs Owner approval
  it('12 & 13. denies STAFF approval while allowing OWNER approval', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 90
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);

    // Staff cannot approve
    await expect(
      reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, staffUser)
    ).rejects.toThrow(AuthorizationError);

    // Owner can approve
    const approved = await reconciliationService.reviewSession(
      { sessionId: session.id, action: 'APPROVE' },
      ownerUser
    );
    expect(approved.status).toBe('POSTED');
  });

  // 14. Concurrent stock change detection
  it('14. handles concurrent stock changes between count and approval safely', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    // Counted 90 when system was 100 (Variance = -10)
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 90
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);

    // Simulate concurrent sale: stock drops from 100 to 95
    await batchRepo.updateQuantity(testBatch1.id, orgId, 95);

    // On approval, variance (-10) applies to current stock (95) -> 85
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    const updated = await batchRepo.findById(testBatch1.id, orgId);
    expect(updated?.currentStockQuantity).toBe(85);
  });

  // 15. Duplicate approval prevention
  it('15. prevents duplicate review or approval of already submitted/posted sessions', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 90
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    // Attempt second approval
    await expect(
      reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser)
    ).rejects.toThrow(ValidationError);
  });

  // 16. Already-posted reconciliation immutability
  it('16. prevents adding, updating, or deleting items on POSTED sessions', async () => {
    const session = await reconciliationService.createSession({}, staffUser);
    const item = await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: testBatch1.id,
        physicalStockQuantity: 90
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    await expect(
      reconciliationService.addItem(
        {
          sessionId: session.id,
          productId: testProduct.id,
          batchId: testBatch2.id,
          physicalStockQuantity: 40
        },
        staffUser
      )
    ).rejects.toThrow(ValidationError);

    await expect(
      reconciliationService.deleteItem(item.id, session.id, staffUser)
    ).rejects.toThrow(ValidationError);
  });

  // 17. Expired batch handling
  it('17. allows reconciliation of expired batches with EXPIRY_DISPOSAL without making them active', async () => {
    const expiredBatch = await batchRepo.create({
      organizationId: orgId,
      productId: testProduct.id,
      batchNumber: 'EXP-BATCH',
      expiryDate: '2023-01-01',
      purchasePricePerUnit: 1.0,
      mrpPerUnit: 2.5,
      salePricePerUnit: 2.0,
      initialStockQuantity: 30
    });

    const session = await reconciliationService.createSession({}, staffUser);
    await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: testProduct.id,
        batchId: expiredBatch.id,
        physicalStockQuantity: 0,
        varianceReason: 'EXPIRY_DISPOSAL',
        notes: 'Disposed safely into bio-hazard'
      },
      staffUser
    );
    await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    await reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, ownerUser);

    const updated = await batchRepo.findById(expiredBatch.id, orgId);
    expect(updated?.currentStockQuantity).toBe(0);

    const movements = await movementRepo.findByBatch(expiredBatch.id, orgId);
    expect(movements.some((m) => m.movementType === 'EXPIRED_DISCARD')).toBe(true);
  });

  // 18. Organization boundary isolation
  it('18. strictly isolates reconciliation sessions across organizations', async () => {
    const session = await reconciliationService.createSession({}, staffUser);

    const otherOwnerUser: SessionUser = {
      ...ownerUser,
      id: 'other-owner',
      organizationId: otherOrgId
    };

    const sessionFromOther = await reconciliationService.getSessionById(session.id, otherOwnerUser);
    expect(sessionFromOther).toBeNull();

    await expect(
      reconciliationService.reviewSession({ sessionId: session.id, action: 'APPROVE' }, otherOwnerUser)
    ).rejects.toThrow(ValidationError);
  });
});
