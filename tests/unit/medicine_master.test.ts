import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { MedicineMasterService } from '@medidesk/application';
import { SessionUser, RoleName, AuthorizationError } from '@medidesk/domain';

describe('Medicine Master & Product Catalog Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let medicineService: MedicineMasterService;
  let medRepo: SqliteMedicineRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let auditRepo: SqliteAuditRepository;

  const orgId = 'org-test-pharmacy-1';

  const ownerUser: SessionUser = {
    id: 'user-owner-1',
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

  const devUser: SessionUser = {
    id: 'user-dev-1',
    organizationId: orgId,
    organizationName: 'Test Clinic',
    username: 'dev_user',
    email: 'dev@system.com',
    fullName: 'Developer',
    roles: [RoleName.DEVELOPER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-medmaster-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TC1')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(devUser.id, orgId, devUser.username, devUser.email, devUser.fullName);

    medRepo = new SqliteMedicineRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    medicineService = new MedicineMasterService(medRepo, prodRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create generic medicine and manufacturer', async () => {
    const mfg = await medicineService.createManufacturer({
      organizationId: orgId,
      name: 'Micro Labs Ltd',
      code: 'MICRO',
      country: 'India'
    }, ownerUser);

    expect(mfg.id).toBeDefined();
    expect(mfg.name).toBe('Micro Labs Ltd');

    const generic = await medicineService.createMedicine({
      organizationId: orgId,
      genericName: 'Paracetamol',
      therapeuticClass: 'Analgesic / Antipyretic',
      scheduleCategory: 'GENERAL',
      isPrescriptionRequired: false
    }, ownerUser);

    expect(generic.id).toBeDefined();
    expect(generic.genericName).toBe('Paracetamol');
  });

  it('should separate generic molecule from brand product SKU variants', async () => {
    const generic = await medicineService.createMedicine({
      organizationId: orgId,
      genericName: 'Paracetamol',
      scheduleCategory: 'GENERAL'
    }, ownerUser);

    const mfg = await medicineService.createManufacturer({
      organizationId: orgId,
      name: 'Micro Labs Ltd'
    }, ownerUser);

    // Product Variant 1: Dolo 650 (15 tablets/strip)
    const product1 = await medicineService.createProduct({
      organizationId: orgId,
      medicineId: generic.id,
      manufacturerId: mfg.id,
      brandName: 'Dolo 650',
      strength: '650mg',
      dosageForm: 'TABLET',
      packSize: '15 Tablets / Strip',
      packQuantity: 15,
      barcode: '8901234567890',
      hsnCode: '30049060',
      taxRatePercent: 12,
      minStockLevel: 30
    }, ownerUser);

    // Product Variant 2: Calpol 500 (10 tablets/strip)
    const product2 = await medicineService.createProduct({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Calpol 500',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      taxRatePercent: 12,
      minStockLevel: 20
    }, ownerUser);

    expect(product1.brandName).toBe('Dolo 650');
    expect(product1.packQuantity).toBe(15);
    expect(product2.brandName).toBe('Calpol 500');
    expect(product2.packQuantity).toBe(10);

    // Lookup by barcode
    const foundByBarcode = await medicineService.getProductByBarcode('8901234567890', ownerUser);
    expect(foundByBarcode?.id).toBe(product1.id);
  });

  it('should deny Developer from creating or modifying medicine master records', async () => {
    await expect(
      medicineService.createMedicine({
        organizationId: orgId,
        genericName: 'Ibuprofen'
      }, devUser)
    ).rejects.toThrow(AuthorizationError);

    await expect(
      medicineService.searchMedicines('', devUser)
    ).rejects.toThrow(AuthorizationError);
  });
});
