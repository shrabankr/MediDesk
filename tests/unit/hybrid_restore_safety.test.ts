import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  SqliteDatabase,
  MigrationRunner,
  SqlitePatientRepository,
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
  CorruptBackupError
} from '@medidesk/domain';

describe('Phase 6: Hybrid Restore Safety & Failure Handling Tests', () => {
  let testDir: string;
  let backupDir: string;
  let db: SqliteDatabase;
  let backupService: BackupService;
  let gdriveProvider: GoogleDriveProvider;
  let patientRepo: SqlitePatientRepository;
  let testDbPath: string;

  const orgId = 'org-restore-test';

  const ownerUser: SessionUser = {
    id: 'user-owner-rst',
    organizationId: orgId,
    organizationName: 'Restore Clinic',
    username: 'owner_rst',
    email: 'owner@rst.com',
    fullName: 'Dr. Restore Owner',
    roles: [RoleName.OWNER],
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0
  };

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medidesk-restore-test-'));
    backupDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    testDbPath = path.join(testDir, 'restore_test.sqlite');
    db = new SqliteDatabase({ databasePath: testDbPath });

    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const runner = new MigrationRunner(db, migrationsDir);
    runner.runPendingMigrations();

    db.getRawDb().prepare(`INSERT INTO organizations (id, name, code) VALUES (?, 'Restore Clinic', 'RST')`).run(orgId);
    db.getRawDb().prepare(`INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active) VALUES (?, ?, ?, ?, ?, 'hash', 1)`).run(
      ownerUser.id,
      orgId,
      ownerUser.username,
      ownerUser.email,
      ownerUser.fullName
    );

    patientRepo = new SqlitePatientRepository(db);
    const auditRepo = new SqliteAuditRepository(db);
    const auditService = new AuditService(auditRepo);
    const rbac = new RBACEngine();
    const backupLogRepo = new SqliteBackupLogRepository(db);
    const backupSettingsRepo = new SqliteBackupSettingsRepository(db);
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

  it('1. performs local restore with PRE_RESTORE_SAFETY creation and data integrity verification', async () => {
    // 1. Create Patient 1 in live DB
    const p1 = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Original Patient Before Restore',
      sex: 'MALE',
      mobile: '9900011111'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const customPass = 'ClinicSecretPassphrase#2026';
    const backup = await backupService.createHybridBackup({
      mode: 'LOCAL_ONLY',
      passphrase: customPass,
      actor: ownerUser
    });

    // 2. Modify live database (add Patient 2)
    await patientRepo.create({
      organizationId: orgId,
      fullName: 'Patient Added Later',
      sex: 'FEMALE',
      mobile: '9900022222'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    db.close();

    // 3. Restore backup
    await backupService.restore({
      source: 'LOCAL',
      backupIdOrPath: backup.filePath,
      passphrase: customPass,
      targetDbPath: testDbPath,
      actor: ownerUser
    });

    // 4. Verify only Patient 1 exists in restored database
    const restoredDb = new SqliteDatabase({ databasePath: testDbPath });
    const restoredPatientRepo = new SqlitePatientRepository(restoredDb);
    const list = await restoredPatientRepo.search({ organizationId: orgId });
    expect(list.length).toBe(1);
    expect(list[0].fullName).toBe(p1.fullName);

    // Verify automatic PRE_RESTORE_SAFETY backup exists in backupDir
    const files = fs.readdirSync(backupDir);
    const safetySnapshot = files.find(f => f.includes('medidesk-encrypted'));
    expect(safetySnapshot).toBeDefined();

    restoredDb.close();
  });

  it('2. performs Google Drive cloud restore: downloads remote encrypted artifact, decrypts, and restores cleanly', async () => {
    gdriveProvider.setForceOffline(false);
    gdriveProvider.setTokens({ accessToken: 'test-token', accountEmail: 'clinic@gmail.com' });

    // 1. Create patient and take HYBRID backup (which uploads to Google Drive)
    const p1 = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Cloud Snapshot Patient',
      sex: 'FEMALE',
      mobile: '9888877777'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const pass = 'CloudPassphrase#999';
    const hybridBackup = await backupService.createHybridBackup({
      mode: 'HYBRID',
      passphrase: pass,
      actor: ownerUser
    });

    expect(hybridBackup.remoteFileId).toBeDefined();

    // 2. Corrupt / Mutate local database
    db.getRawDb().prepare('DELETE FROM patients').run();
    db.close();

    // 3. Restore directly from Google Drive remoteFileId
    await backupService.restore({
      source: 'GOOGLE_DRIVE',
      backupIdOrPath: hybridBackup.remoteFileId!,
      passphrase: pass,
      targetDbPath: testDbPath,
      actor: ownerUser
    });

    // 4. Verify restored DB has original patient
    const restoredDb = new SqliteDatabase({ databasePath: testDbPath });
    const restoredPatientRepo = new SqlitePatientRepository(restoredDb);
    const list = await restoredPatientRepo.search({ organizationId: orgId });
    expect(list.length).toBe(1);
    expect(list[0].fullName).toBe(p1.fullName);

    restoredDb.close();
  });

  it('3. rejects restore with wrong passphrase and preserves active database untouched', async () => {
    const p1 = await patientRepo.create({
      organizationId: orgId,
      fullName: 'Protected Active Patient',
      sex: 'MALE',
      mobile: '9123456780'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const correctPass = 'CorrectPassword#123';
    const backup = await backupService.createHybridBackup({
      mode: 'LOCAL_ONLY',
      passphrase: correctPass,
      actor: ownerUser
    });

    db.close();

    // Attempt restore with WRONG password
    await expect(
      backupService.restore({
        source: 'LOCAL',
        backupIdOrPath: backup.filePath,
        passphrase: 'WrongPassword#999',
        targetDbPath: testDbPath,
        actor: ownerUser
      })
    ).rejects.toThrow(CorruptBackupError);

    // Verify active DB is preserved and still intact
    const checkDb = new SqliteDatabase({ databasePath: testDbPath });
    const checkPatientRepo = new SqlitePatientRepository(checkDb);
    const list = await checkPatientRepo.search({ organizationId: orgId });
    expect(list.length).toBe(1);
    expect(list[0].fullName).toBe(p1.fullName);

    checkDb.close();
  });

  it('4. rejects restore of corrupted/tampered ciphertext (auth tag mismatch)', async () => {
    await patientRepo.create({
      organizationId: orgId,
      fullName: 'Tamper Test Patient',
      sex: 'FEMALE',
      mobile: '9555544444'
    });

    db.getRawDb().pragma('wal_checkpoint(TRUNCATE)');
    const backup = await backupService.createHybridBackup({ mode: 'LOCAL_ONLY', actor: ownerUser });
    db.close();

    // Tamper with ciphertext bytes in the file
    const fileBytes = fs.readFileSync(backup.filePath);
    fileBytes[fileBytes.length - 5] ^= 0xff; // Flip bits in ciphertext
    fs.writeFileSync(backup.filePath, fileBytes);

    // Attempt restore -> must fail auth tag verification
    await expect(
      backupService.restore({
        source: 'LOCAL',
        backupIdOrPath: backup.filePath,
        targetDbPath: testDbPath,
        actor: ownerUser
      })
    ).rejects.toThrow(CorruptBackupError);
  });
});
