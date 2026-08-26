import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SqliteDatabase,
  MigrationRunner,
  SqlitePackagingUnitRepository,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqliteSystemAlertRepository,
  SqliteAlertConfigRepository,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteAuditRepository,
  SqliteApplicationStateRepository
} from '@medidesk/database';
import {
  PackagingUnitService,
  SmartAlertService,
  SystemInitializationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import path from 'path';
import fs from 'fs';

describe('Phase 8 Integration: Database Migration 008, Packaging Units & Smart Alerts', () => {
  let db: SqliteDatabase;
  let dbPath: string;
  let packagingService: PackagingUnitService;
  let smartAlertService: SmartAlertService;
  let productRepo: SqliteMedicineProductRepository;
  let medicineRepo: SqliteMedicineRepository;
  let packagingRepo: SqlitePackagingUnitRepository;
  let alertRepo: SqliteSystemAlertRepository;
  let alertConfigRepo: SqliteAlertConfigRepository;
  let auditService: AuditService;

  let testOrgId: string;
  let testOwnerId: string;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), `test_p8_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`);
    db = new SqliteDatabase({ databasePath: dbPath });

    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    const auditRepo = new SqliteAuditRepository(db);
    auditService = new AuditService(auditRepo);

    const orgRepo = new SqliteOrganizationRepository(db);
    const userRepo = new SqliteUserRepository(db);
    const stateRepo = new SqliteApplicationStateRepository(db);
    const hasher = new ScryptPasswordHasher();

    const initService = new SystemInitializationService(
      orgRepo,
      userRepo,
      stateRepo,
      auditService,
      runner,
      hasher
    );

    const initResult = await initService.initialize({
      organization: {
        name: 'MediDesk P8 Clinic',
        code: 'P8-TEST',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'owner_p8',
        email: 'owner@p8.com',
        fullName: 'Owner P8',
        password: 'Password123!'
      },
      developerToken: 'dev-secret-token-123'
    });

    testOrgId = initResult.organizationId;
    testOwnerId = initResult.ownerId;

    productRepo = new SqliteMedicineProductRepository(db);
    medicineRepo = new SqliteMedicineRepository(db);
    packagingRepo = new SqlitePackagingUnitRepository(db);
    alertRepo = new SqliteSystemAlertRepository(db);
    alertConfigRepo = new SqliteAlertConfigRepository(db);

    packagingService = new PackagingUnitService(packagingRepo, productRepo, auditService);
    smartAlertService = new SmartAlertService(alertRepo, alertConfigRepo, auditService);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
    if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
  });

  it('successfully applies migration 008 and performs multi-tier packaging conversions in SQLite', async () => {
    // 1. Create generic medicine
    const med = await medicineRepo.create({
      organizationId: testOrgId,
      genericName: 'Paracetamol',
      therapeuticClass: 'Analgesic',
      scheduleCategory: 'GENERAL',
      isPrescriptionRequired: false
    });

    // 2. Create product variant
    const prod = await productRepo.create({
      organizationId: testOrgId,
      medicineId: med.id,
      brandName: 'Calpol 500',
      strength: '500mg',
      dosageForm: 'TABLET',
      packSize: '10 Tablets / Strip',
      packQuantity: 10,
      unitOfMeasure: 'TABLET',
      taxRatePercent: 12,
      minStockLevel: 5,
      maxStockLevel: 500,
      reorderQuantity: 20
    });

    // 3. Create Multi-tier Packaging Units
    const stripUnit = await packagingService.createPackagingUnit(
      {
        organizationId: testOrgId,
        productId: prod.id,
        unitName: 'STRIP',
        conversionFactor: 10, // 10 tablets per strip
        salePricePaise: 2000, // ₹20.00
        mrpPaise: 2500, // ₹25.00
        isDefaultSaleUnit: true
      },
      testOwnerId
    );

    const boxUnit = await packagingService.createPackagingUnit(
      {
        organizationId: testOrgId,
        productId: prod.id,
        unitName: 'BOX',
        conversionFactor: 100, // 10 strips = 100 tablets
        salePricePaise: 18000, // ₹180.00
        mrpPaise: 25000, // ₹250.00
        isDefaultSaleUnit: false
      },
      testOwnerId
    );

    expect(stripUnit.id).toBeDefined();
    expect(boxUnit.id).toBeDefined();

    // 4. Perform conversion to base units
    const conversion = await packagingService.convertPackageToBaseUnits(prod.id, 'BOX', 4, testOrgId);
    expect(conversion.totalBaseUnits).toBe(400);
    expect(conversion.calculatedPricePaise).toBe(72000); // 4 * 18000 paise (₹720.00)
  });

  it('raises and deduplicates smart alerts in SQLite', async () => {
    // Raise alert 1
    const alert1 = await smartAlertService.raiseAlert({
      organizationId: testOrgId,
      alertType: 'LOW_STOCK',
      category: 'INVENTORY',
      severity: 'WARNING',
      title: 'Low Stock Alert',
      message: 'Product stock is below threshold',
      entityType: 'PRODUCT',
      entityId: 'prod-1'
    });

    expect(alert1.id).toBeDefined();

    // Raise duplicate alert 2 on the same day -> deduplicated in-place
    const alert2 = await smartAlertService.raiseAlert({
      organizationId: testOrgId,
      alertType: 'LOW_STOCK',
      category: 'INVENTORY',
      severity: 'WARNING',
      title: 'Low Stock Alert',
      message: 'Product stock is below threshold (refreshed)',
      entityType: 'PRODUCT',
      entityId: 'prod-1'
    });

    expect(alert2.id).toBe(alert1.id);
    expect(alert2.dedupKey).toBe(alert1.dedupKey);

    const activeAlerts = await smartAlertService.getActiveAlertsForActor(testOrgId, 'OWNER');
    expect(activeAlerts.length).toBe(1);
  });
});
