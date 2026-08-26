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
  SqliteVitalsRepository,
  SqliteAllergyRepository,
  SqliteMedicalHistoryRepository,
  SqliteDiagnosisRepository,
  SqliteFollowUpRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { PatientMedicalRecordService } from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { RoleName, SessionUser } from '@medidesk/domain';

describe('Phase 4: Vitals, Allergies, Medical History & Diagnoses Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let vitalsRepo: SqliteVitalsRepository;
  let allergyRepo: SqliteAllergyRepository;
  let historyRepo: SqliteMedicalHistoryRepository;
  let diagnosisRepo: SqliteDiagnosisRepository;
  let followUpRepo: SqliteFollowUpRepository;
  let auditRepo: SqliteAuditRepository;
  let medicalRecordService: PatientMedicalRecordService;

  let orgId: string;
  let doctorUser: SessionUser;
  let staffUser: SessionUser;
  let patientId: string;
  let doctorId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-medrecords-test-'));
    const testDbPath = path.join(testDir, 'medrecords_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    vitalsRepo = new SqliteVitalsRepository(db);
    allergyRepo = new SqliteAllergyRepository(db);
    historyRepo = new SqliteMedicalHistoryRepository(db);
    diagnosisRepo = new SqliteDiagnosisRepository(db);
    followUpRepo = new SqliteFollowUpRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    medicalRecordService = new PatientMedicalRecordService(
      vitalsRepo,
      allergyRepo,
      historyRepo,
      diagnosisRepo,
      followUpRepo,
      patientRepo,
      auditService,
      rbac
    );

    const org = await orgRepo.create({
      name: 'LifeCare Clinic',
      code: 'LCC',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
    });
    orgId = org.id;

    const docUserEntity = await userRepo.create({
      organizationId: orgId,
      username: 'drverma',
      email: 'verma@lifecare.in',
      fullName: 'Dr. Verma',
      passwordHash: 'hash123',
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
      username: 'nurse_anita',
      email: 'anita@lifecare.in',
      fullName: 'Anita RN',
      passwordHash: 'hash123',
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

    const doc = await doctorRepo.create({
      organizationId: orgId,
      displayName: 'Dr. Verma',
      qualification: 'MBBS',
      specialization: 'General Physician',
      userId: docUserEntity.id
    });
    doctorId = doc.id;

    const patient = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Sunita Roy',
      age: 38,
      sex: 'FEMALE',
      mobile: '9123456780'
    });
    patientId = patient.id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  // Vitals
  it('records vitals with explicit units and calculates BMI automatically', async () => {
    const vitals = await medicalRecordService.recordVitals(
      {
        organizationId: orgId,
        patientId,
        temperature: 99.2,
        temperatureUnit: 'FAHRENHEIT',
        systolicBp: 130,
        diastolicBp: 85,
        pulseRate: 78,
        respiratoryRate: 18,
        oxygenSaturationSpo2: 98,
        weightKg: 70,
        heightCm: 175
      },
      staffUser
    );

    expect(vitals.temperature).toBe(99.2);
    expect(vitals.temperatureUnit).toBe('FAHRENHEIT');
    expect(vitals.systolicBp).toBe(130);
    expect(vitals.diastolicBp).toBe(85);
    // Calculated BMI for 70kg, 1.75m: 70 / (1.75^2) = 22.86 -> 22.9
    expect(vitals.bmi).toBe(22.9);
  });

  // Allergies
  it('records active drug allergy and lists by patient', async () => {
    const allergy = await medicalRecordService.recordAllergy(
      {
        organizationId: orgId,
        patientId,
        status: 'KNOWN',
        allergenName: 'Amoxicillin',
        category: 'DRUG',
        severity: 'SEVERE',
        reaction: 'Urticaria and facial swelling'
      },
      doctorUser
    );

    expect(allergy.status).toBe('KNOWN');
    expect(allergy.allergenName).toBe('Amoxicillin');
    expect(allergy.severity).toBe('SEVERE');

    const list = await medicalRecordService.listAllergiesByPatient(patientId, orgId, doctorUser);
    expect(list.length).toBe(1);
    expect(list[0].allergenName).toBe('Amoxicillin');
  });

  it('records explicit DENIED allergy status (NKDA)', async () => {
    const allergy = await medicalRecordService.recordAllergy(
      {
        organizationId: orgId,
        patientId,
        status: 'DENIED',
        category: 'DRUG',
        severity: 'MODERATE',
        notes: 'Patient explicitly confirmed no known medication allergies'
      },
      doctorUser
    );

    expect(allergy.status).toBe('DENIED');
    expect(allergy.allergenName).toBeUndefined();
  });

  // Medical History
  it('records past medical and surgical history categories', async () => {
    const medHistory = await medicalRecordService.recordMedicalHistory(
      {
        organizationId: orgId,
        patientId,
        category: 'PAST_MEDICAL',
        description: 'Type 2 Diabetes Mellitus',
        diagnosedDate: '2019',
        isActive: true
      },
      doctorUser
    );

    const surgHistory = await medicalRecordService.recordMedicalHistory(
      {
        organizationId: orgId,
        patientId,
        category: 'PAST_SURGICAL',
        description: 'Appendectomy',
        diagnosedDate: '2015',
        isActive: false
      },
      doctorUser
    );

    expect(medHistory.category).toBe('PAST_MEDICAL');
    expect(surgHistory.category).toBe('PAST_SURGICAL');

    const historyList = await medicalRecordService.listMedicalHistoryByPatient(patientId, orgId, doctorUser);
    expect(historyList.length).toBe(2);
  });

  // Diagnoses
  it('records primary and secondary clinical diagnoses', async () => {
    const primary = await medicalRecordService.recordDiagnosis(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        diagnosisText: 'Essential Primary Hypertension',
        type: 'PRIMARY',
        status: 'ACTIVE'
      },
      doctorUser
    );

    const secondary = await medicalRecordService.recordDiagnosis(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        diagnosisText: 'Dyslipidemia',
        type: 'SECONDARY',
        status: 'ACTIVE'
      },
      doctorUser
    );

    expect(primary.type).toBe('PRIMARY');
    expect(secondary.type).toBe('SECONDARY');

    const diagnoses = await medicalRecordService.listDiagnosesByPatient(patientId, orgId, doctorUser);
    expect(diagnoses.length).toBe(2);
  });

  // Follow-Up
  it('schedules a follow-up and updates its status', async () => {
    const followUp = await medicalRecordService.scheduleFollowUp(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        followUpDate: '2026-09-01',
        instructions: 'Check fasting blood sugar and review lipid profile'
      },
      staffUser
    );

    expect(followUp.status).toBe('PENDING');
    expect(followUp.followUpDate).toBe('2026-09-01');

    const updated = await medicalRecordService.updateFollowUpStatus(
      {
        organizationId: orgId,
        followUpId: followUp.id,
        status: 'COMPLETED'
      },
      staffUser
    );

    expect(updated.status).toBe('COMPLETED');
  });
});
