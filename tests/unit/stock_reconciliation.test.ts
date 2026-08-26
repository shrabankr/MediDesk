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
import {
  InventoryService,
  PharmacyBillingService
} from '@medidesk/application';
import { SessionUser, RoleName } from '@medidesk/domain';

describe('Phase 5: Stock Movement Ledger Reconciliation & Formula Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let invService: InventoryService;
  let billingService: PharmacyBillingService;
  let batchRepo: SqliteInventoryBatchRepository;
  let movRepo: SqliteStockMovementRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let medRepo: SqliteMedicineRepository;

  const orgId = 'org-test-reconcile';

  const ownerUser: SessionUser = {
    id: 'user-owner-rec',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'owner_rec',
    email: 'owner@clinic.com',
    fullName: 'Owner Reconcile',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-reconcile-test-'));
    const testDbPath = path.join(testDir, 'reconcile.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TCREC')`).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    medRepo = new SqliteMedicineRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movRepo = new SqliteStockMovementRepository(db);
    const saleRepo = new SqliteSaleRepository(db);
    const returnRepo = new SqliteSaleReturnRepository(db);
    const auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    invService = new InventoryService(batchRepo, movRepo, prodRepo, auditService, rbac);
    billingService = new PharmacyBillingService(saleRepo, returnRepo, batchRepo, prodRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('verifies exact stock balance equation across 8 movement types', async () => {
    // 1. Generic & Product
    const med = await medRepo.create({ organizationId: orgId, genericName: 'Amoxicillin' });
    const prod = await prodRepo.create({
      organizationId: orgId,
      medicineId: med.id,
      brandName: 'Mox 500',
      strength: '500mg',
      dosageForm: 'CAPSULE',
      packSize: '10 Caps / Strip',
      packQuantity: 10,
      taxRatePercent: 12
    });

    // 2. Initial Opening Stock: 100 base units
    const batch = await batchRepo.create({
      organizationId: orgId,
      productId: prod.id,
      batchNumber: 'MOX-REC-01',
      expiryDate: '2028-12-31',
      purchasePricePerUnit: 5,
      mrpPerUnit: 10,
      salePricePerUnit: 9,
      initialStockQuantity: 100
    });

    let currentExpected = 100;
    expect(batch.currentStockQuantity).toBe(currentExpected);

    // 3. Purchase Inward: + 50 units (via manual adjustment or inward)
    await invService.adjustStock({
      organizationId: orgId,
      batchId: batch.id,
      adjustedQuantity: 50,
      isDelta: true,
      movementType: 'ADJUSTMENT_IN',
      reason: 'Physical stock reconciliation surplus'
    }, ownerUser);
    currentExpected += 50; // 150

    // 4. POS Sale: - 30 units
    const sale = await billingService.createSale({
      organizationId: orgId,
      customerType: 'WALK_IN',
      customerName: 'Customer Reconcile',
      paymentMode: 'CASH',
      items: [{ productId: prod.id, batchId: batch.id, quantity: 30 }]
    }, ownerUser);
    currentExpected -= 30; // 120

    // 5. Sale Return: + 5 units
    await billingService.createSaleReturn({
      organizationId: orgId,
      saleId: sale.id,
      reason: 'Excess purchase returned',
      refundMode: 'CASH',
      items: [{ saleItemId: sale.items[0].id, quantity: 5 }]
    }, ownerUser);
    currentExpected += 5; // 125

    // 6. Adjustment Out (Stock deficit): - 10 units
    await invService.adjustStock({
      organizationId: orgId,
      batchId: batch.id,
      adjustedQuantity: -10,
      isDelta: true,
      movementType: 'ADJUSTMENT_OUT',
      reason: 'Inventory recount shortage'
    }, ownerUser);
    currentExpected -= 10; // 115

    // 7. Damaged write-off: - 5 units
    await invService.adjustStock({
      organizationId: orgId,
      batchId: batch.id,
      adjustedQuantity: -5,
      isDelta: true,
      movementType: 'DAMAGED_WRITE_OFF',
      reason: 'Water damage on shelf'
    }, ownerUser);
    currentExpected -= 5; // 110

    // 8. Expired discard: - 10 units
    await invService.adjustStock({
      organizationId: orgId,
      batchId: batch.id,
      adjustedQuantity: -10,
      isDelta: true,
      movementType: 'EXPIRED_DISCARD',
      reason: 'Near expiry discard'
    }, ownerUser);
    currentExpected -= 10; // 100

    // Check Batch Current Stock
    const finalBatch = await batchRepo.findById(batch.id, orgId);
    expect(finalBatch?.currentStockQuantity).toBe(currentExpected);

    // Check Ledger Total Sum
    const movements = await movRepo.findByBatch(batch.id, orgId);
    const sumDeltas = movements.reduce((acc, m) => acc + m.quantityChange, 0);

    // Initial was 100, sum of subsequent movements was: +50 -30 +5 -10 -5 -10 = 0 -> Final = 100
    expect(100 + sumDeltas).toBe(finalBatch?.currentStockQuantity);
  });
});
