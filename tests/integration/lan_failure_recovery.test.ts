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
import { LanServer, LanClientGateway, LanSecurityManager } from '@medidesk/lan';

describe('Phase 7: LAN Failure Detection, Recovery & Revocation Invariants', () => {
  let db: SqliteDatabase;
  let testDbPath: string;
  let lanServer: LanServer;
  let lanClient: LanClientGateway;
  let authService: AuthenticationService;
  let securityManager: LanSecurityManager;
  let port = 5941;

  const orgId = 'org-lan-failover';
  const ownerId = 'user-owner-failover';

  beforeEach(async () => {
    port = 5900 + Math.floor(Math.random() * 1000);
    testDbPath = path.join(process.cwd(), `test_lan_fail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.sqlite`);
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
      name: 'Failover Clinic LAN',
      code: 'FCL',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: '99 Recovery St',
      phone: '9876543210',
      email: 'fail@clinic.lan'
    });

    const hash = await passwordHasher.hash('Secret123!');
    await userRepo.create({
      id: ownerId,
      organizationId: orgId,
      username: 'owner_failover',
      email: 'owner_failover@clinic.lan',
      passwordHash: hash,
      fullName: 'Owner Failover',
      roles: ['OWNER']
    });

    authService = new AuthenticationService(userRepo, orgRepo, appStateRepo, passwordHasher, auditService, rbacEngine);

    await cfgRepo.saveConfig(orgId, { serverPort: port });

    lanServer = new LanServer(cfgRepo, devRepo, securityManager, {
      authService,
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

  it('detects server shutdown and gracefully reconnects upon server restart', async () => {
    // Check initial online status
    const initialHealth = await lanClient.checkHealth();
    expect(initialHealth.isHealthy).toBe(true);
    expect(lanClient.getConnectionState()).toBe('CONNECTED');

    // Simulate Server PC shutting down
    await lanServer.stop();

    // Client detects disconnection
    const offlineHealth = await lanClient.checkHealth();
    expect(offlineHealth.isHealthy).toBe(false);
    expect(lanClient.getConnectionState()).toBe('DISCONNECTED');

    // Attempting an API request while offline returns structured error without crashing
    const reqRes = await lanClient.login({ username: 'owner_failover', password: 'Secret123!' });
    expect(reqRes.success).toBe(false);
    expect(reqRes.error?.code).toBe('LAN_CONNECTION_LOST');

    // Server restarts
    await lanServer.start(orgId);

    // Client detects recovery
    const recoveryHealth = await lanClient.checkHealth();
    expect(recoveryHealth.isHealthy).toBe(true);
    expect(lanClient.getConnectionState()).toBe('CONNECTED');
  });

  it('immediately blocks communication once device is revoked by Owner', async () => {
    // 1. Register & approve device
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    const reg = await lanClient.pairWithServer({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Doctor Laptop',
      deviceRole: 'DOCTOR_WORKSTATION',
      deviceFingerprint: 'fp-doc-laptop-rev'
    });

    const approval = await securityManager.approveDevice(reg.deviceId, orgId, ownerId);
    lanClient.setConfig({
      deviceId: reg.deviceId,
      deviceToken: approval.deviceToken
    });

    // 2. Doctor logs in
    const login = await lanClient.login({ username: 'owner_failover', password: 'Secret123!' });
    expect(login.success).toBe(true);
    const sessionToken = login.data.sessionToken;

    // 3. Authenticated request succeeds
    const okRes = await lanClient.request('GET', '/api/v1/lan/devices', undefined, sessionToken);
    expect(okRes.success).toBe(true);

    // 4. Owner revokes device
    await securityManager.revokeDevice(reg.deviceId, orgId);

    // 5. Subsequent request from that device is rejected
    const blockedRes = await lanClient.request('GET', '/api/v1/lan/devices', undefined, sessionToken);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.error?.message).toContain('REVOKED');
  });
});
