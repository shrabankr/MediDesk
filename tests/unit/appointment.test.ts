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
  DoctorInactiveError,
  OutsideDoctorScheduleError,
  AppointmentConflictError,
  InvalidAppointmentTransitionError,
  AuthorizationError
} from '@medidesk/domain';

describe('Phase 3: Appointments, Waiting Queue & State Machine', () => {
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

  let ownerUser: SessionUser;
  let staffUser: SessionUser;
  let developerUser: SessionUser;
  let orgId: string;
  let patient1Id: string;
  let patient2Id: string;
  let doctorId: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-apt-test-'));
    const testDbPath = path.join(testDir, 'apt_test.sqlite');
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

    const org = await orgRepo.create({
      name: 'MediCare Polyclinic',
      code: 'MEDICARE_POLY',
      currency: 'INR',
      timezone: 'Asia/Kolkata'
    });
    orgId = org.id;

    const u1 = await userRepo.create({
      organizationId: orgId,
      username: 'owner_user',
      email: 'owner@medicare.com',
      fullName: 'Owner User',
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
      username: 'desk_reception',
      email: 'desk@medicare.com',
      fullName: 'Receptionist',
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
      username: 'support_dev',
      email: 'dev@medicare.com',
      fullName: 'Software Developer',
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

    // Register 2 Patients
    const p1 = await patientService.registerPatient(
      { organizationId: orgId, fullName: 'Arjun Rao', sex: 'MALE', mobile: '9876543210', age: 34 },
      staffUser
    );
    patient1Id = p1.id;

    const p2 = await patientService.registerPatient(
      { organizationId: orgId, fullName: 'Meena Sharma', sex: 'FEMALE', mobile: '9123456780', age: 29 },
      staffUser
    );
    patient2Id = p2.id;

    // Register Doctor (Available Mon-Fri 09:00 - 13:00)
    const doc = await doctorService.createDoctor(
      {
        organizationId: orgId,
        displayName: 'Dr. Vivek Joshi',
        qualification: 'MBBS, MD',
        specialization: 'General Physician',
        consultationFee: 350
      },
      ownerUser
    );
    doctorId = doc.id;

    // Set Monday (1) through Friday (5) schedule: 09:00 to 13:00
    await doctorService.setDoctorSchedules(
      {
        doctorId,
        schedules: [1, 2, 3, 4, 5].map((d) => ({
          dayOfWeek: d,
          startTime: '09:00',
          endTime: '13:00',
          slotDurationMinutes: 15,
          isActive: true
        }))
      },
      orgId,
      ownerUser
    );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Pick a Monday date: 2026-08-24 is a Monday
  const targetDate = '2026-08-24';

  it('books appointments and generates sequential daily queue token numbers (#1, #2)', async () => {
    const apt1 = await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '09:00',
        durationMinutes: 15,
        visitPurpose: 'Routine Checkup'
      },
      staffUser
    );

    const apt2 = await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient2Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '09:15',
        durationMinutes: 15,
        visitPurpose: 'Fever Consultation'
      },
      staffUser
    );

    expect(apt1.queueNumber).toBe(1);
    expect(apt1.status).toBe('SCHEDULED');
    expect(apt1.endTime).toBe('09:15');

    expect(apt2.queueNumber).toBe(2);
    expect(apt2.status).toBe('SCHEDULED');
    expect(apt2.endTime).toBe('09:30');
  });

  it('rejects booking appointment for inactive doctor', async () => {
    await doctorService.deactivateDoctor(doctorId, orgId, ownerUser);

    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgId,
          patientId: patient1Id,
          doctorId,
          appointmentDate: targetDate,
          startTime: '09:00',
          durationMinutes: 15
        },
        staffUser
      )
    ).rejects.toThrow(DoctorInactiveError);
  });

  it('rejects booking outside doctor working hours or on non-working days', async () => {
    // 1. Outside hours on working day (Monday at 15:00, doctor only works 09:00-13:00)
    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgId,
          patientId: patient1Id,
          doctorId,
          appointmentDate: targetDate, // Monday
          startTime: '15:00',
          durationMinutes: 15
        },
        staffUser
      )
    ).rejects.toThrow(OutsideDoctorScheduleError);

    // 2. On Sunday (2026-08-23 is Sunday, doctor has no Sunday schedule)
    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgId,
          patientId: patient1Id,
          doctorId,
          appointmentDate: '2026-08-23',
          startTime: '10:00',
          durationMinutes: 15
        },
        staffUser
      )
    ).rejects.toThrow(OutsideDoctorScheduleError);
  });

  it('detects doctor appointment time conflicts and prevents overlapping bookings', async () => {
    await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '10:00',
        durationMinutes: 30 // 10:00 to 10:30
      },
      staffUser
    );

    // Attempt overlapping appointment: 10:15 to 10:30
    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgId,
          patientId: patient2Id,
          doctorId,
          appointmentDate: targetDate,
          startTime: '10:15',
          durationMinutes: 15
        },
        staffUser
      )
    ).rejects.toThrow(AppointmentConflictError);

    // Non-overlapping appointment at 10:30 succeeds
    const nonConflicting = await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient2Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '10:30',
        durationMinutes: 15
      },
      staffUser
    );
    expect(nonConflicting.queueNumber).toBe(2);
  });

  it('enforces strict appointment state machine transitions', async () => {
    const apt = await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '09:00',
        durationMinutes: 15
      },
      staffUser
    );

    // 1. SCHEDULED -> CHECKED_IN (Valid)
    const checkedIn = await appointmentService.changeAppointmentStatus(
      { appointmentId: apt.id, status: 'CHECKED_IN' },
      orgId,
      staffUser
    );
    expect(checkedIn.status).toBe('CHECKED_IN');

    // 2. CHECKED_IN -> WAITING (Valid)
    const waiting = await appointmentService.changeAppointmentStatus(
      { appointmentId: apt.id, status: 'WAITING' },
      orgId,
      staffUser
    );
    expect(waiting.status).toBe('WAITING');

    // 3. WAITING -> IN_CONSULTATION (Valid)
    const inConsult = await appointmentService.changeAppointmentStatus(
      { appointmentId: apt.id, status: 'IN_CONSULTATION' },
      orgId,
      staffUser
    );
    expect(inConsult.status).toBe('IN_CONSULTATION');

    // 4. IN_CONSULTATION -> COMPLETED (Valid)
    const completed = await appointmentService.changeAppointmentStatus(
      { appointmentId: apt.id, status: 'COMPLETED' },
      orgId,
      staffUser
    );
    expect(completed.status).toBe('COMPLETED');

    // 5. COMPLETED -> SCHEDULED (Illegal transition from terminal status)
    await expect(
      appointmentService.changeAppointmentStatus(
        { appointmentId: apt.id, status: 'SCHEDULED' },
        orgId,
        staffUser
      )
    ).rejects.toThrow(InvalidAppointmentTransitionError);
  });

  it('retrieves waiting queue and computes today metrics correctly', async () => {
    const a1 = await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '09:00',
        durationMinutes: 15
      },
      staffUser
    );

    const a2 = await appointmentService.bookAppointment(
      {
        organizationId: orgId,
        patientId: patient2Id,
        doctorId,
        appointmentDate: targetDate,
        startTime: '09:15',
        durationMinutes: 15
      },
      staffUser
    );

    // Patient 1 checked in and waiting
    await appointmentService.changeAppointmentStatus({ appointmentId: a1.id, status: 'CHECKED_IN' }, orgId, staffUser);
    await appointmentService.changeAppointmentStatus({ appointmentId: a1.id, status: 'WAITING' }, orgId, staffUser);

    const queue = await appointmentService.getWaitingQueue(
      { organizationId: orgId, appointmentDate: targetDate },
      staffUser
    );
    expect(queue.length).toBe(2);
    expect(queue[0].id).toBe(a1.id);
    expect(queue[1].id).toBe(a2.id);
    expect(queue[0].patientName).toBe('Arjun Rao');

    const metrics = await appointmentService.getTodayMetrics(orgId, targetDate, staffUser);
    expect(metrics.total).toBe(2);
    expect(metrics.scheduled).toBe(1);
    expect(metrics.waiting).toBe(1);
    expect(metrics.completed).toBe(0);
  });

  it('strictly denies DEVELOPER role from viewing or managing appointments', async () => {
    await expect(
      appointmentService.bookAppointment(
        {
          organizationId: orgId,
          patientId: patient1Id,
          doctorId,
          appointmentDate: targetDate,
          startTime: '09:00',
          durationMinutes: 15
        },
        developerUser
      )
    ).rejects.toThrow(AuthorizationError);

    await expect(
      appointmentService.getWaitingQueue({ organizationId: orgId, appointmentDate: targetDate }, developerUser)
    ).rejects.toThrow(AuthorizationError);
  });
});
