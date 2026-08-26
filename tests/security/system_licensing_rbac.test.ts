import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteBackupLogRepository,
  SqliteLicenseRepository,
  SqliteAuditRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { BackupService } from '@medidesk/backup';
import { LicenseService } from '@medidesk/licensing';
import { SessionUser, RoleName, AuthorizationError } from '@medidesk/domain';

describe('Phase 6: RBAC & Developer Security Isolation Tests for Licensing & Backups', () => {
  let testDir: string;
  let db: SqliteDatabase;
  let backupService: BackupService;
  let licenseService: LicenseService;

  const orgId = 'org-sec-sys-1';

  const ownerUser: SessionUser = {
    id: 'user-sec-owner',
    organizationId: orgId,
    organizationName: 'Secure Clinic',
    username: 'owner_sec',
    email: 'owner@sec.com',
    fullName: 'Owner Secure',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const doctorUser: SessionUser = {
    id: 'user-sec-dr',
    organizationId: orgId,
    organizationName: 'Secure Clinic',
    username: 'dr_sec',
    email: 'dr@sec.com',
    fullName: 'Dr. Secure',
    roles: [RoleName.DOCTOR],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const staffUser: SessionUser = {
    id: 'user-sec-staff',
    organizationId: orgId,
    organizationName: 'Secure Clinic',
    username: 'staff_sec',
    email: 'staff@sec.com',
    fullName: 'Staff Secure',
    roles: [RoleName.STAFF],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  const developerUser: SessionUser = {
    id: 'user-sec-dev',
    organizationId: orgId,
    organizationName: 'Secure Clinic',
    username: 'dev_sec',
    email: 'dev@medidesk.io',
    fullName: 'Developer Tech',
    roles: [RoleName.DEVELOPER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-sys-sec-test-'));
    const testDbPath = path.join(testDir, 'sec.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Secure Clinic', 'SEC')`).run(orgId);

    const backupRepo = new SqliteBackupLogRepository(db);
    const licenseRepo = new SqliteLicenseRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    backupService = new BackupService(testDbPath, testDir, backupRepo, auditService, rbac);
    licenseService = new LicenseService(licenseRepo, auditService, rbac, undefined, false);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('allows Owner to create backup and access license management', async () => {
    const backup = await backupService.createLocalBackup(undefined, ownerUser);
    expect(backup.isVerified).toBe(true);

    const backupsList = await backupService.listBackups(ownerUser);
    expect(backupsList.length).toBeGreaterThan(0);
  });

  it('strictly denies Developer from restoring databases or activating customer licenses', async () => {
    // 1. Developer cannot restore database
    await expect(
      backupService.restoreBackup(path.join(testDir, 'dummy.sqlite'), path.join(testDir, 'target.sqlite'), developerUser)
    ).rejects.toThrow(AuthorizationError);

    // 2. Developer cannot activate license
    await expect(
      licenseService.activateLicenseToken('token.sig', developerUser)
    ).rejects.toThrow(AuthorizationError);
  });

  it('strictly denies Doctor and Staff from restoring databases or activating commercial licenses', async () => {
    // 1. Doctor cannot restore database
    await expect(
      backupService.restoreBackup(path.join(testDir, 'dummy.sqlite'), path.join(testDir, 'target.sqlite'), doctorUser)
    ).rejects.toThrow(AuthorizationError);

    // 2. Staff cannot restore database
    await expect(
      backupService.restoreBackup(path.join(testDir, 'dummy.sqlite'), path.join(testDir, 'target.sqlite'), staffUser)
    ).rejects.toThrow(AuthorizationError);
  });
});
