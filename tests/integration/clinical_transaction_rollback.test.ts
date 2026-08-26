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
  SqlitePrescriptionRepository
} from '@medidesk/database';
import { RoleName } from '@medidesk/domain';

describe('Phase 4: Multi-Record Clinical Transaction Atomic Rollback Integration Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let patientRepo: SqlitePatientRepository;
  let doctorRepo: SqliteDoctorRepository;
  let _rxRepo: SqlitePrescriptionRepository;

  let orgId: string;
  let patientId: string;
  let doctorId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-rollback-test-'));
    const testDbPath = path.join(testDir, 'rollback_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    _rxRepo = new SqlitePrescriptionRepository(db);

    const org = await orgRepo.create({
      name: 'Rollback Test Clinic',
      code: 'RTC',
      timezone: 'Asia/Kolkata',
      currency: 'INR'
    });
    orgId = org.id;

    const user = await userRepo.create({
      organizationId: orgId,
      username: 'dr_rollback',
      email: 'rollback@test.in',
      fullName: 'Dr. Rollback',
      passwordHash: 'hash',
      roles: [RoleName.DOCTOR]
    });

    const doc = await doctorRepo.create({
      organizationId: orgId,
      displayName: 'Dr. Rollback',
      qualification: 'MBBS',
      specialization: 'Internal Medicine',
      userId: user.id
    });
    doctorId = doc.id;

    const pat = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Test Rollback Patient',
      sex: 'FEMALE',
      mobile: '9888877777'
    });
    patientId = pat.id;
  });

  afterEach(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('rolls back parent prescription, version, and items if any item insertion fails during multi-table transaction', async () => {
    const raw = db.getRawDb();

    // Initial count
    const initialPrescriptions = raw.prepare('SELECT COUNT(*) as count FROM prescriptions').get() as { count: number };
    const initialVersions = raw.prepare('SELECT COUNT(*) as count FROM prescription_versions').get() as { count: number };
    const initialItems = raw.prepare('SELECT COUNT(*) as count FROM prescription_items').get() as { count: number };

    expect(initialPrescriptions.count).toBe(0);
    expect(initialVersions.count).toBe(0);
    expect(initialItems.count).toBe(0);

    // Attempt to insert a prescription where item violates NOT NULL or FK constraint
    expect(() => {
      db.transaction(() => {
        const rxId = 'test-rx-fail';
        const vId = 'test-v-fail';

        raw.prepare(`
          INSERT INTO prescriptions (
            id, organization_id, patient_id, doctor_id, status, current_version_number
          ) VALUES (?, ?, ?, ?, 'DRAFT', 1)
        `).run(rxId, orgId, patientId, doctorId);

        raw.prepare(`
          INSERT INTO prescription_versions (
            id, prescription_id, version_number, status, reason_for_change
          ) VALUES (?, ?, 1, 'ACTIVE', 'Initial')
        `).run(vId, rxId);

        // Intentionally violate column constraint (medicine_name is NOT NULL in sqlite schema)
        raw.prepare(`
          INSERT INTO prescription_items (
            id, prescription_version_id, medicine_name, dosage_form, route, frequency, duration_unit, is_substitution_allowed
          ) VALUES (?, ?, ?, 'TABLET', 'ORAL', '1-0-1', 'DAYS', 1)
        `).run('item-1', vId, null /* triggers SqliteError: NOT NULL constraint failed */);
      });
    }).toThrow();

    // Verify COMPLETE ROLLBACK: no orphan prescriptions or versions created
    const postPrescriptions = raw.prepare('SELECT COUNT(*) as count FROM prescriptions').get() as { count: number };
    const postVersions = raw.prepare('SELECT COUNT(*) as count FROM prescription_versions').get() as { count: number };
    const postItems = raw.prepare('SELECT COUNT(*) as count FROM prescription_items').get() as { count: number };

    expect(postPrescriptions.count).toBe(0);
    expect(postVersions.count).toBe(0);
    expect(postItems.count).toBe(0);
  });
});
