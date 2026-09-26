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
import { SessionUser, RoleName } from '@medidesk/domain';

describe('Phase 9A Integration: Complete Stock Reconciliation Workflow Lifecycle', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let reconciliationService: StockReconciliationService;
  let batchRepo: SqliteInventoryBatchRepository;
  let movementRepo: SqliteStockMovementRepository;

  const orgId = 'org-integration-p9';

  const ownerUser: SessionUser = {
    id: 'user-owner-integ',
    organizationId: orgId,
    organizationName: 'LifeLine Pharmacy',
    username: 'owner_lifeline',
    email: 'owner@lifeline.com',
    fullName: 'Dr. LifeLine Owner',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const staffUser: SessionUser = {
    id: 'user-staff-integ',
    organizationId: orgId,
    organizationName: 'LifeLine Pharmacy',
    username: 'staff_lifeline',
    email: 'staff@lifeline.com',
    fullName: 'Dispensary Staff',
    roles: [RoleName.STAFF],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-integ-p9-'));
    const testDbPath = path.join(testDir, 'integ.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();

    const orgRepo = new SqliteOrganizationRepository(db);
    await orgRepo.create({
      id: orgId,
      name: 'LifeLine Pharmacy',
      code: 'LLP',
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

    const medRepo = new SqliteMedicineRepository(db);
    const productRepo = new SqliteMedicineProductRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movementRepo = new SqliteStockMovementRepository(db);
    const packagingRepo = new SqlitePackagingUnitRepository(db);
    const reconciliationRepo = new SqliteStockReconciliationRepository(db);

    const packagingService = new PackagingUnitService(packagingRepo, productRepo, auditService);
    reconciliationService = new StockReconciliationService(
      reconciliationRepo,
      batchRepo,
      movementRepo,
      productRepo,
      packagingService,
      auditService,
      rbacEngine
    );

    const med = await medRepo.create({
      organizationId: orgId,
      genericName: 'Amoxicillin + Clavulanate',
      therapeuticClass: 'Antibiotics'
    });

    const prod = await productRepo.create({
      id: 'prod-augmentin',
      organizationId: orgId,
      medicineId: med.id,
      brandName: 'Augmentin 625 Duo',
      strength: '625mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      unitOfMeasure: 'TABLET'
    });

    await batchRepo.create({
      id: 'batch-aug-01',
      organizationId: orgId,
      productId: prod.id,
      batchNumber: 'AUG-001',
      expiryDate: '2027-08-30',
      purchasePricePerUnit: 12.0,
      mrpPerUnit: 20.0,
      salePricePerUnit: 18.0,
      initialStockQuantity: 100
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

  it('executes the full physical stock count and reconciliation lifecycle end-to-end', async () => {
    // 1. Staff creates physical count session (DRAFT)
    const session = await reconciliationService.createSession(
      { notes: 'Quarterly physical inventory verification' },
      staffUser
    );
    expect(session.status).toBe('DRAFT');
    expect(session.sessionNumber).toMatch(/^REC-/);

    // 2. Staff counts Augmentin 625 (System: 100, Physical: 92, Variance: -8)
    const item = await reconciliationService.addItem(
      {
        sessionId: session.id,
        productId: 'prod-augmentin',
        batchId: 'batch-aug-01',
        physicalStockQuantity: 92,
        varianceReason: 'DAMAGE',
        notes: '2 blister packs damaged during rack transit'
      },
      staffUser
    );
    expect(item.varianceQuantity).toBe(-8);

    // Session transitions to COUNTED
    const sessionCounted = await reconciliationService.getSessionById(session.id, staffUser);
    expect(sessionCounted?.status).toBe('COUNTED');

    // 3. Staff submits session for Owner review (SUBMITTED)
    const sessionSubmitted = await reconciliationService.submitSession({ sessionId: session.id }, staffUser);
    expect(sessionSubmitted.status).toBe('SUBMITTED');
    expect(sessionSubmitted.submittedBy).toBe(staffUser.id);

    // 4. Owner reviews and approves session (POSTED)
    const sessionApproved = await reconciliationService.reviewSession(
      {
        sessionId: session.id,
        action: 'APPROVE',
        reviewNotes: 'Verified damaged blister packs. Discard approved.'
      },
      ownerUser
    );
    expect(sessionApproved.status).toBe('POSTED');
    expect(sessionApproved.reviewedBy).toBe(ownerUser.id);
    expect(sessionApproved.postedAt).toBeDefined();

    // 5. Verify live batch stock was adjusted
    const updatedBatch = await batchRepo.findById('batch-aug-01', orgId);
    expect(updatedBatch?.currentStockQuantity).toBe(92);

    // 6. Verify immutable StockMovement entry was created
    const movements = await movementRepo.findByBatch('batch-aug-01', orgId);
    const reconMovement = movements.find((m) => m.referenceType === 'STOCK_RECONCILIATION');
    expect(reconMovement).toBeDefined();
    expect(reconMovement?.quantityChange).toBe(-8);
    expect(reconMovement?.movementType).toBe('DAMAGED_WRITE_OFF');
    expect(reconMovement?.referenceId).toBe(session.id);
  });
});
