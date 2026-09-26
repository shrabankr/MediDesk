import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteAuditRepository,
  SqliteApplicationStateRepository,
  SqlitePatientRepository,
  SqliteDoctorRepository,
  SqliteMedicineRepository,
  SqliteMedicineProductRepository,
  SqlitePackagingUnitRepository,
  SqliteSupplierRepository,
  SqliteInventoryBatchRepository,
  SqliteStockMovementRepository
} from '@medidesk/database';
import {
  BulkDataImportService,
  SystemInitializationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { SessionUser, AuditAction, AuditEvent } from '@medidesk/domain';
import path from 'path';
import fs from 'fs';

describe('Bulk Data Import Workflow Integration Tests', () => {
  let db: SqliteDatabase;
  let dbPath: string;
  let importService: BulkDataImportService;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let userRepo: SqliteUserRepository;
  let medicineRepo: SqliteMedicineRepository;
  let productRepo: SqliteMedicineProductRepository;
  let packagingRepo: SqlitePackagingUnitRepository;
  let supplierRepo: SqliteSupplierRepository;
  let batchRepo: SqliteInventoryBatchRepository;
  let movementRepo: SqliteStockMovementRepository;
  let auditRepo: SqliteAuditRepository;
  let auditService: AuditService;
  let rbacEngine: RBACEngine;

  let ownerActor: SessionUser;
  let testOrgId: string;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), `test_import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`);
    db = new SqliteDatabase({ databasePath: dbPath });

    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    auditRepo = new SqliteAuditRepository(db);
    auditService = new AuditService(auditRepo);
    rbacEngine = new RBACEngine();

    const orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
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
        name: 'MediDesk Import Testing Clinic',
        code: 'IMPORT-TEST',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'import_owner',
        fullName: 'Import Owner',
        email: 'owner@clinic.com',
        password: 'Password123!'
      },
      developerToken: 'dev-token-test-123'
    });

    testOrgId = initResult.organizationId;
    ownerActor = {
      id: initResult.ownerId,
      username: 'import_owner',
      organizationId: testOrgId,
      email: 'owner@clinic.com',
      fullName: 'Import Owner',
      roles: ['OWNER'],
      permissions: ['*'],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    medicineRepo = new SqliteMedicineRepository(db);
    productRepo = new SqliteMedicineProductRepository(db);
    packagingRepo = new SqlitePackagingUnitRepository(db);
    supplierRepo = new SqliteSupplierRepository(db);
    batchRepo = new SqliteInventoryBatchRepository(db);
    movementRepo = new SqliteStockMovementRepository(db);

    importService = new BulkDataImportService(
      db,
      patientRepo,
      doctorRepo,
      userRepo,
      medicineRepo,
      productRepo,
      packagingRepo,
      supplierRepo,
      batchRepo,
      movementRepo,
      hasher,
      auditService,
      rbacEngine
    );
  });

  afterEach(() => {
    try {
      db.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      const wal = `${dbPath}-wal`;
      const shm = `${dbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      // ignore
    }
  });

  describe('Staged Validation Pipeline', () => {
    it('should validate valid patient CSV and identify duplicates as warnings', async () => {
      const csv = `first_name,last_name,gender,date_of_birth,phone\nRahul,Sharma,MALE,1990-05-15,9876543210\nPooja,Patel,FEMALE,1995-08-20,9876543211\nRahul,Sharma,MALE,1990-05-15,9876543210`;

      const res = await importService.parseAndValidate(
        {
          importType: 'PATIENTS',
          fileName: 'patients.csv',
          fileContent: csv,
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(res.isSupported).toBe(true);
      expect(res.totalRows).toBe(3);
      expect(res.validCount).toBe(2);
      expect(res.warningCount).toBe(1);
      expect(res.errorCount).toBe(0);
      expect(res.canProceed).toBe(true);
    });

    it('should report field-level errors when required fields or dates are malformed', async () => {
      const csv = `first_name,last_name,gender,date_of_birth\n,Sharma,MALE,1990-05-15\nAnil,Kumar,INVALID_GENDER,NOT_A_DATE`;

      const res = await importService.parseAndValidate(
        {
          importType: 'PATIENTS',
          fileName: 'bad_patients.csv',
          fileContent: csv,
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(res.errorCount).toBe(2);
      expect(res.rows[0].status).toBe('ERROR');
      expect(res.rows[0].problems.some((p) => p.field === 'first_name')).toBe(true);
      expect(res.rows[1].status).toBe('ERROR');
      expect(res.rows[1].problems.some((p) => p.field === 'gender')).toBe(true);
    });

    it('should reject opening stock when medicine does not exist or expiry is in the past', async () => {
      const csv = `medicine_name,batch_number,expiry_date,quantity,purchase_price,mrp\nNonExistentMed,B123,2028-12-31,100,1.50,2.00\nValidMed,B124,2020-01-01,100,1.50,2.00`;

      const res = await importService.parseAndValidate(
        {
          importType: 'OPENING_STOCK',
          fileName: 'opening_stock.csv',
          fileContent: csv,
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(res.errorCount).toBe(2);
      expect(res.rows[0].problems.some((p) => p.field === 'medicine_name')).toBe(true);
      expect(res.rows[1].problems.some((p) => p.field === 'expiry_date')).toBe(true);
      expect(res.canProceed).toBe(false);
    });
  });

  describe('Import Execution & Transaction Safety', () => {
    it('should import patients successfully and generate valid UHIDs', async () => {
      const validRows = [
        { first_name: 'Rahul', middle_name: 'K', last_name: 'Sharma', gender: 'MALE', date_of_birth: '1990-05-15', phone: '9876543210' },
        { first_name: 'Pooja', last_name: 'Patel', gender: 'FEMALE', date_of_birth: '1995-08-20', phone: '9876543211' }
      ];

      const result = await importService.executeImport(
        {
          importType: 'PATIENTS',
          fileName: 'patients.csv',
          policy: 'REJECT_ALL_ON_ERROR',
          validRows,
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(result.createdCount).toBe(2);
      expect(result.totalRows).toBe(2);
      expect(result.auditEventId).toBeDefined();

      const patients = await patientRepo.search({ organizationId: testOrgId, query: 'Rahul' });
      expect(patients.length).toBe(1);
      expect(patients[0].fullName).toBe('Rahul K Sharma');
      expect(patients[0].patientNumber).toBeDefined();
    });

    it('should import medicines, multi-tier packaging, and opening stock into the inventory ledger', async () => {
      // 1. Import Medicine
      const medRows = [
        {
          generic_name: 'Paracetamol',
          brand_name: 'Dolo 650mg Tablet',
          dosage_form: 'TABLET',
          category: 'GENERAL',
          mrp: 30.5,
          selling_price: 28.0,
          pack_size: '15 Tablets / Strip',
          pack_quantity: 15,
          gst_rate: 12
        }
      ];

      const medResult = await importService.executeImport(
        {
          importType: 'MEDICINES',
          fileName: 'medicines.csv',
          policy: 'REJECT_ALL_ON_ERROR',
          validRows: medRows,
          organizationId: testOrgId
        },
        ownerActor
      );
      expect(medResult.createdCount).toBe(1);

      const products = await productRepo.search(testOrgId, 'Dolo');
      expect(products.length).toBe(1);
      const product = products[0];

      // 2. Import Packaging
      const pkgRows = [
        {
          productId: product.id,
          medicine_name: 'Dolo 650mg Tablet',
          unit_name: 'Strip',
          conversion_factor: 15,
          salePricePaise: 2800,
          mrpPaise: 3050
        }
      ];

      const pkgResult = await importService.executeImport(
        {
          importType: 'PACKAGING',
          fileName: 'packaging.csv',
          policy: 'REJECT_ALL_ON_ERROR',
          validRows: pkgRows,
          organizationId: testOrgId
        },
        ownerActor
      );
      expect(pkgResult.createdCount).toBe(1);

      // 3. Import Opening Stock
      const stockRows = [
        {
          productId: product.id,
          medicine_name: 'Dolo 650mg Tablet',
          batch_number: 'DL65-2026',
          expiry_date: '2028-12-31',
          quantity: 300,
          purchasePricePaise: 150,
          mrpPaise: 203,
          salePricePaise: 187
        }
      ];

      const stockResult = await importService.executeImport(
        {
          importType: 'OPENING_STOCK',
          fileName: 'opening_stock.csv',
          policy: 'REJECT_ALL_ON_ERROR',
          validRows: stockRows,
          organizationId: testOrgId
        },
        ownerActor
      );
      expect(stockResult.createdCount).toBe(1);

      // Verify batch created
      const batches = await batchRepo.findByProduct(product.id, testOrgId);
      expect(batches.length).toBe(1);
      expect(batches[0].batchNumber).toBe('DL65-2026');
      expect(batches[0].currentStockQuantity).toBe(300);
      expect(batches[0].purchasePricePerUnit).toBe(150);

      // Verify stock movement ledger
      const movements = await movementRepo.findByProduct(product.id, testOrgId);
      expect(movements.length).toBe(1);
      expect(movements[0].movementType).toBe('ADJUSTMENT_IN');
      expect(movements[0].quantityChange).toBe(300);
      expect(movements[0].balanceAfter).toBe(300);
      expect(movements[0].referenceType).toBe('OPENING_STOCK_IMPORT');
    });

    it('should record tamper-evident audit log events on bulk import execution', async () => {
      const validRows = [
        { supplier_name: 'Evergreen Pharma', gstin: '29ABCDE1234F1Z5', phone: '080-23456789' }
      ];

      const res = await importService.executeImport(
        {
          importType: 'SUPPLIERS',
          fileName: 'suppliers.csv',
          policy: 'REJECT_ALL_ON_ERROR',
          validRows,
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(res.createdCount).toBe(1);
      const auditEvents = await auditRepo.listRecent(10);
      const importEvent = auditEvents.find((e: AuditEvent) => e.action === AuditAction.DATA_IMPORTED);
      expect(importEvent).toBeDefined();
      expect(importEvent?.metadata?.importType).toBe('SUPPLIERS');
      expect(importEvent?.metadata?.createdCount).toBe(1);
    });
  });
});
