import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteOrganizationRepository,
  SqliteUserRepository,
  SqliteLanDeviceRepository,
  SqliteLanServerConfigRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import {
  AuthenticationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { LanServer, LanSecurityManager } from '@medidesk/lan';

describe('Phase 7: LAN Server-Authoritative RBAC Enforcement', () => {
  let db: SqliteDatabase;
  let testDbPath: string;
  let lanServer: LanServer;
  let authService: AuthenticationService;
  let securityManager: LanSecurityManager;
  let port = 5891;

  const orgId = 'org-lan-rbac';
  let doctorToken: string;
  let staffToken: string;
  let ownerToken: string;
  let developerToken: string;
  let approvedDeviceId: string;

  beforeEach(async () => {
    port = 5800 + Math.floor(Math.random() * 1000);
    testDbPath = path.join(process.cwd(), `test_lan_rbac_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.sqlite`);
    db = new SqliteDatabase({ databasePath: testDbPath });
    const runner = new MigrationRunner(db);
    runner.runPendingMigrations();

    const orgRepo = new SqliteOrganizationRepository(db);
    const userRepo = new SqliteUserRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbacEngine = new RBACEngine();
    const appStateRepo = { getState: async () => null, setState: async () => {} } as any;
    const passwordHasher = new ScryptPasswordHasher();

    const devRepo = new SqliteLanDeviceRepository(db);
    const cfgRepo = new SqliteLanServerConfigRepository(db);
    securityManager = new LanSecurityManager(cfgRepo, devRepo);

    await orgRepo.create({
      id: orgId,
      name: 'RBAC Clinic LAN',
      code: 'RCL',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: '789 Secure Rd',
      phone: '9876543210',
      email: 'sec@rbac.lan'
    });

    const hash = await passwordHasher.hash('Secret123!');

    // Users
    await userRepo.create({ id: 'u-owner', organizationId: orgId, username: 'owner1', email: 'owner1@rbac.lan', passwordHash: hash, fullName: 'Owner User', roles: ['OWNER'] });
    await userRepo.create({ id: 'u-doctor', organizationId: orgId, username: 'doc1', email: 'doc1@rbac.lan', passwordHash: hash, fullName: 'Doctor User', roles: ['DOCTOR'] });
    await userRepo.create({ id: 'u-staff', organizationId: orgId, username: 'staff1', email: 'staff1@rbac.lan', passwordHash: hash, fullName: 'Staff User', roles: ['STAFF'] });
    await userRepo.create({ id: 'u-dev', organizationId: orgId, username: 'dev1', email: 'dev1@rbac.lan', passwordHash: hash, fullName: 'Dev User', roles: ['DEVELOPER'] });

    authService = new AuthenticationService(userRepo, orgRepo, appStateRepo, passwordHasher, auditService, rbacEngine);

    await cfgRepo.saveConfig(orgId, { serverPort: port });

    lanServer = new LanServer(cfgRepo, devRepo, securityManager, {
      authService,
      auditService,
      rbacEngine
    });

    await lanServer.start(orgId);

    // Register & approve client device
    const pin = await securityManager.generatePairingPin(orgId, 'u-owner');
    const reg = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Doctor Workstation',
      deviceFingerprint: 'fp-rbac-test-1',
      deviceRole: 'DOCTOR_WORKSTATION'
    });
    approvedDeviceId = reg.deviceId;
    await securityManager.approveDevice(approvedDeviceId, orgId, 'u-owner');

    // Acquire tokens
    const oLogin = await authService.login({ username: 'owner1', password: 'Secret123!' });
    ownerToken = oLogin.sessionToken;

    const dLogin = await authService.login({ username: 'doc1', password: 'Secret123!' });
    doctorToken = dLogin.sessionToken;

    const sLogin = await authService.login({ username: 'staff1', password: 'Secret123!' });
    staffToken = sLogin.sessionToken;

    const devLogin = await authService.login({ username: 'dev1', password: 'Secret123!' });
    developerToken = devLogin.sessionToken;
  });

  afterEach(async () => {
    try {
      await lanServer.stop();
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch { /* cleanup */ }
  });

  it('rejects unauthenticated requests with 403 / AuthorizationError', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/patients`, {
      method: 'GET'
    });
    expect(res.status).toBe(403);
    const data = await res.json() as any;
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Authentication required');
  });

  it('allows Owner to generate pairing PINs over LAN API', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/lan/pin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.data.pinCode).toHaveLength(6);
  });

  it('strictly denies Doctor and Staff from generating pairing PINs', async () => {
    const resDoc = await fetch(`http://localhost:${port}/api/v1/lan/pin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${doctorToken}`,
        'Content-Type': 'application/json'
      }
    });
    expect(resDoc.status).toBe(403);

    const resStaff = await fetch(`http://localhost:${port}/api/v1/lan/pin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${staffToken}`,
        'Content-Type': 'application/json'
      }
    });
    expect(resStaff.status).toBe(403);
  });

  it('strictly denies Developer role from reading clinical/patient data over LAN', async () => {
    const res = await fetch(`http://localhost:${port}/api/v1/patients?q=test`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${developerToken}`
      }
    });

    expect(res.status).toBe(403);
    const data = await res.json() as any;
    expect(data.success).toBe(false);
    expect(data.error.message).toMatch(/denied|permission/i);
  });
});
