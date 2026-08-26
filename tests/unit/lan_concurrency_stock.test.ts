import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteMedicineProductRepository,
  SqliteMedicineRepository,
  SqliteInventoryBatchRepository,
  SqliteStockMovementRepository,
  SqliteSaleRepository,
  SqliteSaleReturnRepository,
  SqlitePrescriptionRepository,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteAuditRepository,
  SqliteLanDeviceRepository,
  SqliteLanServerConfigRepository
} from '@medidesk/database';
import {
  PharmacyBillingService,
  InventoryService,
  AuthenticationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { LanServer } from '@medidesk/lan';
import { LanSecurityManager } from '@medidesk/lan';
import { SessionUser } from '@medidesk/domain';

describe('Phase 7: LAN Concurrency & Zero Negative Stock Invariant', () => {
  let db: SqliteDatabase;
  let testDbPath: string;
  let lanServer: LanServer;
  let billingService: PharmacyBillingService;
  let inventoryService: InventoryService;
  let batchRepo: SqliteInventoryBatchRepository;
  let movementRepo: SqliteStockMovementRepository;
  let productRepo: SqliteMedicineProductRepository;
  let saleRepo: SqliteSaleRepository;

  const orgId = 'org-lan-concurrency';
  let staffUserA: SessionUser;
  let staffUserB: SessionUser;
  let testProductId: string;
  let testBatchId: string;

  beforeEach(async () => {
    testDbPath = path.join(process.cwd(), `test_lan_conc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.sqlite`);
    db = new SqliteDatabase({ databasePath: testDbPath });
    const runner = new MigrationRunner(db);
    runner.runPendingMigrations();

    const orgRepo = new SqliteOrganizationRepository(db);
    const userRepo = new SqliteUserRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();
    const appStateRepo = { getState: async () => null, setState: async () => {} } as any;
    const passwordHasher = new ScryptPasswordHasher();

    const medicineRepo = new SqliteMedicineRepository(db);
    productRepo = new SqliteMedicineProductRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movementRepo = new SqliteStockMovementRepository(db);
    saleRepo = new SqliteSaleRepository(db);
    const saleReturnRepo = new SqliteSaleReturnRepository(db);
    const rxRepo = new SqlitePrescriptionRepository(db);

    const devRepo = new SqliteLanDeviceRepository(db);
    const cfgRepo = new SqliteLanServerConfigRepository(db);
    const secMgr = new LanSecurityManager(cfgRepo, devRepo);

    await orgRepo.create({
      id: orgId,
      name: 'Concurrency Clinic',
      code: 'CCC',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: '456 Rush St',
      phone: '9988776655',
      email: 'rush@clinic.lan'
    });

    const userA = await userRepo.create({
      id: 'staff-a',
      organizationId: orgId,
      username: 'pos_cashier_1',
      email: 'cashier1@clinic.lan',
      passwordHash: 'hash-a',
      fullName: 'Cashier 1',
      roles: ['STAFF']
    });

    const userB = await userRepo.create({
      id: 'staff-b',
      organizationId: orgId,
      username: 'pos_cashier_2',
      email: 'cashier2@clinic.lan',
      passwordHash: 'hash-b',
      fullName: 'Cashier 2',
      roles: ['STAFF']
    });

    staffUserA = {
      id: userA.id,
      organizationId: orgId,
      organizationName: 'Concurrency Clinic',
      username: userA.username,
      email: userA.email,
      fullName: userA.fullName,
      roles: ['STAFF'],
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    staffUserB = {
      id: userB.id,
      organizationId: orgId,
      organizationName: 'Concurrency Clinic',
      username: userB.username,
      email: userB.email,
      fullName: userB.fullName,
      roles: ['STAFF'],
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    inventoryService = new InventoryService(batchRepo, movementRepo, productRepo, auditService, rbacEngine);
    billingService = new PharmacyBillingService(
      saleRepo,
      saleReturnRepo,
      batchRepo,
      productRepo,
      auditService,
      rbacEngine,
      rxRepo
    );

    const authService = new AuthenticationService(userRepo, orgRepo, appStateRepo, passwordHasher, auditService, rbacEngine);

    lanServer = new LanServer(cfgRepo, devRepo, secMgr, {
      authService,
      inventoryService,
      billingService,
      auditService,
      rbacEngine
    });

    // Create a medicine product & batch with exactly 10 units in stock
    const med = await medicineRepo.create({
      organizationId: orgId,
      genericName: 'Amoxicillin Trihydrate',
      scheduleCategory: 'H'
    });

    const prod = await productRepo.create({
      organizationId: orgId,
      medicineId: med.id,
      brandName: 'Amoxicillin 500mg',
      strength: '500mg',
      dosageForm: 'CAPSULE',
      packSize: '10 Capsules',
      packQuantity: 10,
      unitOfMeasure: 'STRIP',
      hsnCode: '30041010',
      taxRatePercent: 12
    });
    testProductId = prod.id;

    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: testProductId,
      batchNumber: 'AMX-2026-01',
      expiryDate: '2027-12-31',
      initialStockQuantity: 10,
      purchasePricePerUnit: 5.0,
      salePricePerUnit: 10.0,
      mrpPerUnit: 12.0
    });
    testBatchId = batch.id;
  });

  afterEach(async () => {
    try {
      await lanServer.stop();
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch { /* cleanup */ }
  });

  it('prevents negative stock and double-allocation when two LAN cashiers bill simultaneously', async () => {
    // Both cashier A and cashier B request the full 10 units concurrently
    const saleRequestA = {
      organizationId: orgId,
      customerType: 'WALK_IN',
      customerName: 'Customer A',
      paymentMode: 'CASH',
      items: [
        {
          productId: testProductId,
          batchId: testBatchId,
          quantity: 10,
          unitSalePrice: 10.0
        }
      ]
    };

    const saleRequestB = {
      organizationId: orgId,
      customerType: 'WALK_IN',
      customerName: 'Customer B',
      paymentMode: 'UPI',
      items: [
        {
          productId: testProductId,
          batchId: testBatchId,
          quantity: 10,
          unitSalePrice: 10.0
        }
      ]
    };

    // Execute concurrently
    const results = await Promise.allSettled([
      billingService.createSale(saleRequestA, staffUserA),
      billingService.createSale(saleRequestB, staffUserB)
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // INVARIANT 1: Exactly 1 transaction must succeed
    expect(fulfilled.length).toBe(1);

    // INVARIANT 2: Exactly 1 transaction must fail with stock deficit error
    expect(rejected.length).toBe(1);
    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectionReason.message).toMatch(/stock|insufficient|deficit/i);

    // INVARIANT 3: Remaining stock in the database MUST be EXACTLY 0 (never negative)
    const finalBatch = await batchRepo.findById(testBatchId, orgId);
    expect(finalBatch).not.toBeNull();
    expect(finalBatch!.currentStockQuantity).toBe(0);

    // INVARIANT 4: Exactly 1 stock movement of -10 exists
    const movements = await movementRepo.findByProduct(testProductId, orgId);
    expect(movements.length).toBe(1);
    expect(movements[0].quantityChange).toBe(-10);
    expect(movements[0].balanceAfter).toBe(0);
  });
});
