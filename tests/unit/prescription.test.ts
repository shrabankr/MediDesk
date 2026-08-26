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
  SqlitePrescriptionRepository,
  SqliteAllergyRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { PrescriptionService } from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  RoleName,
  SessionUser,
  DrugAllergyWarningError
} from '@medidesk/domain';

describe('Phase 4: Prescription Versioning, Allergy Interlock & Pharmacy Boundary Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let rxRepo: SqlitePrescriptionRepository;
  let allergyRepo: SqliteAllergyRepository;
  let auditRepo: SqliteAuditRepository;
  let rxService: PrescriptionService;

  let orgId: string;
  let doctorUser: SessionUser;
  let patientId: string;
  let doctorId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-rx-test-'));
    const testDbPath = path.join(testDir, 'rx_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    rxRepo = new SqlitePrescriptionRepository(db);
    allergyRepo = new SqliteAllergyRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    rxService = new PrescriptionService(
      rxRepo,
      patientRepo,
      doctorRepo,
      auditService,
      rbac,
      allergyRepo
    );

    const org = await orgRepo.create({
      name: 'Apex Clinic',
      code: 'APEX',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
    });
    orgId = org.id;

    const docUser = await userRepo.create({
      organizationId: orgId,
      username: 'drgupta',
      email: 'gupta@apex.in',
      fullName: 'Dr. Gupta',
      passwordHash: 'hash123',
      roles: [RoleName.DOCTOR]
    });

    doctorUser = {
      id: docUser.id,
      organizationId: orgId,
      organizationName: org.name,
      username: docUser.username,
      email: docUser.email,
      fullName: docUser.fullName,
      roles: [RoleName.DOCTOR],
      permissions: [],
      createdAt: docUser.createdAt,
      updatedAt: docUser.updatedAt,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0
    };

    const doc = await doctorRepo.create({
      organizationId: orgId,
      displayName: 'Dr. Gupta',
      qualification: 'MBBS, DNB',
      specialization: 'Internal Medicine',
      userId: docUser.id
    });
    doctorId = doc.id;

    const patient = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Vikram Joshi',
      age: 50,
      sex: 'MALE',
      mobile: '9811223344'
    });
    patientId = patient.id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('authors and signs a prescription with structured items', async () => {
    const rx = await rxService.createPrescription(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        items: [
          {
            medicineName: 'Paracetamol',
            genericName: 'Acetaminophen',
            strength: '650mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '1-0-1',
            durationValue: 5,
            durationUnit: 'DAYS',
            instructions: 'After food',
            quantity: 10,
            isSubstitutionAllowed: true
          },
          {
            medicineName: 'Cetirizine',
            genericName: 'Cetirizine Hydrochloride',
            strength: '10mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '0-0-1',
            durationValue: 3,
            durationUnit: 'DAYS',
            instructions: 'At bedtime',
            quantity: 3,
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorUser
    );

    expect(rx.id).toBeDefined();
    expect(rx.status).toBe('DRAFT');
    expect(rx.currentVersionNumber).toBe(1);
    expect(rx.currentVersion?.items.length).toBe(2);

    // Sign Prescription
    const signed = await rxService.signPrescription(
      {
        prescriptionId: rx.id,
        organizationId: orgId
      },
      doctorUser
    );

    expect(signed.status).toBe('SIGNED');
  });

  it('revises a signed prescription and increments version number with audit reason', async () => {
    const rx = await rxService.createPrescription(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        items: [
          {
            medicineName: 'Amoxicillin',
            strength: '500mg',
            dosageForm: 'CAPSULE',
            route: 'ORAL',
            frequency: '1-1-1',
            durationValue: 5,
            durationUnit: 'DAYS',
            quantity: 15,
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorUser
    );

    await rxService.signPrescription({ prescriptionId: rx.id, organizationId: orgId }, doctorUser);

    // Revise signed prescription
    const revised = await rxService.revisePrescription(
      {
        organizationId: orgId,
        prescriptionId: rx.id,
        reasonForChange: 'Patient reports severe nausea, switched to Azithromycin',
        items: [
          {
            medicineName: 'Azithromycin',
            strength: '500mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '1-0-0',
            durationValue: 3,
            durationUnit: 'DAYS',
            quantity: 3,
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorUser
    );

    expect(revised.currentVersionNumber).toBe(2);
    expect(revised.currentVersion?.versionNumber).toBe(2);
    expect(revised.currentVersion?.reasonForChange).toContain('switched to Azithromycin');
    expect(revised.currentVersion?.items[0].medicineName).toBe('Azithromycin');

    // Check version history
    const versions = await rxService.getPrescriptionVersions(rx.id, orgId, doctorUser);
    expect(versions.length).toBe(2);
    expect(versions[0].status).toBe('SUPERSEDED');
    expect(versions[1].status).toBe('ACTIVE');
  });

  it('triggers drug allergy warning on conflicting prescription item', async () => {
    // Record known allergy to Ciprofloxacin
    await allergyRepo.create({
      organizationId: orgId,
      patientId,
      status: 'KNOWN',
      allergenName: 'Ciprofloxacin',
      category: 'DRUG',
      severity: 'SEVERE',
      recordedBy: doctorUser.id
    });

    // Attempt to prescribe Ciprofloxacin -> MUST trigger DrugAllergyWarningError
    await expect(
      rxService.createPrescription(
        {
          organizationId: orgId,
          patientId,
          doctorId,
          items: [
            {
              medicineName: 'Ciprofloxacin',
              strength: '500mg',
              dosageForm: 'TABLET',
              route: 'ORAL',
              frequency: '1-0-1',
              durationValue: 5,
              durationUnit: 'DAYS',
              quantity: 10,
              isSubstitutionAllowed: true
            }
          ]
        },
        doctorUser
      )
    ).rejects.toThrow(DrugAllergyWarningError);

    // Overriding with ignoreAllergyWarning explicitly allowed for clinician judgment
    const forcedRx = await rxService.createPrescription(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        items: [
          {
            medicineName: 'Ciprofloxacin',
            strength: '500mg',
            dosageForm: 'TABLET',
            route: 'ORAL',
            frequency: '1-0-1',
            durationValue: 5,
            durationUnit: 'DAYS',
            quantity: 10,
            isSubstitutionAllowed: true
          }
        ]
      },
      doctorUser,
      { ignoreAllergyWarning: true }
    );

    expect(forcedRx.id).toBeDefined();
  });

  it('cancels a prescription with mandatory reason', async () => {
    const rx = await rxService.createPrescription(
      {
        organizationId: orgId,
        patientId,
        doctorId,
        items: [
          {
            medicineName: 'Ibuprofen',
            strength: '400mg',
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

    const cancelled = await rxService.cancelPrescription(
      {
        organizationId: orgId,
        prescriptionId: rx.id,
        reason: 'Prescription entered by mistake on wrong patient file'
      },
      doctorUser
    );

    expect(cancelled.status).toBe('CANCELLED');
  });
});
