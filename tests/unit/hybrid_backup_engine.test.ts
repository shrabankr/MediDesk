import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteBackupLogRepository,
  SqliteBackupSettingsRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { BackupService, GoogleDriveProvider } from '@medidesk/backup';
import { SessionUser, RoleName } from '@medidesk/domain';

describe('Phase 6: Hybrid Backup Engine Comprehensive Unit Tests', () => {
  let testDir: string;
  let backupDir: string;
  let db: SqliteDatabase;
  let backupService: BackupService;
  let gdriveProvider: GoogleDriveProvider;
  let backupLogRepo: SqliteBackupLogRepository;
  let backupSettingsRepo: SqliteBackupSettingsRepository;
  let auditService: AuditService;
  let testDbPath: string;

  const orgId = 'org-hybrid-test';

  const ownerUser: SessionUser = {
    id: 'user-owner-hb',
    organizationId: orgId,
    organizationName: 'Hybrid Clinic',
    username: 'owner_hb',
    email: 'owner@hb.com',
    fullName: 'Dr. Hybrid Owner',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-hybrid-test-'));
    backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    testDbPath = path.join(testDir, 'hybrid_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Hybrid Clinic', 'HYB')`).run(orgId);
    db.getRawDb().prepare(`INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 'hash', 1)`).run(
      ownerUser.id,
      orgId,
      ownerUser.username,
      ownerUser.email,
      ownerUser.fullName
    );

    const auditRepo = new SqliteAuditRepository(db);
    auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();
    backupLogRepo = new SqliteBackupLogRepository(db);
    backupSettingsRepo = new SqliteBackupSettingsRepository(db);
    gdriveProvider = new GoogleDriveProvider();

    backupService = new BackupService(
      testDbPath,
      backupDir,
      backupLogRepo,
      auditService,
      rbac,
      backupSettingsRepo,
      gdriveProvider
    );
  });

  afterEach(() => {
    try {
      db.close();
    } catch { /* already closed */ }
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  it('1. executes LOCAL_ONLY backup: creates local encrypted artifact with checksum and marks cloudStatus NONE', async () => {
    const res = await backupService.createHybridBackup({
      mode: 'LOCAL_ONLY',
      actor: ownerUser
    });

    expect(res.backupMode).toBe('LOCAL_ONLY');
    expect(res.localStatus).toBe('SUCCESS');
    expect(res.cloudStatus).toBe('NONE');
    expect(res.overallStatus).toBe('LOCAL_SUCCESS');
    expect(fs.existsSync(res.filePath)).toBe(true);
    expect(fs.existsSync(`${res.filePath}.sha256`)).toBe(true);

    // Verify binary magic header
    const buf = fs.readFileSync(res.filePath);
    expect(buf.subarray(0, 15).toString('utf8')).toBe('MEDIDESK_ENC_V1');
  });

  it('2. executes HYBRID backup when online: creates local snapshot and uploads to Google Drive with verification', async () => {
    // Ensure mock online & connected
    gdriveProvider.setForceOffline(false);
    gdriveProvider.setTokens({ accessToken: 'test-token', accountEmail: 'clinic@gmail.com' });

    const res = await backupService.createHybridBackup({
      mode: 'HYBRID',
      actor: ownerUser
    });

    expect(res.backupMode).toBe('HYBRID');
    expect(res.localStatus).toBe('SUCCESS');
    expect(res.cloudStatus).toBe('SUCCESS');
    expect(res.overallStatus).toBe('CLOUD_SUCCESS');
    expect(res.remoteFileId).toBeDefined();
    expect(fs.existsSync(res.filePath)).toBe(true);

    // Verify remote file exists on Google Drive provider
    const cloudList = await gdriveProvider.listBackups();
    const uploaded = cloudList.find(b => b.name === res.filename);
    expect(uploaded).toBeDefined();
  });

  it('3. CRITICAL INVARIANT: HYBRID backup when offline succeeds locally and marks cloudStatus PENDING without failing', async () => {
    // Simulate offline
    gdriveProvider.setForceOffline(true);

    const res = await backupService.createHybridBackup({
      mode: 'HYBRID',
      actor: ownerUser
    });

    // Local backup MUST succeed even when offline!
    expect(res.localStatus).toBe('SUCCESS');
    expect(res.cloudStatus).toBe('PENDING');
    expect(res.overallStatus).toBe('PARTIAL');
    expect(fs.existsSync(res.filePath)).toBe(true);

    // Check pending list in repository
    const pending = await backupLogRepo.listPendingCloudBackups(orgId);
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe(res.id);
  });

  it('4. executes CLOUD_ONLY backup: uploads to cloud and purges local copy after cloud verification', async () => {
    gdriveProvider.setForceOffline(false);
    gdriveProvider.setTokens({ accessToken: 'test-token', accountEmail: 'clinic@gmail.com' });

    const res = await backupService.createHybridBackup({
      mode: 'CLOUD_ONLY',
      actor: ownerUser
    });

    expect(res.cloudStatus).toBe('SUCCESS');
    expect(res.remoteFileId).toBeDefined();
    // Local copy was purged after successful cloud upload
    expect(fs.existsSync(res.filePath)).toBe(false);
  });

  it('5. retries pending cloud backups idempotently without recreating database snapshots', async () => {
    // 1. Create offline hybrid backup
    gdriveProvider.setForceOffline(true);
    const offlineBackup = await backupService.createHybridBackup({
      mode: 'HYBRID',
      actor: ownerUser
    });
    expect(offlineBackup.cloudStatus).toBe('PENDING');

    // 2. Bring internet back online
    gdriveProvider.setForceOffline(false);
    gdriveProvider.setTokens({ accessToken: 'test-token', accountEmail: 'clinic@gmail.com' });

    // 3. Trigger cloud retry
    const retryResult = await backupService.retryPendingCloudBackups(ownerUser);
    expect(retryResult.attempted).toBe(1);
    expect(retryResult.succeeded).toBe(1);
    expect(retryResult.failed).toBe(0);

    // 4. Verify updated record in DB
    const updated = await backupLogRepo.findById(offlineBackup.id, orgId);
    expect(updated?.cloudStatus).toBe('SUCCESS');
    expect(updated?.overallStatus).toBe('CLOUD_SUCCESS');
    expect(updated?.remoteFileId).toBeDefined();
  });

  it('6. prevents duplicate cloud uploads when same backupId already exists on Google Drive', async () => {
    gdriveProvider.setForceOffline(false);
    gdriveProvider.setTokens({ accessToken: 'test-token', accountEmail: 'clinic@gmail.com' });

    const res1 = await backupService.createHybridBackup({ mode: 'HYBRID', actor: ownerUser });
    const initialRemoteId = res1.remoteFileId;

    // Attempt second upload of exact same artifact
    const upload2 = await gdriveProvider.uploadEncryptedBackup(
      res1.filePath,
      res1.id,
      { organizationId: orgId, sizeBytes: res1.sizeBytes, sha256Checksum: res1.sha256Checksum }
    );

    // Must return the existing fileId without duplicate entry
    expect(upload2.fileId).toBe(initialRemoteId);
  });

  it('7. applies retention policy while strictly preserving at least 1 newest verified recovery copy', async () => {
    // Set retention to 7 days
    await backupSettingsRepo.upsert(orgId, { localRetentionDays: 7, cloudRetentionDays: 7 });

    // Create 1 backup
    const b1 = await backupService.createHybridBackup({ mode: 'LOCAL_ONLY', actor: ownerUser });

    // Run retention pruning
    const prune1 = await backupService.applyRetentionPolicy(ownerUser);
    expect(prune1.localPruned).toBe(0);
    // Invariant: b1 must NOT be deleted because it is the only backup
    expect(fs.existsSync(b1.filePath)).toBe(true);
  });
});
