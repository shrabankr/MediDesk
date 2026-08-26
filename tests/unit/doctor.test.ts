import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteDoctorRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { DoctorService } from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { RoleName, SessionUser, AuthorizationError } from '@medidesk/domain';

describe('Phase 3: Doctor Management & Weekly Schedules', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let doctorRepo: SqliteDoctorRepository;
  let auditRepo: SqliteAuditRepository;
  let doctorService: DoctorService;

  let ownerUser: SessionUser;
  let staffUser: SessionUser;
  let developerUser: SessionUser;
  let orgId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-doc-test-'));
    const testDbPath = path.join(testDir, 'doc_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);
    doctorRepo = new SqliteDoctorRepository(db);
    auditRepo = new SqliteAuditRepository(db);

    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();

    doctorService = new DoctorService(doctorRepo, auditService, rbacEngine);

    const org = await orgRepo.create({
      name: 'LifeCare Hospital',
      code: 'LIFE_CARE',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
    orgId = org.id;

    const u1 = await userRepo.create({
      organizationId: orgId,
      username: 'owner_admin',
      email: 'owner@lifecare.com',
      fullName: 'Hospital Owner',
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
      username: 'desk_staff',
      email: 'staff@lifecare.com',
      fullName: 'Front Desk Staff',
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
      username: 'dev_user',
      email: 'dev@lifecare.com',
      fullName: 'Developer',
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

  it('creates doctor with profile details and initial consultation fee', async () => {
    const doc = await doctorService.createDoctor(
      {
        organizationId: orgId,
        displayName: 'Dr. Suresh Sen',
        qualification: 'MBBS, MD (Medicine)',
        specialization: 'Internal Medicine',
        registrationNumber: 'KMC-54321',
        mobile: '9845012345',
        consultationFee: 400
      },
      ownerUser
    );

    expect(doc.id).toBeDefined();
    expect(doc.displayName).toBe('Dr. Suresh Sen');
    expect(doc.status).toBe('ACTIVE');
    expect(doc.consultationFee).toBe(400);

    const auditLogs = await auditRepo.listRecent(5);
    const creationLog = auditLogs.find((l) => l.action === 'DOCTOR_CREATED');
    expect(creationLog).toBeDefined();
    expect(creationLog?.actor.username).toBe('owner_admin');
  });

  it('configures and updates doctor weekly schedules (days 0-6)', async () => {
    const doc = await doctorService.createDoctor(
      {
        organizationId: orgId,
        displayName: 'Dr. Anita Roy',
        qualification: 'MBBS, MS (Ortho)',
        specialization: 'Orthopedics',
        consultationFee: 500
      },
      ownerUser
    );

    // Monday (1) and Wednesday (3) schedules
    const schedules = await doctorService.setDoctorSchedules(
      {
        doctorId: doc.id,
        schedules: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00', slotDurationMinutes: 15, isActive: true },
          { dayOfWeek: 3, startTime: '16:00', endTime: '20:00', slotDurationMinutes: 15, isActive: true }
        ]
      },
      orgId,
      ownerUser
    );

    expect(schedules.length).toBe(2);
    expect(schedules[0].dayOfWeek).toBe(1);
    expect(schedules[0].startTime).toBe('09:00');
    expect(schedules[1].dayOfWeek).toBe(3);
    expect(schedules[1].endTime).toBe('20:00');

    // Retrieve via service
    const fetched = await doctorService.getDoctorSchedules(doc.id, orgId, staffUser);
    expect(fetched.length).toBe(2);
  });

  it('deactivates doctor and prevents active listing', async () => {
    const doc = await doctorService.createDoctor(
      {
        organizationId: orgId,
        displayName: 'Dr. Vinod Mehta',
        qualification: 'BAMS',
        specialization: 'Ayurveda',
        consultationFee: 300
      },
      ownerUser
    );

    const deactivated = await doctorService.deactivateDoctor(doc.id, orgId, ownerUser);
    expect(deactivated.status).toBe('INACTIVE');

    const activeOnly = await doctorService.listDoctors(orgId, staffUser, { activeOnly: true });
    expect(activeOnly.some((d) => d.id === doc.id)).toBe(false);

    const all = await doctorService.listDoctors(orgId, staffUser, { activeOnly: false });
    expect(all.some((d) => d.id === doc.id)).toBe(true);
  });

  it('strictly denies DEVELOPER role from viewing or managing doctors', async () => {
    await expect(
      doctorService.createDoctor(
        {
          organizationId: orgId,
          displayName: 'Dr. Dev Test',
          qualification: 'MBBS',
          specialization: 'General'
        },
        developerUser
      )
    ).rejects.toThrow(AuthorizationError);

    await expect(doctorService.listDoctors(orgId, developerUser)).rejects.toThrow(AuthorizationError);
  });
});
