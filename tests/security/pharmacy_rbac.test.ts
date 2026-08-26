import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqliteSupplierRepository,
  SqliteInventoryBatchRepository,
  SqliteStockMovementRepository,
  SqlitePurchaseRepository,
  SqliteSaleRepository,
  SqliteSaleReturnRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  MedicineMasterService,
  SupplierPurchaseService,
  InventoryService,
  PharmacyBillingService
} from '@medidesk/application';
import { SessionUser, RoleName, AuthorizationError } from '@medidesk/domain';

describe('Pharmacy Security & RBAC Enforcement Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let medicineService: MedicineMasterService;
  let purchaseService: SupplierPurchaseService;
  let invService: InventoryService;
  let billingService: PharmacyBillingService;

  const orgId = 'org-test-pharmacy-rbac';

  const devUser: SessionUser = {
    id: 'user-dev-pharmacy',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'dev_user',
    email: 'dev@system.com',
    fullName: 'System Developer',
    roles: [RoleName.DEVELOPER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const doctorUser: SessionUser = {
    id: 'user-doctor-pharmacy',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'doctor_user',
    email: 'doctor@clinic.com',
    fullName: 'Dr. Physician',
    roles: [RoleName.DOCTOR],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const staffUser: SessionUser = {
    id: 'user-staff-pharmacy',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'staff_user',
    email: 'staff@clinic.com',
    fullName: 'Pharmacist Staff',
    roles: [RoleName.STAFF],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-rbac-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TCRBAC')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(devUser.id, orgId, devUser.username, devUser.email, devUser.fullName);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(doctorUser.id, orgId, doctorUser.username, doctorUser.email, doctorUser.fullName);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(staffUser.id, orgId, staffUser.username, staffUser.email, staffUser.fullName);

    const medRepo = new SqliteMedicineRepository(db);
    const prodRepo = new SqliteMedicineProductRepository(db);
    const supplierRepo = new SqliteSupplierRepository(db);
    const batchRepo = new SqliteInventoryBatchRepository(db);
    const movRepo = new SqliteStockMovementRepository(db);
    const purchaseRepo = new SqlitePurchaseRepository(db);
    const saleRepo = new SqliteSaleRepository(db);
    const returnRepo = new SqliteSaleReturnRepository(db);
    const auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    medicineService = new MedicineMasterService(medRepo, prodRepo, auditService, rbac);
    purchaseService = new SupplierPurchaseService(supplierRepo, purchaseRepo, auditService, rbac);
    invService = new InventoryService(batchRepo, movRepo, prodRepo, auditService, rbac);
    billingService = new PharmacyBillingService(saleRepo, returnRepo, batchRepo, prodRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('DEVELOPER role MUST have zero access to pharmacy business data', async () => {
    // Cannot search medicines
    await expect(medicineService.searchMedicines('', devUser)).rejects.toThrow(AuthorizationError);

    // Cannot create suppliers
    await expect(
      purchaseService.createSupplier({ organizationId: orgId, name: 'Malicious' }, devUser)
    ).rejects.toThrow(AuthorizationError);

    // Cannot read or adjust inventory
    await expect(invService.getLowStock(devUser)).rejects.toThrow(AuthorizationError);

    // Cannot perform sales
    await expect(
      billingService.createSale({
        organizationId: orgId,
        customerType: 'WALK_IN',
        customerName: 'Dev Attempt',
        items: []
      }, devUser)
    ).rejects.toThrow(AuthorizationError);
  });

  it('DOCTOR role has read access to medicine catalog but cannot perform sales or purchases', async () => {
    // Can search medicines for prescribing
    const medList = await medicineService.searchMedicines('', doctorUser);
    expect(Array.isArray(medList)).toBe(true);

    // Cannot create inward purchases
    await expect(
      purchaseService.createPurchaseInvoice({
        organizationId: orgId,
        supplierId: 's1',
        invoiceNumber: 'INV-1',
        invoiceDate: '2026-08-25',
        items: []
      }, doctorUser)
    ).rejects.toThrow(AuthorizationError);
  });

  it('STAFF role has operational access to POS and Inventory', async () => {
    // Can search products
    const prods = await medicineService.searchProducts('', staffUser);
    expect(Array.isArray(prods)).toBe(true);

    // Can allocate FEFO stock
    const fefo = await invService.allocateFefoStock({
      organizationId: orgId,
      productId: 'p1',
      requestedQuantity: 5
    }, staffUser);
    expect(fefo).toBeDefined();
  });
});
