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
import {
  SessionUser,
  RoleName,
  AuthorizationError
} from '@medidesk/domain';

describe('Phase 6: Hybrid Backup RBAC & Developer Isolation Security Tests', () => {
  let testDir: string;
  let backupDir: string;
  let db: SqliteDatabase;
  let backupService: BackupService;
  let testDbPath: string;

  const orgId = 'org-sec-hybrid';

  const ownerUser: SessionUser = {
    id: 'user-owner-sec',
    organizationId: orgId,
    organizationName: 'Security Clinic',
    username: 'owner_sec',
    email: 'owner@sec.com',
    fullName: 'Dr. Security Owner',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const developerUser: SessionUser = {
    id: 'user-dev-sec',
    organizationId: orgId,
    organizationName: 'Security Clinic',
    username: 'dev_sec',
    email: 'dev@medidesk.io',
    fullName: 'System Developer',
    roles: [RoleName.DEVELOPER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-sec-hybrid-'));
    backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    testDbPath = path.join(testDir, 'sec_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Security Clinic', 'SEC')`).run(orgId);
    db.getRawDb().prepare(`INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 'hash', 1)`).run(
      ownerUser.id,
      orgId,
      ownerUser.username,
      ownerUser.email,
      ownerUser.fullName
    );
    db.getRawDb().prepare(`INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 'hash', 1)`).run(
      developerUser.id,
      orgId,
      developerUser.username,
      developerUser.email,
      developerUser.fullName
    );

    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();
    const backupLogRepo = new SqliteBackupLogRepository(db);
    const backupSettingsRepo = new SqliteBackupSettingsRepository(db);
    const gdriveProvider = new GoogleDriveProvider();

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

  it('1. Owner has full authorization to configure backup settings, trigger backups, and restore', async () => {
    // 1. Owner updates backup settings
    const updated = await backupService.updateSettings(orgId, { backupMode: 'HYBRID', localRetentionDays: 60 }, ownerUser);
    expect(updated.backupMode).toBe('HYBRID');
    expect(updated.localRetentionDays).toBe(60);

    // 2. Owner creates backup
    const backup = await backupService.createHybridBackup({ mode: 'LOCAL_ONLY', actor: ownerUser });
    expect(backup.localStatus).toBe('SUCCESS');

    // 3. Owner restores backup
    await expect(
      backupService.restore({
        source: 'LOCAL',
        backupIdOrPath: backup.filePath,
        targetDbPath: testDbPath,
        actor: ownerUser
      })
    ).resolves.not.toThrow();
  });

  it('2. Developer is strictly denied permission to restore database or modify backup settings', async () => {
    // Create a valid backup by Owner
    const backup = await backupService.createHybridBackup({ mode: 'LOCAL_ONLY', actor: ownerUser });

    // Developer attempts restore -> must throw AuthorizationError
    await expect(
      backupService.restore({
        source: 'LOCAL',
        backupIdOrPath: backup.filePath,
        targetDbPath: testDbPath,
        actor: developerUser
      })
    ).rejects.toThrow(AuthorizationError);

    // Developer attempts modifying backup settings -> must throw AuthorizationError
    await expect(
      backupService.updateSettings(orgId, { backupMode: 'LOCAL_ONLY' }, developerUser)
    ).rejects.toThrow(AuthorizationError);
  });
});
