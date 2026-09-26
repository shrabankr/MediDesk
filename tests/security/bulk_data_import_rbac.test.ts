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
import { SessionUser, AuthorizationError } from '@medidesk/domain';
import path from 'path';
import fs from 'fs';

describe('Bulk Data Import Security & RBAC Isolation Tests', () => {
  let db: SqliteDatabase;
  let dbPath: string;
  let importService: BulkDataImportService;
  let auditService: AuditService;
  let rbacEngine: RBACEngine;

  let ownerActor: SessionUser;
  let doctorActor: SessionUser;
  let staffActor: SessionUser;
  let developerActor: SessionUser;
  let testOrgId: string;

  beforeEach(async () => {
    dbPath = path.join(process.cwd(), `test_rbac_import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.sqlite`);
    db = new SqliteDatabase({ databasePath: dbPath });

    const runner = new MigrationRunner(db, path.join(process.cwd(), 'database', 'migrations'));
    runner.runPendingMigrations();

    const auditRepo = new SqliteAuditRepository(db);
    auditService = new AuditService(auditRepo);
    rbacEngine = new RBACEngine();

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
        name: 'MediDesk Security Test Clinic',
        code: 'SEC-TEST',
        currency: 'INR',
        timezone: 'Asia/Kolkata'
      },
      initialOwner: {
        username: 'sec_owner',
        fullName: 'Security Owner',
        email: 'owner@sec.com',
        password: 'Password123!'
      },
      developerToken: 'dev-token-sec-123'
    });

    testOrgId = initResult.organizationId;

    ownerActor = {
      id: initResult.ownerId,
      username: 'sec_owner',
      organizationId: testOrgId,
      email: 'owner@sec.com',
      fullName: 'Security Owner',
      roles: ['OWNER'],
      permissions: ['*'],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    doctorActor = {
      id: 'doc-id-1',
      username: 'sec_doctor',
      organizationId: testOrgId,
      email: 'doc@sec.com',
      fullName: 'Sec Doctor',
      roles: ['DOCTOR'],
      permissions: ['patient.read', 'patient.create'],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    staffActor = {
      id: 'staff-id-1',
      username: 'sec_staff',
      organizationId: testOrgId,
      email: 'staff@sec.com',
      fullName: 'Sec Staff',
      roles: ['STAFF'],
      permissions: ['patient.read', 'patient.create'],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    developerActor = {
      id: 'dev-id-1',
      username: 'sec_dev',
      organizationId: testOrgId,
      email: 'dev@sec.com',
      fullName: 'Sec Developer',
      roles: ['DEVELOPER'],
      permissions: ['system.diagnostics', 'system.config.read'],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const patientRepo = new SqlitePatientRepository(db);
    const doctorRepo = new SqliteDoctorRepository(db);
    const medicineRepo = new SqliteMedicineRepository(db);
    const productRepo = new SqliteMedicineProductRepository(db);
    const packagingRepo = new SqlitePackagingUnitRepository(db);
    const supplierRepo = new SqliteSupplierRepository(db);
    const batchRepo = new SqliteInventoryBatchRepository(db);
    const movementRepo = new SqliteStockMovementRepository(db);

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

  describe('Developer Role Isolation', () => {
    it('should strictly deny DEVELOPER from importing patients', async () => {
      await expect(
        importService.parseAndValidate(
          {
            importType: 'PATIENTS',
            fileName: 'patients.csv',
            fileContent: 'first_name,gender\nRahul,MALE',
            organizationId: testOrgId
          },
          developerActor
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('should strictly deny DEVELOPER from importing medicines or opening stock', async () => {
      await expect(
        importService.parseAndValidate(
          {
            importType: 'OPENING_STOCK',
            fileName: 'stock.csv',
            fileContent: 'medicine_name,batch_number,expiry_date,quantity,purchase_price,mrp\nDolo,B1,2028-12-31,10,1,2',
            organizationId: testOrgId
          },
          developerActor
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Staff & Doctor Role Restrictions', () => {
    it('should deny STAFF from importing user accounts', async () => {
      await expect(
        importService.executeImport(
          {
            importType: 'USERS',
            fileName: 'users.csv',
            policy: 'REJECT_ALL_ON_ERROR',
            validRows: [{ username: 'testuser', full_name: 'Test', email: 'test@clinic.com', role: 'STAFF' }],
            organizationId: testOrgId
          },
          staffActor
        )
      ).rejects.toThrow(AuthorizationError);
    });

    it('should deny DOCTOR from importing opening stock balances', async () => {
      await expect(
        importService.parseAndValidate(
          {
            importType: 'OPENING_STOCK',
            fileName: 'stock.csv',
            fileContent: 'medicine_name,batch_number,expiry_date,quantity,purchase_price,mrp\nDolo,B1,2028-12-31,10,1,2',
            organizationId: testOrgId
          },
          doctorActor
        )
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Unsupported Import Types Handling', () => {
    it('should return isSupported = false for historical appointments', async () => {
      const res = await importService.parseAndValidate(
        {
          importType: 'APPOINTMENTS',
          fileName: 'appointments.csv',
          fileContent: 'patient,doctor,date\nP1,D1,2024-01-01',
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(res.isSupported).toBe(false);
      expect(res.canProceed).toBe(false);
      expect(res.unsupportedReason).toContain('Historical appointment bulk import is disabled');
    });

    it('should return isSupported = false for departments & services', async () => {
      const res = await importService.parseAndValidate(
        {
          importType: 'DEPARTMENTS',
          fileName: 'dept.csv',
          fileContent: 'dept_name\nCardiology',
          organizationId: testOrgId
        },
        ownerActor
      );

      expect(res.isSupported).toBe(false);
      expect(res.canProceed).toBe(false);
    });
  });
});
