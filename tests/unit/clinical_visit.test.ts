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
  SqliteClinicalVisitRepository,
  SqliteClinicalCorrectionRepository,
  SqliteAppointmentRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { ClinicalVisitService } from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  RoleName,
  SessionUser,
  VisitCompletedLockedError,
  DoctorInactiveError
} from '@medidesk/domain';

describe('Phase 4: Clinical Visit Lifecycle & Locking Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let visitRepo: SqliteClinicalVisitRepository;
  let correctionRepo: SqliteClinicalCorrectionRepository;
  let appointmentRepo: SqliteAppointmentRepository;
  let auditRepo: SqliteAuditRepository;
  let clinicalService: ClinicalVisitService;

  let orgId: string;
  let doctorUser: SessionUser;
  let patientId: string;
  let doctorId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-clinical-test-'));
    const testDbPath = path.join(testDir, 'clinical_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    visitRepo = new SqliteClinicalVisitRepository(db);
    correctionRepo = new SqliteClinicalCorrectionRepository(db);
    appointmentRepo = new SqliteAppointmentRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    clinicalService = new ClinicalVisitService(
      visitRepo,
      patientRepo,
      doctorRepo,
      auditService,
      rbac,
      appointmentRepo,
      correctionRepo
    );

    const org = await orgRepo.create({
      name: 'City Care Hospital',
      code: 'CCH',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
    });
    orgId = org.id;

    const user = await userRepo.create({
      organizationId: orgId,
      username: 'drsharma',
      email: 'sharma@citycare.in',
      fullName: 'Dr. Sharma',
      passwordHash: 'hash123',
      roles: [RoleName.DOCTOR]
    });

    doctorUser = {
      id: user.id,
      organizationId: orgId,
      organizationName: org.name,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roles: [RoleName.DOCTOR],
      permissions: [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const doc = await doctorRepo.create({
      organizationId: orgId,
      displayName: 'Dr. Sharma',
      qualification: 'MBBS, MD',
      specialization: 'General Medicine',
      userId: user.id
    });
    doctorId = doc.id;

    const patient = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Ramesh Patel',
      age: 45,
      sex: 'MALE',
      mobile: '9876543210'
    });
    patientId = patient.id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('creates an open clinical visit and records chief complaint', async () => {
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'High fever for 3 days with chills',
        historyOfPresentIllness: 'Gradual onset, responsive to antipyretics'
      },
      doctorUser
    );

    expect(visit.id).toBeDefined();
    expect(visit.status).toBe('OPEN');
    expect(visit.chiefComplaint).toBe('High fever for 3 days with chills');
    expect(visit.patientId).toBe(patientId);
  });

  it('updates an in-progress clinical visit', async () => {
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'Fever'
      },
      doctorUser
    );

    const updated = await clinicalService.updateVisit(
      {
        visitId: visit.id,
        organizationId: orgId,
        examinationNotes: 'Throat erythematous, chest clear bilateral',
        clinicalAssessment: 'Acute Viral Pharyngitis',
        status: 'IN_PROGRESS'
      },
      doctorUser
    );

    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.examinationNotes).toBe('Throat erythematous, chest clear bilateral');
    expect(updated.clinicalAssessment).toBe('Acute Viral Pharyngitis');
  });

  it('completes and locks a clinical visit encounter', async () => {
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'Fever'
      },
      doctorUser
    );

    const completed = await clinicalService.completeVisit(visit.id, orgId, doctorUser);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toBeDefined();

    // Directly updating a completed visit MUST fail
    await expect(
      clinicalService.updateVisit(
        {
          visitId: visit.id,
          organizationId: orgId,
          chiefComplaint: 'Modified complaint silently'
        },
        doctorUser
      )
    ).rejects.toThrow(VisitCompletedLockedError);
  });

  it('supports audited clinical correction workflow on completed visits', async () => {
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'Fever for 2 days'
      },
      doctorUser
    );

    await clinicalService.completeVisit(visit.id, orgId, doctorUser);

    // Apply Audited Clinical Correction
    const corrected = await clinicalService.correctVisit(
      {
        organizationId: orgId,
        resourceType: 'CLINICAL_VISIT',
        resourceId: visit.id,
        reason: 'Patient clarified fever duration was 5 days, not 2 days',
        correctedPayload: {
          chiefComplaint: 'Fever for 5 days with chills'
        }
      },
      doctorUser
    );

    expect(corrected.chiefComplaint).toBe('Fever for 5 days with chills');

    // Verify correction audit history was recorded
    const history = await correctionRepo.listByResource('CLINICAL_VISIT', visit.id, orgId);
    expect(history.length).toBe(1);
    expect(history[0].reason).toContain('Patient clarified fever duration');
  });

  it('rejects clinical visit creation for inactive doctor', async () => {
    await doctorRepo.update(doctorId, { status: 'INACTIVE' });

    await expect(
      clinicalService.createVisit(
        {
          organizationId: orgId,
          patientId,
          doctorId,
          chiefComplaint: 'Headache'
        },
        doctorUser
      )
    ).rejects.toThrow(DoctorInactiveError);
  });
});
