import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteLanDeviceRepository,
  SqliteLanServerConfigRepository,
  SqliteOrganizationRepository,
  SqliteUserRepository
} from '@medidesk/database';
import { LanSecurityManager } from '@medidesk/lan';

describe('Phase 7: LAN Security, Device Pairing & Replay Protection', () => {
  let db: SqliteDatabase;
  let testDbPath: string;
  let deviceRepo: SqliteLanDeviceRepository;
  let configRepo: SqliteLanServerConfigRepository;
  let orgRepo: SqliteOrganizationRepository;
  let userRepo: SqliteUserRepository;
  let securityManager: LanSecurityManager;
  const orgId = 'org-test-lan-sec';
  const ownerId = 'user-owner-lan';

  beforeEach(async () => {
    testDbPath = path.join(process.cwd(), `test_lan_sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.sqlite`);
    db = new SqliteDatabase({ databasePath: testDbPath });
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.runPendingMigrations();

    deviceRepo = new SqliteLanDeviceRepository(db);
    configRepo = new SqliteLanServerConfigRepository(db);
    orgRepo = new SqliteOrganizationRepository(db);
    userRepo = new SqliteUserRepository(db);

    await orgRepo.create({
      id: orgId,
      name: 'Test Clinic LAN',
      code: 'TCL',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      address: '123 Health Ave',
      phone: '9876543210',
      email: 'test@clinic.lan'
    });

    await userRepo.create({
      id: ownerId,
      organizationId: orgId,
      username: 'drowner',
      email: 'drowner@clinic.lan',
      passwordHash: 'dummy-hash',
      fullName: 'Dr. Owner',
      roles: ['OWNER']
    });

    securityManager = new LanSecurityManager(configRepo, deviceRepo, 'test-server-secret-key-12345');
  });

  afterEach(() => {
    try {
      db.close();
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch { /* cleanup */ }
  });

  it('generates a valid 6-digit pairing PIN with 10-minute expiry', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    expect(pin.pinCode).toHaveLength(6);
    expect(/^\d{6}$/.test(pin.pinCode)).toBe(true);
    expect(pin.isUsed).toBe(false);
    expect(pin.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects pairing with invalid or expired PIN', async () => {
    const res = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: '999999',
      deviceName: 'Rogue PC',
      deviceFingerprint: 'fp-rogue-001',
      deviceRole: 'GENERAL_CLIENT'
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain('Invalid or expired');
  });

  it('registers a device in PENDING_APPROVAL status and consumes single-use PIN', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);

    const res = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Doctor Consultation Room 1',
      deviceFingerprint: 'fp-doc-room-1',
      deviceRole: 'DOCTOR_WORKSTATION'
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('PENDING_APPROVAL');
    expect(res.deviceId).toBeDefined();

    // Verify PIN is consumed and cannot be reused
    const reuseRes = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Attacker PC',
      deviceFingerprint: 'fp-attacker-002',
      deviceRole: 'GENERAL_CLIENT'
    });
    expect(reuseRes.success).toBe(false);
  });

  it('allows Owner to approve device and generates signed deviceToken', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    const reg = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Pharmacy POS 1',
      deviceFingerprint: 'fp-pharm-pos-1',
      deviceRole: 'PHARMACY_POS'
    });

    const approval = await securityManager.approveDevice(reg.deviceId, orgId, ownerId);
    expect(approval.device.status).toBe('APPROVED');
    expect(approval.device.approvedBy).toBe(ownerId);
    expect(approval.deviceToken).toBeDefined();
    expect(approval.deviceToken.length).toBeGreaterThan(20);
  });

  it('validates authentic client request signatures with timestamp and nonce', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    const reg = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Reception PC',
      deviceFingerprint: 'fp-reception-001',
      deviceRole: 'RECEPTION'
    });
    await securityManager.approveDevice(reg.deviceId, orgId, ownerId);

    const now = Date.now();
    const nonce = crypto.randomUUID();
    const payload = JSON.stringify({ action: 'search', q: 'John' });
    const sig = securityManager.signClientRequest(reg.deviceId, payload, now, nonce);

    const result = await securityManager.validateRequest(
      reg.deviceId,
      orgId,
      sig,
      payload,
      now.toString(),
      nonce
    );

    expect(result.isValid).toBe(true);
  });

  it('rejects replay attacks with duplicate nonce', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    const reg = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Doctor PC',
      deviceFingerprint: 'fp-doc-002',
      deviceRole: 'DOCTOR_WORKSTATION'
    });
    await securityManager.approveDevice(reg.deviceId, orgId, ownerId);

    const now = Date.now();
    const nonce = 'unique-nonce-12345';
    const payload = JSON.stringify({ action: 'login' });
    const sig = securityManager.signClientRequest(reg.deviceId, payload, now, nonce);

    // First request succeeds
    const res1 = await securityManager.validateRequest(reg.deviceId, orgId, sig, payload, now.toString(), nonce);
    expect(res1.isValid).toBe(true);

    // Second request with same nonce is rejected
    const res2 = await securityManager.validateRequest(reg.deviceId, orgId, sig, payload, now.toString(), nonce);
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('Replay attack detected');
  });

  it('rejects requests with out-of-window timestamps (> 300 seconds)', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    const reg = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Doctor PC',
      deviceFingerprint: 'fp-doc-003',
      deviceRole: 'DOCTOR_WORKSTATION'
    });
    await securityManager.approveDevice(reg.deviceId, orgId, ownerId);

    const staleTimestamp = Date.now() - 400 * 1000; // 400s ago
    const nonce = crypto.randomUUID();
    const payload = JSON.stringify({ action: 'list' });
    const sig = securityManager.signClientRequest(reg.deviceId, payload, staleTimestamp, nonce);

    const result = await securityManager.validateRequest(
      reg.deviceId,
      orgId,
      sig,
      payload,
      staleTimestamp.toString(),
      nonce
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Timestamp is out of valid time window');
  });

  it('immediately blocks requests from revoked devices', async () => {
    const pin = await securityManager.generatePairingPin(orgId, ownerId);
    const reg = await securityManager.registerDeviceWithPin({
      organizationId: orgId,
      pairingPin: pin.pinCode,
      deviceName: 'Stolen Laptop',
      deviceFingerprint: 'fp-stolen-004',
      deviceRole: 'GENERAL_CLIENT'
    });
    await securityManager.approveDevice(reg.deviceId, orgId, ownerId);

    // Revoke device
    await securityManager.revokeDevice(reg.deviceId, orgId);

    const now = Date.now();
    const nonce = crypto.randomUUID();
    const payload = JSON.stringify({ action: 'getData' });
    const sig = securityManager.signClientRequest(reg.deviceId, payload, now, nonce);

    const result = await securityManager.validateRequest(
      reg.deviceId,
      orgId,
      sig,
      payload,
      now.toString(),
      nonce
    );

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('REVOKED');
  });
});
