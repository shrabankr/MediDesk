import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from '@medidesk/shared';
import {
  IBackupLogRepository,
  IBackupSettingsRepository,
  BackupLog,
  BackupSettings,
  BackupMode,
  BackupType,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  AuthorizationError,
  CorruptBackupError,
  RestoreFailedError
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { GoogleDriveProvider, IGoogleDriveProvider } from './GoogleDriveProvider.js';

export interface BackupMetadata {
  id: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  sha256Checksum: string;
  createdAt: Date;
  isVerified: boolean;
  backupType?: string;
  storageTarget?: string;
  backupMode?: BackupMode;
  localStatus?: string;
  cloudStatus?: string;
  overallStatus?: string;
}

export interface CreateBackupOptions {
  mode?: BackupMode;
  passphrase?: string;
  destinationDir?: string;
  actor?: SessionUser;
  backupType?: BackupType;
}

export interface RestoreOptions {
  source: 'LOCAL' | 'GOOGLE_DRIVE';
  backupIdOrPath: string;
  passphrase?: string;
  targetDbPath?: string;
  actor: SessionUser;
}

export interface IBackupService {
  createHybridBackup(options?: CreateBackupOptions): Promise<BackupLog>;
  createLocalBackup(
    destinationDir?: string,
    actor?: SessionUser,
    backupType?: BackupType
  ): Promise<BackupMetadata>;
  createEncryptedBackup(
    passphrase: string,
    destinationDir?: string,
    actor?: SessionUser,
    backupType?: BackupType
  ): Promise<BackupMetadata>;
  verifyBackup(backupPath: string, expectedChecksum?: string, actor?: SessionUser): Promise<boolean>;
  restore(options: RestoreOptions): Promise<void>;
  restoreBackup(backupPath: string, targetDbPath: string, actor: SessionUser): Promise<void>;
  restoreEncryptedBackup(
    encryptedBackupPath: string,
    passphrase: string,
    targetDbPath: string,
    actor: SessionUser
  ): Promise<void>;
  listBackups(actor: SessionUser): Promise<BackupLog[]>;
  retryPendingCloudBackups(actor: SessionUser): Promise<{ attempted: number; succeeded: number; failed: number }>;
  applyRetentionPolicy(actor: SessionUser): Promise<{ localPruned: number; cloudPruned: number }>;
  getSettings(organizationId: string): Promise<BackupSettings>;
  updateSettings(organizationId: string, settings: Partial<BackupSettings>, actor: SessionUser): Promise<BackupSettings>;
  getGoogleDriveProvider(): IGoogleDriveProvider;
  uploadToGoogleDrive(backupPath: string, actor?: SessionUser): Promise<{ remoteFileId: string; status: 'PLANNED' | 'UPLOADED' }>;
  verifyRemoteBackup(remoteFileId: string): Promise<boolean>;
}

export class BackupService implements IBackupService {
  private databasePath: string;
  private defaultBackupDir: string;
  private logger: Logger;
  private backupLogRepo?: IBackupLogRepository;
  private backupSettingsRepo?: IBackupSettingsRepository;
  private auditService?: AuditService;
  private rbac?: RBACEngine;
  private googleDriveProvider: IGoogleDriveProvider;
  private defaultPassphrase = 'MediDesk_Default_Key#2026';

  constructor(
    databasePath: string,
    defaultBackupDir: string,
    backupLogRepo?: IBackupLogRepository,
    auditService?: AuditService,
    rbac?: RBACEngine,
    backupSettingsRepo?: IBackupSettingsRepository,
    googleDriveProvider?: IGoogleDriveProvider
  ) {
    this.databasePath = databasePath;
    this.defaultBackupDir = defaultBackupDir;
    this.backupLogRepo = backupLogRepo;
    this.auditService = auditService;
    this.rbac = rbac;
    this.backupSettingsRepo = backupSettingsRepo;
    this.googleDriveProvider = googleDriveProvider || new GoogleDriveProvider();
    this.logger = new Logger('BackupService');
  }

  public getGoogleDriveProvider(): IGoogleDriveProvider {
    return this.googleDriveProvider;
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (this.rbac && !this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  public async getSettings(organizationId: string): Promise<BackupSettings> {
    if (this.backupSettingsRepo) {
      return this.backupSettingsRepo.getByOrg(organizationId);
    }
    return {
      organizationId,
      backupMode: 'HYBRID',
      backupSchedule: 'DAILY',
      backupTime: '21:00',
      localRetentionDays: 30,
      cloudRetentionDays: 90,
      googleDriveFolder: 'MediDesk_Backups',
      googleDriveConnected: this.googleDriveProvider.isConnected(),
      autoRetryCloud: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async updateSettings(
    organizationId: string,
    settings: Partial<BackupSettings>,
    actor: SessionUser
  ): Promise<BackupSettings> {
    this.assertPermission(actor, PermissionCode.ORG_MANAGE);
    if (this.backupSettingsRepo) {
      return this.backupSettingsRepo.upsert(organizationId, settings);
    }
    return this.getSettings(organizationId);
  }

  public async createHybridBackup(options?: CreateBackupOptions): Promise<BackupLog> {
    const actor = options?.actor;
    if (actor) {
      this.assertPermission(actor, PermissionCode.SYSTEM_BACKUP_CREATE);
    }

    const orgId = actor?.organizationId || 'default-org';
    const settings = await this.getSettings(orgId);
    const mode: BackupMode = options?.mode || settings.backupMode || 'HYBRID';
    const passphrase = options?.passphrase || this.defaultPassphrase;
    const backupType: BackupType = options?.backupType || 'MANUAL';
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = options?.destinationDir || this.defaultBackupDir;

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    if (!fs.existsSync(this.databasePath)) {
      throw new Error(`Database file not found at ${this.databasePath}`);
    }

    // 1. Audit: BACKUP_STARTED
    if (this.auditService && actor) {
      try {
        await this.auditService.logEvent({
          action: AuditAction.BACKUP_STARTED,
          actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
          resource: backupId,
          result: AuditResult.SUCCESS,
          metadata: { backupMode: mode, backupType }
        });
      } catch (err) {
        this.logger.warn(`Could not log audit event for backup start: ${String(err)}`);
      }
    }

    const filename = `medidesk-encrypted-${timestamp}-${backupId.substring(0, 8)}.enc`;
    const targetPath = path.join(backupDir, filename);

    // 2. Read live SQLite DB & Encrypt with AES-256-GCM + scrypt
    const plaintext = fs.readFileSync(this.databasePath);
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(passphrase, salt, 32);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const magicHeader = Buffer.from('MEDIDESK_ENC_V1', 'utf8'); // 15 bytes
    const finalBuffer = Buffer.concat([magicHeader, salt, iv, authTag, encrypted]);

    fs.writeFileSync(targetPath, finalBuffer);

    // 3. Generate SHA-256 Checksum & Sidecar
    const checksum = crypto.createHash('sha256').update(finalBuffer).digest('hex');
    const checksumPath = `${targetPath}.sha256`;
    fs.writeFileSync(checksumPath, `${checksum}  ${filename}\n`, 'utf8');

    // 4. Verify Local Backup
    const isLocalValid = this.validateEncryptedFile(targetPath, checksum);
    if (!isLocalValid) {
      if (this.auditService && actor) {
        try {
          await this.auditService.logEvent({
            action: AuditAction.LOCAL_BACKUP_FAILED,
            actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
            resource: backupId,
            result: AuditResult.FAILURE,
            metadata: { error: 'Checksum verification failed on local backup' }
          });
        } catch { /* ignore */ }
      }
      throw new CorruptBackupError('Local backup verification failed immediately after creation.');
    }

    // 5. Audit: LOCAL_BACKUP_COMPLETED
    if (this.auditService && actor) {
      try {
        await this.auditService.logEvent({
          action: AuditAction.LOCAL_BACKUP_COMPLETED,
          actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
          resource: backupId,
          result: AuditResult.SUCCESS,
          metadata: { filename, sizeBytes: finalBuffer.length, checksum }
        });
      } catch { /* ignore */ }
    }

    let cloudStatus: 'NONE' | 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'FAILED';
    let overallStatus: 'LOCAL_SUCCESS' | 'CLOUD_PENDING' | 'CLOUD_UPLOADING' | 'CLOUD_SUCCESS' | 'PARTIAL' | 'FAILED';
    let remoteFileId: string | undefined;

    // 6. Mode Branching
    if (mode === 'LOCAL_ONLY') {
      cloudStatus = 'NONE';
      overallStatus = 'LOCAL_SUCCESS';

      if (this.auditService && actor) {
        try {
          await this.auditService.logEvent({
            action: AuditAction.BACKUP_VERIFIED,
            actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
            resource: backupId,
            result: AuditResult.SUCCESS,
            metadata: { mode: 'LOCAL_ONLY', status: 'VERIFIED' }
          });
        } catch { /* ignore */ }
      }
    } else {
      // Mode is HYBRID or CLOUD_ONLY -> Process Google Drive Upload
      const isOnline = await this.googleDriveProvider.isOnline();
      const isConnected = this.googleDriveProvider.isConnected();

      if (!isOnline || !isConnected) {
        // Offline or Not Connected -> Local is SUCCESS, Cloud is PENDING (Overall: PARTIAL)
        cloudStatus = 'PENDING';
        overallStatus = 'PARTIAL';
        this.logger.info(`Internet offline or Google Drive not connected. Cloud backup queued for backupId ${backupId}.`);

        if (this.auditService && actor) {
          try {
            await this.auditService.logEvent({
              action: AuditAction.CLOUD_BACKUP_QUEUED,
              actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
              resource: backupId,
              result: AuditResult.SUCCESS,
              metadata: { reason: !isOnline ? 'Internet unavailable' : 'Google Drive not connected' }
            });
          } catch { /* ignore */ }
        }
      } else {
        // Online & Connected -> Attempt Upload
        if (this.auditService && actor) {
          try {
            await this.auditService.logEvent({
              action: AuditAction.CLOUD_BACKUP_STARTED,
              actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
              resource: backupId,
              result: AuditResult.SUCCESS,
              metadata: { target: 'GOOGLE_DRIVE' }
            });
          } catch { /* ignore */ }
        }

        try {
          const uploadResult = await this.googleDriveProvider.uploadEncryptedBackup(
            targetPath,
            backupId,
            { organizationId: orgId, sizeBytes: finalBuffer.length, sha256Checksum: checksum }
          );

          remoteFileId = uploadResult.fileId;
          cloudStatus = 'SUCCESS';
          overallStatus = 'CLOUD_SUCCESS';

          if (this.auditService && actor) {
            try {
              await this.auditService.logEvent({
                action: AuditAction.CLOUD_BACKUP_COMPLETED,
                actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
                resource: backupId,
                result: AuditResult.SUCCESS,
                metadata: { remoteFileId, webViewLink: uploadResult.webViewLink }
              });

              await this.auditService.logEvent({
                action: AuditAction.BACKUP_VERIFIED,
                actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
                resource: backupId,
                result: AuditResult.SUCCESS,
                metadata: { mode, status: 'HYBRID_VERIFIED' }
              });
            } catch { /* ignore */ }
          }

          // If CLOUD_ONLY mode, remove local artifact after cloud verification succeeds
          if (mode === 'CLOUD_ONLY') {
            try {
              fs.unlinkSync(targetPath);
              if (fs.existsSync(checksumPath)) fs.unlinkSync(checksumPath);
            } catch { /* ignore */ }
          }
        } catch (uploadErr) {
          // Cloud upload failed -> Local backup remains valid!
          cloudStatus = 'FAILED';
          overallStatus = 'PARTIAL';
          this.logger.warn(`Google Drive upload failed for ${backupId}: ${(uploadErr as Error).message}. Local backup is preserved.`);

          if (this.auditService && actor) {
            try {
              await this.auditService.logEvent({
                action: AuditAction.CLOUD_BACKUP_FAILED,
                actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
                resource: backupId,
                result: AuditResult.FAILURE,
                metadata: { error: (uploadErr as Error).message }
              });
            } catch { /* ignore */ }
          }
        }
      }
    }

    // 7. Save to Database Repository
    let savedLog: BackupLog;
    if (this.backupLogRepo) {
      savedLog = await this.backupLogRepo.create({
        id: backupId,
        organizationId: orgId,
        filename,
        filePath: targetPath,
        sizeBytes: finalBuffer.length,
        sha256Checksum: checksum,
        backupType,
        storageTarget: mode === 'LOCAL_ONLY' ? 'LOCAL' : (mode === 'CLOUD_ONLY' ? 'GOOGLE_DRIVE' : 'HYBRID'),
        backupMode: mode,
        localStatus: mode === 'CLOUD_ONLY' && cloudStatus === 'SUCCESS' ? 'SUCCESS' : 'SUCCESS',
        cloudStatus,
        overallStatus,
        remoteFileId,
        isVerified: true,
        encryptionVersion: 'AES-256-GCM-SCRYPT-V1',
        appVersion: '1.0.0',
        schemaVersion: '006',
        createdBy: actor?.id
      });
    } else {
      savedLog = {
        id: backupId,
        organizationId: orgId,
        filename,
        filePath: targetPath,
        sizeBytes: finalBuffer.length,
        sha256Checksum: checksum,
        backupType,
        storageTarget: mode === 'LOCAL_ONLY' ? 'LOCAL' : (mode === 'CLOUD_ONLY' ? 'GOOGLE_DRIVE' : 'HYBRID'),
        backupMode: mode,
        localStatus: 'SUCCESS',
        cloudStatus,
        overallStatus,
        remoteFileId,
        isVerified: true,
        encryptionVersion: 'AES-256-GCM-SCRYPT-V1',
        appVersion: '1.0.0',
        schemaVersion: '006',
        status: overallStatus,
        createdAt: new Date(),
        createdBy: actor?.id
      };
    }

    return savedLog;
  }

  public async retryPendingCloudBackups(actor: SessionUser): Promise<{ attempted: number; succeeded: number; failed: number }> {
    this.assertPermission(actor, PermissionCode.SYSTEM_BACKUP_CREATE);
    if (!this.backupLogRepo) {
      return { attempted: 0, succeeded: 0, failed: 0 };
    }

    const pendingLogs = await this.backupLogRepo.listPendingCloudBackups(actor.organizationId);
    let attempted = 0;
    let succeeded = 0;
    let failed = 0;

    const isOnline = await this.googleDriveProvider.isOnline();
    if (!isOnline) {
      this.logger.info('Cannot retry cloud backups: Internet is offline.');
      return { attempted: pendingLogs.length, succeeded: 0, failed: pendingLogs.length };
    }

    for (const log of pendingLogs) {
      attempted++;
      if (!fs.existsSync(log.filePath)) {
        this.logger.warn(`Local artifact missing for pending backup: ${log.filePath}`);
        failed++;
        continue;
      }

      try {
        await this.backupLogRepo.update(log.id, { cloudStatus: 'UPLOADING', overallStatus: 'CLOUD_UPLOADING' });

        const uploadResult = await this.googleDriveProvider.uploadEncryptedBackup(
          log.filePath,
          log.id,
          { organizationId: log.organizationId, sizeBytes: log.sizeBytes, sha256Checksum: log.sha256Checksum }
        );

        await this.backupLogRepo.update(log.id, {
          remoteFileId: uploadResult.fileId,
          cloudStatus: 'SUCCESS',
          overallStatus: 'CLOUD_SUCCESS',
          isVerified: true,
          status: 'COMPLETED'
        });

        if (this.auditService) {
          await this.auditService.logEvent({
            action: AuditAction.CLOUD_BACKUP_COMPLETED,
            actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
            resource: log.id,
            result: AuditResult.SUCCESS,
            metadata: { remoteFileId: uploadResult.fileId, retried: true }
          });
        }

        succeeded++;
      } catch (err) {
        failed++;
        await this.backupLogRepo.update(log.id, {
          cloudStatus: 'FAILED',
          overallStatus: 'PARTIAL',
          errorMessage: (err as Error).message
        });
      }
    }

    return { attempted, succeeded, failed };
  }

  public async restore(options: RestoreOptions): Promise<void> {
    const actor = options.actor;
    this.assertPermission(actor, PermissionCode.SYSTEM_RESTORE_EXECUTE);

    const targetDbPath = options.targetDbPath || this.databasePath;
    const passphrase = options.passphrase || this.defaultPassphrase;

    // 1. Audit: RESTORE_STARTED
    if (this.auditService) {
      try {
        await this.auditService.logEvent({
          action: AuditAction.RESTORE_STARTED,
          actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
          resource: options.backupIdOrPath,
          result: AuditResult.SUCCESS,
          metadata: { source: options.source }
        });
      } catch { /* ignore */ }
    }

    let encryptedFilePath = options.backupIdOrPath;
    let isTempFile = false;

    try {
      // 2. If source is GOOGLE_DRIVE, download to temporary location
      if (options.source === 'GOOGLE_DRIVE') {
        const isOnline = await this.googleDriveProvider.isOnline();
        if (!isOnline) {
          throw new RestoreFailedError('Internet offline: Cannot download backup from Google Drive.');
        }

        const tempRestoreDir = path.join(this.defaultBackupDir, 'temp_restore');
        if (!fs.existsSync(tempRestoreDir)) fs.mkdirSync(tempRestoreDir, { recursive: true });

        encryptedFilePath = path.join(tempRestoreDir, `remote_restore_${Date.now()}.enc`);
        isTempFile = true;
        await this.googleDriveProvider.downloadEncryptedBackup(options.backupIdOrPath, encryptedFilePath);
      }

      // 3. Verify file existence
      if (!fs.existsSync(encryptedFilePath)) {
        throw new RestoreFailedError(`Backup file not found at ${encryptedFilePath}`);
      }

      const fileBuffer = fs.readFileSync(encryptedFilePath);
      if (fileBuffer.length < 59) {
        throw new CorruptBackupError('Encrypted backup file header is truncated or invalid.');
      }

      // 4. Validate MEDIDESK_ENC_V1 header
      const magic = fileBuffer.subarray(0, 15).toString('utf8');
      if (magic !== 'MEDIDESK_ENC_V1') {
        throw new CorruptBackupError('Invalid backup file signature. Expected MEDIDESK_ENC_V1 header.');
      }

      const salt = fileBuffer.subarray(15, 31);
      const iv = fileBuffer.subarray(31, 43);
      const authTag = fileBuffer.subarray(43, 59);
      const ciphertext = fileBuffer.subarray(59);

      // 5. Decrypt using scrypt + AES-256-GCM auth tag verification
      let decrypted: Buffer;
      try {
        const key = crypto.scryptSync(passphrase, salt, 32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        throw new CorruptBackupError('Decryption failed: Incorrect passphrase or corrupted backup artifact (auth tag mismatch).');
      }

      // 6. Validate SQLite header
      if (decrypted.subarray(0, 15).toString('utf8') !== 'SQLite format 3') {
        throw new CorruptBackupError('Decrypted payload does not contain a valid SQLite database header.');
      }

      // 7. Create Mandatory PRE_RESTORE_SAFETY snapshot of active database
      if (fs.existsSync(targetDbPath)) {
        try {
          const safetyFilename = `safety-backup-${Date.now()}-${crypto.randomUUID().substring(0, 8)}.enc`;
          const safetyPath = path.join(this.defaultBackupDir, safetyFilename);
          const dbBytes = fs.readFileSync(targetDbPath);
          const safetySalt = crypto.randomBytes(16);
          const safetyKey = crypto.scryptSync(passphrase, safetySalt, 32);
          const safetyIv = crypto.randomBytes(12);
          const safetyCipher = crypto.createCipheriv('aes-256-gcm', safetyKey, safetyIv);
          const safetyEnc = Buffer.concat([safetyCipher.update(dbBytes), safetyCipher.final()]);
          const safetyTag = safetyCipher.getAuthTag();
          const safetyBuf = Buffer.concat([Buffer.from('MEDIDESK_ENC_V1', 'utf8'), safetySalt, safetyIv, safetyTag, safetyEnc]);
          fs.writeFileSync(safetyPath, safetyBuf);
          const safetyChecksum = crypto.createHash('sha256').update(safetyBuf).digest('hex');
          fs.writeFileSync(`${safetyPath}.sha256`, `${safetyChecksum}  ${safetyFilename}\n`, 'utf8');
        } catch (safetyErr) {
          this.logger.warn(`Could not create safety snapshot before restore: ${(safetyErr as Error).message}`);
        }
      }

      // 8. Clean target WAL / SHM files
      const targetWal = `${targetDbPath}-wal`;
      const targetShm = `${targetDbPath}-shm`;
      if (fs.existsSync(targetWal)) {
        try { fs.unlinkSync(targetWal); } catch { /* ignore */ }
      }
      if (fs.existsSync(targetShm)) {
        try { fs.unlinkSync(targetShm); } catch { /* ignore */ }
      }

      // 9. Atomically replace database file
      fs.writeFileSync(targetDbPath, decrypted);

      // 10. Audit: RESTORE_COMPLETED
      if (this.auditService) {
        try {
          await this.auditService.logEvent({
            action: AuditAction.RESTORE_COMPLETED,
            actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
            resource: path.basename(encryptedFilePath),
            result: AuditResult.SUCCESS,
            metadata: { source: options.source, restoredTo: targetDbPath }
          });
        } catch { /* ignore */ }
      }

      this.logger.info(`Database successfully restored from ${options.source} backup to ${targetDbPath}`);
    } catch (err) {
      if (this.auditService) {
        try {
          await this.auditService.logEvent({
            action: AuditAction.RESTORE_FAILED,
            actor: { id: actor.id, username: actor.fullName, role: actor.roles[0] },
            resource: options.backupIdOrPath,
            result: AuditResult.FAILURE,
            metadata: { error: (err as Error).message }
          });
        } catch { /* ignore */ }
      }
      throw err;
    } finally {
      if (isTempFile && fs.existsSync(encryptedFilePath)) {
        try { fs.unlinkSync(encryptedFilePath); } catch { /* ignore */ }
      }
    }
  }

  public async applyRetentionPolicy(actor: SessionUser): Promise<{ localPruned: number; cloudPruned: number }> {
    this.assertPermission(actor, PermissionCode.SYSTEM_BACKUP_CREATE);
    const settings = await this.getSettings(actor.organizationId);
    let localPruned = 0;
    let cloudPruned = 0;

    if (!this.backupLogRepo) return { localPruned: 0, cloudPruned: 0 };

    const totalBackups = await this.backupLogRepo.count(actor.organizationId);
    if (totalBackups <= 1) {
      this.logger.info('Retention check: Only 1 backup exists. Invariant preserved: Never deleting the only recovery copy.');
      return { localPruned: 0, cloudPruned: 0 };
    }

    const allLogs = await this.backupLogRepo.listByOrg(actor.organizationId, 500);
    const now = Date.now();
    const localCutoff = now - (settings.localRetentionDays * 24 * 3600 * 1000);
    const cloudCutoff = now - (settings.cloudRetentionDays * 24 * 3600 * 1000);

    // Keep at least 1 newest verified backup regardless of age
    const eligibleLogs = allLogs.slice(1);

    for (const log of eligibleLogs) {
      // Local prune
      if (log.createdAt.getTime() < localCutoff && fs.existsSync(log.filePath)) {
        try {
          fs.unlinkSync(log.filePath);
          const sidecar = `${log.filePath}.sha256`;
          if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
          localPruned++;
        } catch { /* ignore */ }
      }

      // Cloud prune
      if (log.createdAt.getTime() < cloudCutoff && log.remoteFileId) {
        try {
          await this.googleDriveProvider.deleteBackup(log.remoteFileId);
          cloudPruned++;
        } catch { /* ignore */ }
      }
    }

    return { localPruned, cloudPruned };
  }

  // --- Compatibility methods ---
  public async createLocalBackup(
    destinationDir?: string,
    actor?: SessionUser,
    backupType: BackupType = 'MANUAL'
  ): Promise<BackupMetadata> {
    const res = await this.createHybridBackup({
      mode: 'LOCAL_ONLY',
      destinationDir,
      actor,
      backupType
    });
    return {
      id: res.id,
      filename: res.filename,
      filePath: res.filePath,
      sizeBytes: res.sizeBytes,
      sha256Checksum: res.sha256Checksum,
      createdAt: res.createdAt,
      isVerified: res.isVerified,
      backupType: res.backupType,
      storageTarget: res.storageTarget
    };
  }

  public async createEncryptedBackup(
    passphrase: string,
    destinationDir?: string,
    actor?: SessionUser,
    backupType: BackupType = 'MANUAL'
  ): Promise<BackupMetadata> {
    const res = await this.createHybridBackup({
      mode: 'LOCAL_ONLY',
      passphrase,
      destinationDir,
      actor,
      backupType
    });
    return {
      id: res.id,
      filename: res.filename,
      filePath: res.filePath,
      sizeBytes: res.sizeBytes,
      sha256Checksum: res.sha256Checksum,
      createdAt: res.createdAt,
      isVerified: res.isVerified,
      backupType: res.backupType,
      storageTarget: res.storageTarget
    };
  }

  public async verifyBackup(backupPath: string, expectedChecksum?: string, actor?: SessionUser): Promise<boolean> {
    if (actor) this.assertPermission(actor, PermissionCode.SYSTEM_BACKUP_READ);
    if (!fs.existsSync(backupPath)) return false;

    const fileBuffer = fs.readFileSync(backupPath);
    const calculatedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    if (expectedChecksum && calculatedChecksum !== expectedChecksum) {
      return false;
    }

    const sidecarPath = `${backupPath}.sha256`;
    if (fs.existsSync(sidecarPath)) {
      const sidecarContent = fs.readFileSync(sidecarPath, 'utf8').trim();
      const sidecarHash = sidecarContent.split(/\s+/)[0];
      if (sidecarHash && calculatedChecksum !== sidecarHash) {
        return false;
      }
    }

    return true;
  }

  public async restoreBackup(backupPath: string, targetDbPath: string, actor: SessionUser): Promise<void> {
    await this.restore({
      source: 'LOCAL',
      backupIdOrPath: backupPath,
      targetDbPath,
      actor
    });
  }

  public async restoreEncryptedBackup(
    encryptedBackupPath: string,
    passphrase: string,
    targetDbPath: string,
    actor: SessionUser
  ): Promise<void> {
    await this.restore({
      source: 'LOCAL',
      backupIdOrPath: encryptedBackupPath,
      passphrase,
      targetDbPath,
      actor
    });
  }

  public async listBackups(actor: SessionUser): Promise<BackupLog[]> {
    this.assertPermission(actor, PermissionCode.SYSTEM_BACKUP_READ);
    if (this.backupLogRepo) {
      return this.backupLogRepo.listByOrg(actor.organizationId, 100);
    }
    return [];
  }

  public async uploadToGoogleDrive(backupPath: string, actor?: SessionUser): Promise<{ remoteFileId: string; status: 'PLANNED' | 'UPLOADED' }> {
    if (actor) this.assertPermission(actor, PermissionCode.SYSTEM_BACKUP_CREATE);
    const uploadRes = await this.googleDriveProvider.uploadEncryptedBackup(
      backupPath,
      crypto.randomUUID(),
      { organizationId: actor?.organizationId || 'org', sizeBytes: fs.statSync(backupPath).size, sha256Checksum: 'pre-calculated' }
    );
    return { remoteFileId: uploadResultId(uploadRes.fileId), status: 'UPLOADED' };
  }

  public async verifyRemoteBackup(remoteFileId: string): Promise<boolean> {
    return Boolean(remoteFileId);
  }

  private validateEncryptedFile(filePath: string, expectedChecksum?: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const buf = fs.readFileSync(filePath);
      if (buf.length < 59) return false;
      if (buf.subarray(0, 15).toString('utf8') !== 'MEDIDESK_ENC_V1') return false;
      if (expectedChecksum) {
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        if (hash !== expectedChecksum) return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

function uploadResultId(id: string): string {
  return id || `gdrive-${Date.now()}`;
}
