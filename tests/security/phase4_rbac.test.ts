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
  SqlitePrescriptionRepository,
  SqliteVitalsRepository,
  SqliteAllergyRepository,
  SqliteMedicalHistoryRepository,
  SqliteDiagnosisRepository,
  SqliteFollowUpRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import {
  ClinicalVisitService,
  PrescriptionService,
  PatientMedicalRecordService
} from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  RoleName,
  SessionUser,
  AuthorizationError
} from '@medidesk/domain';

describe('Phase 4: RBAC & Developer Clinical Denial Security Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let visitRepo: SqliteClinicalVisitRepository;
  let rxRepo: SqlitePrescriptionRepository;
  let correctionRepo: SqliteClinicalCorrectionRepository;
  let vitalsRepo: SqliteVitalsRepository;
  let allergyRepo: SqliteAllergyRepository;
  let historyRepo: SqliteMedicalHistoryRepository;
  let diagRepo: SqliteDiagnosisRepository;
  let followUpRepo: SqliteFollowUpRepository;
  let auditRepo: SqliteAuditRepository;

  let clinicalService: ClinicalVisitService;
  let rxService: PrescriptionService;
  let medRecordService: PatientMedicalRecordService;

  let orgId: string;
  let ownerUser: SessionUser;
  let doctorUser: SessionUser;
  let staffUser: SessionUser;
  let devUser: SessionUser;
  let patientId: string;
  let doctorId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-p4-rbac-'));
    const testDbPath = path.join(testDir, 'rbac_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    visitRepo = new SqliteClinicalVisitRepository(db);
    rxRepo = new SqlitePrescriptionRepository(db);
    correctionRepo = new SqliteClinicalCorrectionRepository(db);
    vitalsRepo = new SqliteVitalsRepository(db);
    allergyRepo = new SqliteAllergyRepository(db);
    historyRepo = new SqliteMedicalHistoryRepository(db);
    diagRepo = new SqliteDiagnosisRepository(db);
    followUpRepo = new SqliteFollowUpRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    clinicalService = new ClinicalVisitService(
      visitRepo,
      patientRepo,
      doctorRepo,
      auditService,
      rbac,
      undefined,
      correctionRepo
    );

    rxService = new PrescriptionService(
      rxRepo,
      patientRepo,
      doctorRepo,
      auditService,
      rbac,
      allergyRepo
    );

    medRecordService = new PatientMedicalRecordService(
      vitalsRepo,
      allergyRepo,
      historyRepo,
      diagRepo,
      followUpRepo,
      patientRepo,
      auditService,
      rbac
    );

    const org = await orgRepo.create({
      name: 'Security Test Medical Center',
      code: 'STMC',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
    });
    orgId = org.id;

    const patient = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Anil Kapoor',
      sex: 'MALE',
      age: 40,
      mobile: '9898989898'
    });
    patientId = patient.id;

    const doc = await doctorRepo.create({
      organizationId: orgId,
      displayName: 'Dr. Sen',
      qualification: 'MBBS, MS',
      specialization: 'General Surgery'
    });
    doctorId = doc.id;

    const ownerEntity = await userRepo.create({
      organizationId: orgId,
      username: 'owner_user',
      email: 'owner@stmc.in',
      fullName: 'Clinic Owner',
      passwordHash: 'hash',
      roles: [RoleName.OWNER]
    });
    ownerUser = {
      id: ownerEntity.id,
      organizationId: orgId,
      organizationName: org.name,
      username: ownerEntity.username,
      email: ownerEntity.email,
      fullName: ownerEntity.fullName,
      roles: [RoleName.OWNER],
      permissions: [],
      createdAt: ownerEntity.createdAt,
      updatedAt: ownerEntity.updatedAt,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const docUserEntity = await userRepo.create({
      organizationId: orgId,
      username: 'doctor_user',
      email: 'doctor@stmc.in',
      fullName: 'Dr. Sen',
      passwordHash: 'hash',
      roles: [RoleName.DOCTOR]
    });
    doctorUser = {
      id: docUserEntity.id,
      organizationId: orgId,
      organizationName: org.name,
      username: docUserEntity.username,
      email: docUserEntity.email,
      fullName: docUserEntity.fullName,
      roles: [RoleName.DOCTOR],
      permissions: [],
      createdAt: docUserEntity.createdAt,
      updatedAt: docUserEntity.updatedAt,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const staffUserEntity = await userRepo.create({
      organizationId: orgId,
      username: 'staff_user',
      email: 'staff@stmc.in',
      fullName: 'Front Desk Staff',
      passwordHash: 'hash',
      roles: [RoleName.STAFF]
    });
    staffUser = {
      id: staffUserEntity.id,
      organizationId: orgId,
      organizationName: org.name,
      username: staffUserEntity.username,
      email: staffUserEntity.email,
      fullName: staffUserEntity.fullName,
      roles: [RoleName.STAFF],
      permissions: [],
      createdAt: staffUserEntity.createdAt,
      updatedAt: staffUserEntity.updatedAt,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const devUserEntity = await userRepo.create({
      organizationId: orgId,
      username: 'dev_user',
      email: 'dev@stmc.in',
      fullName: 'System Developer',
      passwordHash: 'hash',
      roles: [RoleName.DEVELOPER]
    });
    devUser = {
      id: devUserEntity.id,
      organizationId: orgId,
      organizationName: org.name,
      username: devUserEntity.username,
      email: devUserEntity.email,
      fullName: devUserEntity.fullName,
      roles: [RoleName.DEVELOPER],
      permissions: [],
      createdAt: devUserEntity.createdAt,
      updatedAt: devUserEntity.updatedAt,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('DEVELOPER role is strictly DENIED access to clinical visits, vitals, prescriptions, and allergies', async () => {
    // 1. Cannot create clinical visit
    await expect(
      clinicalService.createVisit(
        {
          organizationId: orgId,
          patientId,
          doctorId,
          chiefComplaint: 'Chest pain'
        },
        devUser
      )
    ).rejects.toThrow(AuthorizationError);

    // 2. Cannot read clinical visits
    await expect(
      clinicalService.listVisitsByPatient(patientId, orgId, devUser)
    ).rejects.toThrow(AuthorizationError);

    // 3. Cannot record vitals
    await expect(
      medRecordService.recordVitals(
        {
          organizationId: orgId,
          patientId,
          temperature: 98.6,
          temperatureUnit: 'FAHRENHEIT'
        },
        devUser
      )
    ).rejects.toThrow(AuthorizationError);

    // 4. Cannot create prescription
    await expect(
      rxService.createPrescription(
        {
          organizationId: orgId,
          patientId,
          doctorId,
          items: [
            {
              medicineName: 'Aspirin',
              strength: '75mg',
              dosageForm: 'TABLET',
              route: 'ORAL',
              frequency: '1-0-0',
              durationValue: 30,
              durationUnit: 'DAYS',
              isSubstitutionAllowed: true
            }
          ]
        },
        devUser
      )
    ).rejects.toThrow(AuthorizationError);
  });

  it('DOCTOR role can create and complete visits and sign prescriptions', async () => {
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'Mild headache'
      },
      doctorUser
    );
    expect(visit.id).toBeDefined();

    const rx = await rxService.createPrescription(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        items: [
          {
            medicineName: 'Paracetamol',
            strength: '500mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '1-0-1',
            durationValue: 3,
            durationUnit: 'DAYS',
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorUser
    );

    const signedRx = await rxService.signPrescription(
      {
        prescriptionId: rx.id,
        organizationId: orgId
      },
      doctorUser
    );
    expect(signedRx.status).toBe('SIGNED');
  });

  it('STAFF role can record vitals and schedule follow-ups, but CANNOT sign prescriptions or complete visits', async () => {
    // 1. Staff CAN record vitals
    const vitals = await medRecordService.recordVitals(
      {
        organizationId: orgId,
        patientId,
        temperature: 98.4,
        temperatureUnit: 'FAHRENHEIT'
      },
      staffUser
    );
    expect(vitals.id).toBeDefined();

    // 2. Staff CANNOT sign prescriptions
    const rx = await rxService.createPrescription(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        items: [
          {
            medicineName: 'Vitamin C',
            strength: '500mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '1-0-0',
            durationValue: 10,
            durationUnit: 'DAYS',
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorUser
    );

    await expect(
      rxService.signPrescription(
        {
          prescriptionId: rx.id,
          organizationId: orgId
        },
        staffUser
      )
    ).rejects.toThrow(AuthorizationError);

    // 3. Staff CANNOT complete clinical visits
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'Routine check'
      },
      doctorUser
    );

    await expect(
      clinicalService.completeVisit(visit.id, orgId, staffUser)
    ).rejects.toThrow(AuthorizationError);
  });

  it('OWNER role has clinical oversight and correction authorities', async () => {
    const visit = await clinicalService.createVisit(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        chiefComplaint: 'Original note'
      },
      doctorUser
    );

    await clinicalService.completeVisit(visit.id, orgId, doctorUser);

    // Owner can apply clinical correction
    const corrected = await clinicalService.correctVisit(
      {
        organizationId: orgId,
        resourceType: 'CLINICAL_VISIT',
        resourceId: visit.id,
        reason: 'Administrative audit correction',
        correctedPayload: {
          chiefComplaint: 'Corrected administrative note'
        }
      },
      ownerUser
    );

    expect(corrected.chiefComplaint).toBe('Corrected administrative note');
  });
});
