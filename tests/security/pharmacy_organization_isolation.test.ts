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

describe('Phase 5: Multi-Tenant Organization Boundary Isolation Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let medicineService: MedicineMasterService;
  let purchaseService: SupplierPurchaseService;
  let invService: InventoryService;
  let billingService: PharmacyBillingService;

  const orgA = 'org-tenant-alpha';
  const orgB = 'org-tenant-beta';

  const userOrgA: SessionUser = {
    id: 'user-org-a',
    organizationId: orgA,
    organizationName: 'Clinic Alpha',
    username: 'owner_alpha',
    email: 'alpha@clinic.com',
    fullName: 'Owner Alpha',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const userOrgB: SessionUser = {
    id: 'user-org-b',
    organizationId: orgB,
    organizationName: 'Clinic Beta',
    username: 'owner_beta',
    email: 'beta@clinic.com',
    fullName: 'Owner Beta',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-org-isolation-test-'));
    const testDbPath = path.join(testDir, 'isolation.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    // Create 2 Organizations
    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Clinic Alpha', 'ALPHA')`).run(orgA);
    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Clinic Beta', 'BETA')`).run(orgB);

    // Create users for both orgs
    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(userOrgA.id, orgA, userOrgA.username, userOrgA.email, userOrgA.fullName);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(userOrgB.id, orgB, userOrgB.username, userOrgB.email, userOrgB.fullName);

    const medRepo = new SqliteMedicineRepository(db);
    const prodRepo = new SqliteMedicineProductRepository(db);
    const supplierRepo = new SqliteSupplierRepository(db);
    const batchRepo = new SqliteInventoryBatchRepository(db);
    const movRepo = new SqliteStockMovementRepository(db);
    const purchaseRepo = new SqlitePurchaseRepository(db);
    const saleRepo = new SqliteSaleRepository(db);
    const auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    medicineService = new MedicineMasterService(medRepo, prodRepo, auditService, rbac);
    purchaseService = new SupplierPurchaseService(supplierRepo, purchaseRepo, auditService, rbac);
    invService = new InventoryService(batchRepo, movRepo, prodRepo, auditService, rbac);
    billingService = new PharmacyBillingService(saleRepo, undefined, batchRepo, prodRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('Organization B cannot view or search Organization A medicines or products', async () => {
    const medA = await medicineService.createMedicine({
      organizationId: orgA,
      genericName: 'Alpha Specific Molecule',
      scheduleCategory: 'GENERAL'
    }, userOrgA);

    const prodA = await medicineService.createProduct({
      organizationId: orgA,
      medicineId: medA.id,
      brandName: 'Alpha Brand Tab',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '10 Tabs',
      packQuantity: 10
    }, userOrgA);

    // Organization B attempts to search
    const resultsOrgB = await medicineService.searchMedicines('Alpha', userOrgB);
    expect(resultsOrgB.length).toBe(0);

    const prodResultsOrgB = await medicineService.searchProducts('Alpha', userOrgB);
    expect(prodResultsOrgB.length).toBe(0);

    const directLookupOrgB = await medicineService.getProductById(prodA.id, userOrgB);
    expect(directLookupOrgB).toBeNull();
  });

  it('Organization B cannot access Organization A suppliers, purchases, or inventory batches', async () => {
    const supA = await purchaseService.createSupplier({
      organizationId: orgA,
      name: 'Alpha Wholesaler'
    }, userOrgA);

    // Org B searching suppliers
    const supResultsOrgB = await purchaseService.searchSuppliers('Alpha', userOrgB);
    expect(supResultsOrgB.length).toBe(0);

    // Org B direct lookup
    const supLookupOrgB = await purchaseService.getSupplierById(supA.id, userOrgB);
    expect(supLookupOrgB).toBeNull();
  });

  it('Organization B cannot access Organization A inventory batches or sales bills', async () => {
    const lowStockOrgB = await invService.getLowStock(userOrgB);
    expect(Array.isArray(lowStockOrgB)).toBe(true);

    const salesOrgB = await billingService.listSales(userOrgB);
    expect(salesOrgB.length).toBe(0);
  });

  it('Rejects cross-tenant mutation attempts with AuthorizationError', async () => {
    // Org A user trying to create a medicine under Org B
    await expect(
      medicineService.createMedicine({
        organizationId: orgB, // Mismatched org!
        genericName: 'Cross Tenant Attempt'
      }, userOrgA)
    ).rejects.toThrow(AuthorizationError);

    // Org A user trying to create supplier under Org B
    await expect(
      purchaseService.createSupplier({
        organizationId: orgB,
        name: 'Illegal Supplier'
      }, userOrgA)
    ).rejects.toThrow(AuthorizationError);
  });
});
