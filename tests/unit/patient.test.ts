import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqlitePatientRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { PatientService } from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { RoleName, SessionUser, DuplicatePatientWarningError, AuthorizationError } from '@medidesk/domain';

describe('Phase 3: Patient Management & Duplicate Detection', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let auditRepo: SqliteAuditRepository;
  let patientService: PatientService;

  let ownerUser: SessionUser;
  let staffUser: SessionUser;
  let developerUser: SessionUser;
  let orgId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-patient-test-'));
    const testDbPath = path.join(testDir, 'patient_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();

    patientService = new PatientService(patientRepo, auditService, rbacEngine);

    const org = await orgRepo.create({
      name: 'City Care Clinic',
      code: 'CITY_CARE',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
    orgId = org.id;

    const u1 = await userRepo.create({
      organizationId: orgId,
      username: 'owner_dr',
      email: 'dr@citycare.com',
      fullName: 'Dr. Owner',
      passwordHash: 'dummy',
      roles: [RoleName.OWNER]
    });
    ownerUser = {
      id: u1.id,
      organizationId: orgId,
      organizationName: org.name,
      username: u1.username,
      fullName: u1.fullName,
      email: u1.email,
      roles: [RoleName.OWNER],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const u2 = await userRepo.create({
      organizationId: orgId,
      username: 'reception_staff',
      email: 'staff@citycare.com',
      fullName: 'Reception Staff',
      passwordHash: 'dummy',
      roles: [RoleName.STAFF]
    });
    staffUser = {
      id: u2.id,
      organizationId: orgId,
      organizationName: org.name,
      username: u2.username,
      fullName: u2.fullName,
      email: u2.email,
      roles: [RoleName.STAFF],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const u3 = await userRepo.create({
      organizationId: orgId,
      username: 'it_developer',
      email: 'dev@citycare.com',
      fullName: 'Tech Support Developer',
      passwordHash: 'dummy',
      roles: [RoleName.DEVELOPER]
    });
    developerUser = {
      id: u3.id,
      organizationId: orgId,
      organizationName: org.name,
      username: u3.username,
      fullName: u3.fullName,
      email: u3.email,
      roles: [RoleName.DEVELOPER],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('generates sequential human-friendly patient numbers (MD-000001, MD-000002)', async () => {
    const p1 = await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Rahul Sharma',
        sex: 'MALE',
        mobile: '9876543210',
        age: 30
      },
      staffUser
    );

    const p2 = await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Priya Verma',
        sex: 'FEMALE',
        mobile: '9876500000',
        age: 28
      },
      staffUser
    );

    expect(p1.patientNumber).toBe('MD-000001');
    expect(p2.patientNumber).toBe('MD-000002');
  });

  it('detects strong duplicate match on exact normalized 10-digit mobile number and prevents silent duplicate', async () => {
    await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Amit Kumar',
        sex: 'MALE',
        mobile: '91-98765 12345', // formats will normalize to 9876512345
        age: 35
      },
      staffUser
    );

    // Attempt to register with slightly different name formatting and exact same mobile
    await expect(
      patientService.registerPatient(
        {
          organizationId: orgId,
          fullName: 'Amit K',
          sex: 'MALE',
          mobile: '9876512345',
          age: 35
        },
        staffUser
      )
    ).rejects.toThrow(DuplicatePatientWarningError);
  });

  it('allows staff to override and force registration on duplicate warning if genuinely separate patient', async () => {
    const p1 = await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Sunita Patel',
        sex: 'FEMALE',
        mobile: '9988776655',
        age: 45
      },
      staffUser
    );

    // Same family member using the same mobile number with different name
    const p2 = await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Kavita Patel (Daughter)',
        sex: 'FEMALE',
        mobile: '9988776655',
        age: 18
      },
      staffUser,
      { forceCreateOnDuplicate: true }
    );

    expect(p2.patientNumber).toBe('MD-000002');
    expect(p2.id).not.toBe(p1.id);
  });

  it('searches patients efficiently by ID, name, and mobile', async () => {
    await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Vikram Singh Rathore',
        sex: 'MALE',
        mobile: '9123456789',
        age: 50
      },
      staffUser
    );

    // 1. Search by exact ID
    const byId = await patientService.searchPatients({ organizationId: orgId, query: 'MD-000001' }, staffUser);
    expect(byId.length).toBe(1);
    expect(byId[0].fullName).toBe('Vikram Singh Rathore');

    // 2. Search by partial name
    const byName = await patientService.searchPatients({ organizationId: orgId, query: 'vikram' }, staffUser);
    expect(byName.length).toBe(1);

    // 3. Search by partial mobile
    const byMobile = await patientService.searchPatients({ organizationId: orgId, query: '456789' }, staffUser);
    expect(byMobile.length).toBe(1);
  });

  it('updates patient details and generates audit records', async () => {
    const p = await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Deepak Gupta',
        sex: 'MALE',
        mobile: '9000011111',
        age: 40
      },
      staffUser
    );

    const updated = await patientService.updatePatient(
      {
        patientId: p.id,
        address: '45 Lake View Road, Bangalore',
        emergencyContactName: 'Geeta Gupta',
        emergencyContactPhone: '9000022222'
      },
      orgId,
      staffUser
    );

    expect(updated.address).toBe('45 Lake View Road, Bangalore');
    expect(updated.emergencyContactName).toBe('Geeta Gupta');

    const auditLogs = await auditRepo.listRecent(10);
    const updateLog = auditLogs.find((l) => l.action === 'PATIENT_UPDATED');
    expect(updateLog).toBeDefined();
    expect(updateLog?.actor.username).toBe('reception_staff');
  });

  it('strictly denies DEVELOPER role from viewing or creating patients', async () => {
    await expect(
      patientService.registerPatient(
        {
          organizationId: orgId,
          fullName: 'Test Patient',
          sex: 'MALE',
          mobile: '9999999999'
        },
        developerUser
      )
    ).rejects.toThrow(AuthorizationError);

    await expect(
      patientService.searchPatients({ organizationId: orgId, query: 'MD' }, developerUser)
    ).rejects.toThrow(AuthorizationError);
  });

  it('allows OWNER to view and manage all patient records', async () => {
    const p = await patientService.registerPatient(
      {
        organizationId: orgId,
        fullName: 'Owner Managed Patient',
        sex: 'FEMALE',
        mobile: '9111122222'
      },
      ownerUser
    );

    const fetched = await patientService.getPatientById(p.id, orgId, ownerUser);
    expect(fetched.fullName).toBe('Owner Managed Patient');
  });
});
