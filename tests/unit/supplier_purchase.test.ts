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
  SqlitePurchaseRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { SupplierPurchaseService } from '@medidesk/application';
import { SessionUser, RoleName } from '@medidesk/domain';

describe('Supplier & Purchase Inward Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let purchaseService: SupplierPurchaseService;
  let supplierRepo: SqliteSupplierRepository;
  let purchaseRepo: SqlitePurchaseRepository;
  let batchRepo: SqliteInventoryBatchRepository;
  let medRepo: SqliteMedicineRepository;
  let prodRepo: SqliteMedicineProductRepository;
  let auditRepo: SqliteAuditRepository;

  const orgId = 'org-test-pharmacy-2';

  const ownerUser: SessionUser = {
    id: 'user-owner-2',
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
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-purchase-test-'));
    const testDbPath = path.join(testDir, 'test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`
      INSERT INTO organizations (id, name, code) VALUES (?, 'Test Clinic', 'TC2')
    `).run(orgId);

    db.getRawDb().prepare(`
      INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active)
      VALUES (?, ?, ?, ?, ?, 'hash123', 1)
    `).run(ownerUser.id, orgId, ownerUser.username, ownerUser.email, ownerUser.fullName);

    supplierRepo = new SqliteSupplierRepository(db);
    purchaseRepo = new SqlitePurchaseRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    medRepo = new SqliteMedicineRepository(db);
    prodRepo = new SqliteMedicineProductRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    purchaseService = new SupplierPurchaseService(supplierRepo, purchaseRepo, auditService, rbac);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create supplier and inward purchase invoice with pack quantity calculations', async () => {
    const supplier = await purchaseService.createSupplier({
      organizationId: orgId,
      name: 'MediHealth Wholesale Agency',
      contactPerson: 'Ramesh Gupta',
      phone: '9876543210',
      gstin: '27AAAAA0000A1Z5',
      drugLicenseNumber: 'DL-2024-MH-999'
    }, ownerUser);

    expect(supplier.id).toBeDefined();

    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Amoxicillin + Clavulanic Acid',
      scheduleCategory: 'H1'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Augmentin 625 Duo',
      strength: '625mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      taxRatePercent: 12
    });

    // Inward: 5 packs (+ 1 free pack = 6 packs total * 10 = 60 base units)
    const invoice = await purchaseService.createPurchaseInvoice({
      organizationId: orgId,
      supplierId: supplier.id,
      invoiceNumber: 'INV-MH-2026-001',
      invoiceDate: '2026-08-25',
      discountAmount: 10,
      items: [
        {
          productId: product.id,
          batchNumber: 'AUG-B01',
          expiryDate: '2027-12-31',
          packQuantity: 5,
          freePackQuantity: 1,
          packSizeMultiplier: 10,
          purchaseRatePerPack: 150, // 5 * 150 = 750 gross
          mrpPerUnit: 22,
          salePricePerUnit: 20,
          taxRatePercent: 12
        }
      ]
    }, ownerUser);

    expect(invoice.id).toBeDefined();
    expect(invoice.grossAmount).toBe(750);
    expect(invoice.taxAmount).toBe(90); // 750 * 12% = 90
    expect(invoice.netTotal).toBe(830); // 750 + 90 - 10 discount = 830

    // Verify batch was created with 60 base units
    const batches = await batchRepo.findByProduct(product.id, orgId);
    expect(batches.length).toBe(1);
    expect(batches[0].batchNumber).toBe('AUG-B01');
    expect(batches[0].currentStockQuantity).toBe(60); // (5 + 1) * 10
  });

  it('should cancel purchase invoice and reverse stock in inventory', async () => {
    const supplier = await purchaseService.createSupplier({
      organizationId: orgId,
      name: 'Pharma Dist',
      gstin: '29ABCDE1234F1Z5'
    }, ownerUser);

    const generic = await medRepo.create({
      organizationId: orgId,
      genericName: 'Cetirizine',
      scheduleCategory: 'GENERAL'
    });

    const product = await prodRepo.create({
      organizationId: orgId,
      medicineId: generic.id,
      brandName: 'Cetzine 10',
      strength: '10mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      taxRatePercent: 12
    });

    const invoice = await purchaseService.createPurchaseInvoice({
      organizationId: orgId,
      supplierId: supplier.id,
      invoiceNumber: 'INV-CANCEL-01',
      invoiceDate: '2026-08-25',
      items: [
        {
          productId: product.id,
          batchNumber: 'CET-001',
          expiryDate: '2028-05-31',
          packQuantity: 10,
          packSizeMultiplier: 10,
          purchaseRatePerPack: 20,
          mrpPerUnit: 4,
          salePricePerUnit: 3.5,
          taxRatePercent: 12
        }
      ]
    }, ownerUser);

    let batches = await batchRepo.findByProduct(product.id, orgId);
    expect(batches[0].currentStockQuantity).toBe(100);

    // Cancel invoice
    const cancelled = await purchaseService.cancelPurchase(invoice.id, ownerUser);
    expect(cancelled.status).toBe('CANCELLED');

    batches = await batchRepo.findByProduct(product.id, orgId);
    expect(batches[0].currentStockQuantity).toBe(0);
  });
});
