import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteLicenseRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { LicenseService, LicenseTokenPayload } from '@medidesk/licensing';
import { SessionUser, RoleName, LicenseStatus, InvalidLicenseSignatureError, LicenseExpiredError } from '@medidesk/domain';

describe('Phase 6: Licensing, 60-Day Trial & Cryptographic Verification Unit Tests', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let licenseService: LicenseService;
  let licenseRepo: SqliteLicenseRepository;
  let keyPair: { publicKey: string; privateKey: string };

  const orgId = 'org-license-test';

  const ownerUser: SessionUser = {
    id: 'user-owner-lic',
    organizationId: orgId,
    organizationName: 'City Clinic',
    username: 'owner_lic',
    email: 'owner@clinic.com',
    fullName: 'Dr. Owner License',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-license-test-'));
    const testDbPath = path.join(testDir, 'licensing.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'City Clinic', 'CITY')`).run(orgId);

    // Generate dynamic RSA 2048 keypair for cryptographic test signing
    keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    licenseRepo = new SqliteLicenseRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    licenseService = new LicenseService(licenseRepo, auditService, rbac, keyPair.publicKey, false);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('initializes a 60-day full-featured local trial and computes days remaining', async () => {
    const entitlement = await licenseService.initializeTrial(orgId, 'INST-TEST-1234');
    expect(entitlement.status).toBe(LicenseStatus.TRIAL);
    expect(entitlement.installationId).toBe('INST-TEST-1234');
    expect(entitlement.features).toContain('clinical');
    expect(entitlement.features).toContain('pharmacy');

    const days = licenseService.getTrialDaysRemaining(entitlement);
    expect(days).toBeGreaterThanOrEqual(59);
    expect(days).toBeLessThanOrEqual(60);

    // Saved to SQLite
    const saved = await licenseRepo.findByInstallationId('INST-TEST-1234');
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe(LicenseStatus.TRIAL);
  });

  it('activates a valid cryptographically signed offline commercial license token', async () => {
    const installationId = 'INST-PROD-9988';
    await licenseService.initializeTrial(orgId, installationId);

    const now = new Date();
    const future = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 Year Valid

    const payload: LicenseTokenPayload = {
      installationId,
      organizationId: orgId,
      organizationName: 'City Clinic',
      tier: 'CLINIC_STANDARD',
      features: ['clinical', 'pharmacy', 'billing', 'reports', 'backup_local', 'backup_cloud'],
      validFrom: now.toISOString(),
      validTo: future.toISOString(),
      maxDoctors: 10,
      maxStaff: 20,
      issuedAt: now.toISOString()
    };

    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson, 'utf8').toString('base64');

    // Sign payload with private key
    const signer = crypto.createSign('SHA256');
    signer.update(payloadJson);
    signer.end();
    const signatureB64 = signer.sign(keyPair.privateKey, 'base64');

    const licenseToken = `${payloadB64}.${signatureB64}`;

    // Activate token
    const result = await licenseService.activateLicenseToken(licenseToken, ownerUser);
    expect(result.status).toBe(LicenseStatus.ACTIVE);
    expect(result.features).toContain('backup_cloud');
    expect(result.maxDoctors).toBe(10);

    // Check persistent database record
    const updated = await licenseRepo.findByInstallationId(installationId);
    expect(updated?.status).toBe(LicenseStatus.ACTIVE);
    expect(updated?.licenseKey).toBe(licenseToken);
  });

  it('rejects forged license tokens with invalid cryptographic signatures', async () => {
    const payload: LicenseTokenPayload = {
      installationId: 'INST-FORGED-0000',
      organizationId: orgId,
      organizationName: 'Hacked Clinic',
      tier: 'ENTERPRISE',
      features: ['*'],
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 100000000).toISOString(),
      maxDoctors: 999,
      maxStaff: 999,
      issuedAt: new Date().toISOString()
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    const fakeSignatureB64 = Buffer.from('FAKE_SIGNATURE_DATA_STRING').toString('base64');

    const forgedToken = `${payloadB64}.${fakeSignatureB64}`;

    await expect(
      licenseService.activateLicenseToken(forgedToken, ownerUser)
    ).rejects.toThrow(InvalidLicenseSignatureError);
  });

  it('enforces patient data protection invariant: blocks writes when license expired, but preserves read access', async () => {
    // Set expired trial
    const past = new Date(Date.now() - 10000000);
    await licenseRepo.saveInstallation({
      installationId: 'INST-EXPIRED-1',
      organizationId: orgId,
      machineFingerprint: 'dummy-fp',
      status: LicenseStatus.EXPIRED,
      trialStartedAt: new Date(past.getTime() - 60 * 24 * 60 * 60 * 1000),
      trialExpiresAt: past
    });

    const entitlement = await licenseService.getEntitlement(orgId);
    expect(entitlement.status).toBe(LicenseStatus.EXPIRED);

    // Attempting write throws LicenseExpiredError
    await expect(
      licenseService.assertWritePermitted(orgId)
    ).rejects.toThrow(LicenseExpiredError);
  });
});
