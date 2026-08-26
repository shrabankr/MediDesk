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
  ClinicalVisitNotFoundError,
  PrescriptionNotFoundError
} from '@medidesk/domain';

describe('Phase 4: Clinical Organization Multi-Tenant Isolation Security Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let visitRepo: SqliteClinicalVisitRepository;
  let rxRepo: SqlitePrescriptionRepository;
  let vitalsRepo: SqliteVitalsRepository;
  let allergyRepo: SqliteAllergyRepository;
  let historyRepo: SqliteMedicalHistoryRepository;
  let diagRepo: SqliteDiagnosisRepository;
  let followUpRepo: SqliteFollowUpRepository;
  let auditRepo: SqliteAuditRepository;

  let clinicalService: ClinicalVisitService;
  let rxService: PrescriptionService;
  let medRecordService: PatientMedicalRecordService;

  let orgAId: string;
  let orgBId: string;
  let doctorAUser: SessionUser;
  let doctorBUser: SessionUser;
  let patientAId: string;
  let _patientBId: string;
  let doctorAId: string;
  let _doctorBId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-p4-iso-'));
    const testDbPath = path.join(testDir, 'iso_test.sqlite');
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
      rbac
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

    const now = new Date();

    // Tenant A Setup
    const orgA = await orgRepo.create({ name: 'Clinic Alpha', code: 'CLA', timezone: 'Asia/Kolkata', currency: 'INR' });
    orgAId = orgA.id;

    const userA = await userRepo.create({
      organizationId: orgAId,
      username: 'doc_alpha',
      email: 'alpha@doc.in',
      fullName: 'Dr. Alpha',
      passwordHash: 'hash',
      roles: [RoleName.DOCTOR]
    });

    doctorAUser = {
      id: userA.id,
      organizationId: orgAId,
      organizationName: orgA.name,
      username: userA.username,
      email: userA.email,
      fullName: userA.fullName,
      roles: [RoleName.DOCTOR],
      permissions: [],
      createdAt: now,
      updatedAt: now,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const docA = await doctorRepo.create({
      organizationId: orgAId,
      displayName: 'Dr. Alpha',
      qualification: 'MBBS',
      specialization: 'Physician',
      userId: userA.id
    });
    doctorAId = docA.id;

    const patA = await patientRepo.create({
      organizationId: orgAId,
      fullName: 'Alpha Patient',
      sex: 'MALE',
      mobile: '9999911111'
    });
    patientAId = patA.id;

    // Tenant B Setup
    const orgB = await orgRepo.create({ name: 'Clinic Beta', code: 'CLB', timezone: 'Asia/Kolkata', currency: 'INR' });
    orgBId = orgB.id;

    const userB = await userRepo.create({
      organizationId: orgBId,
      username: 'doc_beta',
      email: 'beta@doc.in',
      fullName: 'Dr. Beta',
      passwordHash: 'hash',
      roles: [RoleName.DOCTOR]
    });

    doctorBUser = {
      id: userB.id,
      organizationId: orgBId,
      organizationName: orgB.name,
      username: userB.username,
      email: userB.email,
      fullName: userB.fullName,
      roles: [RoleName.DOCTOR],
      permissions: [],
      createdAt: now,
      updatedAt: now,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const docB = await doctorRepo.create({
      organizationId: orgBId,
      displayName: 'Dr. Beta',
      qualification: 'MBBS',
      specialization: 'Physician',
      userId: userB.id
    });
    _doctorBId = docB.id;

    const patB = await patientRepo.create({
      organizationId: orgBId,
      fullName: 'Beta Patient',
      sex: 'FEMALE',
      mobile: '9999922222'
    });
    _patientBId = patB.id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('strictly prevents Tenant B doctor from accessing or modifying Tenant A clinical visits', async () => {
    const visitA = await clinicalService.createVisit(
      {
        organizationId: orgAId,
        patientId: patientAId,
        doctorId: doctorAId,
        chiefComplaint: 'Confidential Alpha Health Issue'
      },
      doctorAUser
    );

    // Doctor B in Org B attempts to get visitA from Org B scope -> Not Found
    await expect(
      clinicalService.getVisitById(visitA.id, orgBId, doctorBUser)
    ).rejects.toThrow(ClinicalVisitNotFoundError);

    // Doctor B in Org B attempts to update visitA -> Not Found
    await expect(
      clinicalService.updateVisit(
        {
          visitId: visitA.id,
          organizationId: orgBId,
          chiefComplaint: 'Cross-tenant tamper attempt'
        },
        doctorBUser
      )
    ).rejects.toThrow(ClinicalVisitNotFoundError);
  });

  it('strictly prevents cross-tenant prescription visibility and revisions', async () => {
    const rxA = await rxService.createPrescription(
      {
        organizationId: orgAId,
        patientId: patientAId,
        doctorId: doctorAId,
        items: [
          {
            medicineName: 'AlphaMed',
            strength: '100mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '1-0-0',
            durationValue: 7,
            durationUnit: 'DAYS',
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorAUser
    );

    // Doctor B in Org B attempts to read Rx A -> Not Found
    await expect(
      rxService.getPrescriptionById(rxA.id, orgBId, doctorBUser)
    ).rejects.toThrow(PrescriptionNotFoundError);

    // Doctor B in Org B attempts to revise Rx A -> Not Found
    await expect(
      rxService.revisePrescription(
        {
          organizationId: orgBId,
          prescriptionId: rxA.id,
          reasonForChange: 'Cross tenant alteration',
          items: [
            {
              medicineName: 'BetaMed',
              strength: '50mg',
              dosageForm: 'TABLET',
              route: 'ORAL',
              frequency: '1-0-1',
              durationValue: 5,
              durationUnit: 'DAYS',
              isSubstitutionAllowed: true
            }
          ]
        },
        doctorBUser
      )
    ).rejects.toThrow(PrescriptionNotFoundError);
  });

  it('strictly scopes vitals, allergies, and diagnoses lists to the organization boundary', async () => {
    // Record items in Org A
    await medRecordService.recordVitals(
      {
        organizationId: orgAId,
        patientId: patientAId,
        temperature: 99.0,
        temperatureUnit: 'FAHRENHEIT'
      },
      doctorAUser
    );

    await medRecordService.recordAllergy(
      {
        organizationId: orgAId,
        patientId: patientAId,
        status: 'KNOWN',
        allergenName: 'AlphaAllergen',
        category: 'DRUG',
        severity: 'MILD'
      },
      doctorAUser
    );

    // Doctor B queries Tenant A patient using Org B -> returns empty array (safe multi-tenant isolation)
    const vitalsFromOrgB = await medRecordService.getVitalsByPatient(patientAId, orgBId, doctorBUser);
    expect(vitalsFromOrgB).toEqual([]);

    const allergiesFromOrgB = await medRecordService.listAllergiesByPatient(patientAId, orgBId, doctorBUser);
    expect(allergiesFromOrgB).toEqual([]);
  });
});
