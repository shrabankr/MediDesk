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
  SqliteDoctorRepository,
  SqliteAppointmentRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AppointmentService, PatientService, DoctorService } from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  RoleName,
  SessionUser,
  PatientNotFoundError,
  DoctorNotFoundError
} from '@medidesk/domain';

describe('Multi-Tenant Organization Isolation Security Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let appointmentRepo: SqliteAppointmentRepository;
  let auditRepo: SqliteAuditRepository;

  let appointmentService: AppointmentService;
  let patientService: PatientService;
  let doctorService: DoctorService;

  let orgA_Id: string;
  let orgB_Id: string;

  let staffUserA: SessionUser;
  let staffUserB: SessionUser;

  let patientA_Id: string;
  let patientB_Id: string;

  let doctorA_Id: string;
  let doctorB_Id: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-org-isolation-test-'));
    const testDbPath = path.join(testDir, 'isolation_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    appointmentRepo = new SqliteAppointmentRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();

    patientService = new PatientService(patientRepo, auditService, rbacEngine);
    doctorService = new DoctorService(doctorRepo, auditService, rbacEngine);
    appointmentService = new AppointmentService(
      appointmentRepo,
      patientRepo,
      doctorRepo,
      auditService,
      rbacEngine
    );

    // Create Organization A
    const orgA = await orgRepo.create({
      name: 'City Care Hospital A',
      code: 'ORG_A',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
    orgA_Id = orgA.id;

    // Create Organization B
    const orgB = await orgRepo.create({
      name: 'Apex Clinic B',
      code: 'ORG_B',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
    orgB_Id = orgB.id;

    // Staff User A in Org A
    const uA = await userRepo.create({
      organizationId: orgA_Id,
      username: 'staff_org_a',
      email: 'staff@orga.com',
      fullName: 'Staff Org A',
      passwordHash: 'dummy',
      roles: [RoleName.STAFF]
    });
    staffUserA = {
      id: uA.id,
      organizationId: orgA_Id,
      organizationName: orgA.name,
      username: uA.username,
      fullName: uA.fullName,
      email: uA.email,
      roles: [RoleName.STAFF],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Staff User B in Org B
    const uB = await userRepo.create({
      organizationId: orgB_Id,
      username: 'staff_org_b',
      email: 'staff@orgb.com',
      fullName: 'Staff Org B',
      passwordHash: 'dummy',
      roles: [RoleName.STAFF]
    });
    staffUserB = {
      id: uB.id,
      organizationId: orgB_Id,
      organizationName: orgB.name,
      username: uB.username,
      fullName: uB.fullName,
      email: uB.email,
      roles: [RoleName.STAFF],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Owner User A in Org A
    const ownerUA = await userRepo.create({
      organizationId: orgA_Id,
      username: 'owner_org_a',
      email: 'owner@orga.com',
      fullName: 'Owner Org A',
      passwordHash: 'dummy',
      roles: [RoleName.OWNER]
    });
    const ownerUserA: SessionUser = {
      id: ownerUA.id,
      organizationId: orgA_Id,
      organizationName: orgA.name,
      username: ownerUA.username,
      fullName: ownerUA.fullName,
      email: ownerUA.email,
      roles: [RoleName.OWNER],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Owner User B in Org B
    const ownerUB = await userRepo.create({
      organizationId: orgB_Id,
      username: 'owner_org_b',
      email: 'owner@orgb.com',
      fullName: 'Owner Org B',
      passwordHash: 'dummy',
      roles: [RoleName.OWNER]
    });
    const ownerUserB: SessionUser = {
      id: ownerUB.id,
      organizationId: orgB_Id,
      organizationName: orgB.name,
      username: ownerUB.username,
      fullName: ownerUB.fullName,
      email: ownerUB.email,
      roles: [RoleName.OWNER],
      permissions: [],
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Patient in Org A
    const pA = await patientService.registerPatient(
      { organizationId: orgA_Id, fullName: 'Org A Patient', sex: 'MALE', mobile: '9111111111' },
      staffUserA
    );
    patientA_Id = pA.id;

    // Patient in Org B
    const pB = await patientService.registerPatient(
      { organizationId: orgB_Id, fullName: 'Org B Patient', sex: 'FEMALE', mobile: '9222222222' },
      staffUserB
    );
    patientB_Id = pB.id;

    // Doctor in Org A (created by Owner A)
    const docA = await doctorService.createDoctor(
      { organizationId: orgA_Id, displayName: 'Dr. Alpha (Org A)', qualification: 'MBBS', specialization: 'Cardiology' },
      ownerUserA
    );
    doctorA_Id = docA.id;

    // Doctor in Org B (created by Owner B)
    const docB = await doctorService.createDoctor(
      { organizationId: orgB_Id, displayName: 'Dr. Beta (Org B)', qualification: 'MBBS', specialization: 'Neurology' },
      ownerUserB
    );
    doctorB_Id = docB.id;
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('prevents User from Org A from searching or retrieving Patients of Org B', async () => {
    // 1. Search in Org A does NOT return Org B patient
    const results = await patientService.searchPatients({ organizationId: orgA_Id, query: 'Org B' }, staffUserA);
    expect(results.length).toBe(0);

    // 2. Direct lookup of Org B patient with Org A context throws PatientNotFoundError
    await expect(patientService.getPatientById(patientB_Id, orgA_Id, staffUserA)).rejects.toThrow(PatientNotFoundError);
  });

  it('prevents User from Org A from updating Patients of Org B', async () => {
    await expect(
      patientService.updatePatient(
        { patientId: patientB_Id, fullName: 'Tampered Name' },
        orgA_Id,
        staffUserA
      )
    ).rejects.toThrow(PatientNotFoundError);

    // Verify Org B patient was NOT modified
    const untouched = await patientService.getPatientById(patientB_Id, orgB_Id, staffUserB);
    expect(untouched.fullName).toBe('Org B Patient');
  });

  it('prevents User from Org A from viewing or modifying Doctors of Org B', async () => {
    // 1. Listing doctors in Org A only returns Org A doctors
    const doctorsA = await doctorService.listDoctors(orgA_Id, staffUserA);
    expect(doctorsA.some((d) => d.id === doctorB_Id)).toBe(false);
    expect(doctorsA.some((d) => d.id === doctorA_Id)).toBe(true);

    // 2. Direct lookup of Org B doctor with Org A context throws DoctorNotFoundError
    await expect(doctorService.getDoctorById(doctorB_Id, orgA_Id, staffUserA)).rejects.toThrow(DoctorNotFoundError);
  });

  it('prevents User from Org A from booking appointments with Org B Patient or Doctor', async () => {
    // Attempt booking Org B Patient in Org A
    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgA_Id,
          patientId: patientB_Id,
          doctorId: doctorA_Id,
          appointmentDate: '2026-08-24',
          startTime: '10:00',
          durationMinutes: 15
        },
        staffUserA
      )
    ).rejects.toThrow(PatientNotFoundError);

    // Attempt booking Org B Doctor in Org A
    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgA_Id,
          patientId: patientA_Id,
          doctorId: doctorB_Id,
          appointmentDate: '2026-08-24',
          startTime: '10:00',
          durationMinutes: 15
        },
        staffUserA
      )
    ).rejects.toThrow(DoctorNotFoundError);
  });

  it('ensures separate sequential patient numbering per organization (MD-000001 in both orgs)', async () => {
    const patientA = await patientService.getPatientById(patientA_Id, orgA_Id, staffUserA);
    const patientB = await patientService.getPatientById(patientB_Id, orgB_Id, staffUserB);

    // Both organizations have their own MD-000001
    expect(patientA.patientNumber).toBe('MD-000001');
    expect(patientB.patientNumber).toBe('MD-000001');
    expect(patientA.id).not.toBe(patientB.id);
  });
});
