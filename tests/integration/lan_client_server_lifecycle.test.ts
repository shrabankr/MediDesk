import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqlitePatientRepository,
  SqliteDoctorRepository,
  SqliteAppointmentRepository,
  SqliteLanDeviceRepository,
  SqliteLanServerConfigRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import {
  AuthenticationService,
  PatientService,
  DoctorService,
  AppointmentService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { LanServer, LanClientGateway, LanSecurityManager } from '@medidesk/lan';

describe('Phase 7: End-to-End LAN Client-Server Multi-Workstation Lifecycle', () => {
  let db: SqliteDatabase;
  let testDbPath: string;
  let lanServer: LanServer;
  let lanClient: LanClientGateway;
  let authService: AuthenticationService;
  let patientService: PatientService;
  let doctorService: DoctorService;
  let appointmentService: AppointmentService;
  let doctorEntityId: string;
  let port = 5921;

  const orgId = 'org-lan-e2e';
  const ownerId = 'user-owner-e2e';
  const doctorUserId = 'user-doc-e2e';

  beforeEach(async () => {
    port = 5900 + Math.floor(Math.random() * 1000);
    testDbPath = path.join(process.cwd(), `test_lan_e2e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.sqlite`);
    db = new SqliteDatabase({ databasePath: testDbPath });
    const runner = new MigrationRunner(db);
    runner.runPendingMigrations();

    const orgRepo = new SqliteOrganizationRepository(db);
    const userRepo = new SqliteUserRepository(db);
    const patientRepo = new SqlitePatientRepository(db);
    const doctorRepo = new SqliteDoctorRepository(db);
    const appointmentRepo = new SqliteAppointmentRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();
    const appStateRepo = { getState: async () => null, setState: async () => {} } as any;
    const passwordHasher = new ScryptPasswordHasher();

    const devRepo = new SqliteLanDeviceRepository(db);
    const cfgRepo = new SqliteLanServerConfigRepository(db);
    const secMgr = new LanSecurityManager(cfgRepo, devRepo);

    await orgRepo.create({
      id: orgId,
      name: 'Multi-Computer MediDesk Clinic',
      code: 'MCMC',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: '100 Hub Road',
      phone: '9900112233',
      email: 'hub@clinic.lan'
    });

    const hash = await passwordHasher.hash('DoctorPassword123!');

    await userRepo.create({
      id: ownerId,
      organizationId: orgId,
      username: 'owner_admin',
      email: 'owner_admin@clinic.lan',
      passwordHash: hash,
      fullName: 'Dr. Chief Owner',
      roles: ['OWNER', 'DOCTOR']
    });

    await userRepo.create({
      id: doctorUserId,
      organizationId: orgId,
      username: 'dr_sharma',
      email: 'dr_sharma@clinic.lan',
      passwordHash: hash,
      fullName: 'Dr. Sharma',
      roles: ['DOCTOR', 'STAFF']
    });

    const doc = await doctorRepo.create({
      organizationId: orgId,
      userId: doctorUserId,
      displayName: 'Dr. Sharma',
      qualification: 'MBBS, MD',
      specialization: 'Cardiology',
      consultationFee: 500
    });
    doctorEntityId = doc.id;

    authService = new AuthenticationService(userRepo, orgRepo, appStateRepo, passwordHasher, auditService, rbacEngine);
    patientService = new PatientService(patientRepo, auditService, rbacEngine);
    doctorService = new DoctorService(doctorRepo, auditService, rbacEngine);
    appointmentService = new AppointmentService(appointmentRepo, patientRepo, doctorRepo, auditService, rbacEngine);

    await cfgRepo.saveConfig(orgId, { serverPort: port, operatingMode: 'LAN_SERVER' });

    lanServer = new LanServer(cfgRepo, devRepo, secMgr, {
      authService,
      patientService,
      doctorService,
      appointmentService,
      auditService,
      rbacEngine
    });

    await lanServer.start(orgId);

    lanClient = new LanClientGateway({
      serverUrl: `http://localhost:${port}`,
      organizationId: orgId
    });
  });

  afterEach(async () => {
    try {
      lanClient.stopHeartbeat();
      await lanServer.stop();
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch { /* cleanup */ }
  });

  it('successfully pairs workstation, logs in doctor, registers patient and books appointment across LAN transport', async () => {
    // 1. Health check from client
    const health = await lanClient.checkHealth();
    expect(health.isHealthy).toBe(true);
    expect(health.fingerprint).toBeDefined();

    // 2. Owner generates pairing PIN on Server
    const secMgr = lanServer.getSecurityManager();
    const pin = await secMgr.generatePairingPin(orgId, ownerId);
    expect(pin.pinCode).toHaveLength(6);

    // 3. Client pairs using the PIN
    const pairRes = await lanClient.pairWithServer({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Consultation Room 2B PC',
      deviceRole: 'DOCTOR_WORKSTATION',
      deviceFingerprint: 'fp-client-doc-2b'
    });
    expect(pairRes.success).toBe(true);
    expect(pairRes.status).toBe('PENDING_APPROVAL');

    // 4. Owner approves the device on Server
    const approval = await secMgr.approveDevice(pairRes.deviceId, orgId, ownerId);
    expect(approval.device.status).toBe('APPROVED');

    // 5. Client polls status and receives device token
    const poll = await lanClient.pollApprovalStatus('fp-client-doc-2b');
    expect(poll.status).toBe('APPROVED');
    expect(poll.deviceToken).toBeDefined();

    // 6. Doctor logs in through LAN Client Gateway
    const loginRes = await lanClient.login({
      username: 'dr_sharma',
      password: 'DoctorPassword123!'
    });
    expect(loginRes.success).toBe(true);
    expect(loginRes.data.user.username).toBe('dr_sharma');
    const doctorSessionToken = loginRes.data.sessionToken;

    // 7. Doctor registers a patient across LAN
    const patientData = {
      organizationId: orgId,
      fullName: 'Ramesh Patel',
      age: 45,
      sex: 'MALE',
      mobile: '9812345678',
      address: 'B-12 Gandhi Nagar'
    };
    const patRes = await lanClient.registerPatient(patientData, doctorSessionToken);
    expect(patRes.success).toBe(true);
    expect(patRes.data.fullName).toBe('Ramesh Patel');
    expect(patRes.data.patientNumber).toMatch(/MD-\d+/);
    const createdPatientId = patRes.data.id;

    // 8. Doctor books an appointment across LAN
    const apptData = {
      organizationId: orgId,
      patientId: createdPatientId,
      doctorId: doctorEntityId,
      appointmentDate: '2026-09-01',
      startTime: '10:00',
      durationMinutes: 15,
      visitPurpose: 'Chest tightness and shortness of breath'
    };
    const apptRes = await lanClient.request('POST', '/api/v1/appointments', apptData, doctorSessionToken);
    expect(apptRes.success).toBe(true);
    expect(apptRes.data.startTime).toBe('10:00');
    expect(apptRes.data.endTime).toBe('10:15');
    expect(apptRes.data.status).toBe('SCHEDULED');

    // 9. Doctor searches patients over LAN
    const searchRes = await lanClient.searchPatients('Ramesh', doctorSessionToken);
    expect(searchRes.success).toBe(true);
    expect(searchRes.data.length).toBe(1);
    expect(searchRes.data[0].mobile).toBe('9812345678');
  });
});
