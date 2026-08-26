import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqliteBackupLogRepository,
  SqliteAuditRepository,
  SqlitePatientRepository
} from '@medidesk/database';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { BackupService } from '@medidesk/backup';
import { SessionUser, RoleName, CorruptBackupError } from '@medidesk/domain';

describe('Phase 6: Backup & Restore Integrity Unit Tests', () => {
  let testDir: string;
  let backupDir: string;
  let db: SqliteDatabase;
  let backupService: BackupService;
  let backupRepo: SqliteBackupLogRepository;
  let patientRepo: SqlitePatientRepository;
  let testDbPath: string;

  const orgId = 'org-backup-test';

  const ownerUser: SessionUser = {
    id: 'user-owner-bak',
    organizationId: orgId,
    organizationName: 'Backup Clinic',
    username: 'owner_bak',
    email: 'owner@clinic.com',
    fullName: 'Dr. Owner Backup',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-backup-test-'));
    backupDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(backupDir, { recursive: true });

    testDbPath = path.join(testDir, 'live_clinic.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Backup Clinic', 'BAK')`).run(orgId);
    db.getRawDb().prepare(`INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 'hash', 1)`).run(
      ownerUser.id,
      orgId,
      ownerUser.username,
      ownerUser.email,
      ownerUser.fullName
    );

    backupRepo = new SqliteBackupLogRepository(db);
    patientRepo = new SqlitePatientRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();

    backupService = new BackupService(testDbPath, backupDir, backupRepo, auditService, rbac);
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

  it('creates local atomic SQLite snapshot with valid SHA-256 checksum and sidecar file', async () => {
    // Checkpoint SQLite WAL
    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');

    // Insert patient before backup
    await patientRepo.create({
      organizationId: orgId,
      fullName: 'Pre Backup Patient',
      sex: 'MALE',
      mobile: '9888877771'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');

    const metadata = await backupService.createLocalBackup(backupDir, ownerUser, 'MANUAL');
    expect(metadata.isVerified).toBe(true);
    expect(fs.existsSync(metadata.filePath)).toBe(true);

    // Verify sidecar .sha256 file
    const sidecarPath = `${metadata.filePath}.sha256`;
    expect(fs.existsSync(sidecarPath)).toBe(true);
    const sidecarContent = fs.readFileSync(sidecarPath, 'utf8');
    expect(sidecarContent).toContain(metadata.sha256Checksum);

    // Verify backup log recorded in database
    const logs = await backupRepo.listByOrg(orgId);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].sha256Checksum).toBe(metadata.sha256Checksum);
  });

  it('verifies valid backup files and rejects corrupted/tampered files', async () => {
    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const metadata = await backupService.createLocalBackup(backupDir, ownerUser);

    // 1. Verify valid file
    const isValid = await backupService.verifyBackup(metadata.filePath, metadata.sha256Checksum, ownerUser);
    expect(isValid).toBe(true);

    // 2. Create tampered file (tamper bytes in a copy)
    const tamperedPath = path.join(backupDir, 'tampered-backup.sqlite');
    fs.copyFileSync(metadata.filePath, tamperedPath);
    fs.appendFileSync(tamperedPath, 'CORRUPT_BYTES_DATA');

    // Expected original hash will not match tampered file
    const isTamperedValid = await backupService.verifyBackup(tamperedPath, metadata.sha256Checksum, ownerUser);
    expect(isTamperedValid).toBe(false);
  });

  it('creates automatic safety snapshot before restoring and restores database state cleanly', async () => {
    // 1. Create Patient 1 and take Snapshot A
    const p1 = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Patient Snapshot A',
      sex: 'MALE',
      mobile: '9111122221'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const snapshotA = await backupService.createLocalBackup(backupDir, ownerUser);

    // 2. Create Patient 2 in live database
    await patientRepo.create({
      organizationId: orgId,
      fullName: 'Patient Added Later',
      sex: 'FEMALE',
      mobile: '9111122222'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');

    const preRestoreList = await patientRepo.search({ organizationId: orgId });
    expect(preRestoreList.length).toBe(2);

    // 3. Close active db handle before restoring file
    db.close();

    // 4. Restore Snapshot A
    await backupService.restoreBackup(snapshotA.filePath, testDbPath, ownerUser);

    // 5. Reconnect to database and verify only Patient 1 exists
    const restoredDb = new SqliteDatabase({ databasePath: testDbPath });
    const restoredPatientRepo = new SqlitePatientRepository(restoredDb);

    const postRestoreList = await restoredPatientRepo.search({ organizationId: orgId });
    expect(postRestoreList.length).toBe(1);
    expect(postRestoreList[0].fullName).toBe(p1.fullName);

    // Verify safety backup was created in backupDir
    const files = fs.readdirSync(backupDir);
    const safetyBackup = files.find(f => f.includes('medidesk-encrypted') || f.startsWith('safety-backup'));
    expect(safetyBackup).toBeDefined();

    restoredDb.close();
  });

  it('creates AES-256-GCM encrypted backup, restores with valid passphrase, and rejects invalid passphrase', async () => {
    // 1. Create Patient 1 and take Encrypted Snapshot
    const p1 = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Patient Encrypted Original',
      sex: 'MALE',
      mobile: '9777711111'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const passphrase = 'SuperSecureSecretPassword#123';
    const encBackup = await backupService.createEncryptedBackup(passphrase, backupDir, ownerUser);

    expect(encBackup.filePath.endsWith('.enc')).toBe(true);
    expect(fs.existsSync(encBackup.filePath)).toBe(true);

    // Verify sidecar exists
    expect(fs.existsSync(`${encBackup.filePath}.sha256`)).toBe(true);

    // 2. Modify live database
    await patientRepo.create({
      organizationId: orgId,
      fullName: 'Patient Added After Encrypted Backup',
      sex: 'FEMALE',
      mobile: '9777722222'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    db.close();

    // 3. Attempt restore with WRONG passphrase -> must fail
    await expect(
      backupService.restoreEncryptedBackup(encBackup.filePath, 'WrongPassphrase#999', testDbPath, ownerUser)
    ).rejects.toThrow(CorruptBackupError);

    // 4. Restore with CORRECT passphrase -> must succeed
    await backupService.restoreEncryptedBackup(encBackup.filePath, passphrase, testDbPath, ownerUser);

    const restoredDb = new SqliteDatabase({ databasePath: testDbPath });
    const restoredPatientRepo = new SqlitePatientRepository(restoredDb);

    const list = await restoredPatientRepo.search({ organizationId: orgId });
    expect(list.length).toBe(1);
    expect(list[0].fullName).toBe(p1.fullName);

    restoredDb.close();
  });
});
