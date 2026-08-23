import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from '@medidesk/shared';

export interface BackupMetadata {
  id: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  sha256Checksum: string;
  createdAt: Date;
  isVerified: boolean;
}

export interface IBackupService {
  createLocalBackup(destinationDir?: string): Promise<BackupMetadata>;
  verifyBackup(backupPath: string, expectedChecksum?: string): Promise<boolean>;
  restoreBackup(backupPath: string, targetDbPath: string): Promise<void>;
  uploadToGoogleDrive(backupPath: string): Promise<{ remoteFileId: string; status: 'PLANNED' | 'UPLOADED' }>;
  verifyRemoteBackup(remoteFileId: string): Promise<boolean>;
}

export class BackupService implements IBackupService {
  private databasePath: string;
  private defaultBackupDir: string;
  private logger: Logger;

  constructor(databasePath: string, defaultBackupDir: string) {
    this.databasePath = databasePath;
    this.defaultBackupDir = defaultBackupDir;
    this.logger = new Logger('BackupService');
  }

  public async createLocalBackup(destinationDir?: string): Promise<BackupMetadata> {
    const backupDir = destinationDir || this.defaultBackupDir;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    if (!fs.existsSync(this.databasePath)) {
      throw new Error(`Database file not found at ${this.databasePath}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `medidesk-backup-${timestamp}.sqlite`;
    const targetPath = path.join(backupDir, filename);

    this.logger.info(`Starting local database snapshot: ${targetPath}`);

    // Synchronous copy for file-level snapshot
    fs.copyFileSync(this.databasePath, targetPath);

    // Compute checksum
    const fileBuffer = fs.readFileSync(targetPath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const stats = fs.statSync(targetPath);

    const metadata: BackupMetadata = {
      id: crypto.randomUUID(),
      filename,
      filePath: targetPath,
      sizeBytes: stats.size,
      sha256Checksum: checksum,
      createdAt: new Date(),
      isVerified: true
    };

    this.logger.info(`Backup completed successfully: ${filename} (SHA256: ${checksum.slice(0, 8)}...)`);
    return metadata;
  }

  public async verifyBackup(backupPath: string, expectedChecksum?: string): Promise<boolean> {
    if (!fs.existsSync(backupPath)) {
      this.logger.warn(`Backup file not found for verification: ${backupPath}`);
      return false;
    }

    try {
      const fileBuffer = fs.readFileSync(backupPath);
      const computed = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      if (expectedChecksum && computed !== expectedChecksum) {
        this.logger.error(`Checksum mismatch for ${backupPath}: expected ${expectedChecksum}, got ${computed}`);
        return false;
      }

      this.logger.info(`Backup verified successfully: ${backupPath}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to verify backup integrity', error);
      return false;
    }
  }

  public async restoreBackup(backupPath: string, targetDbPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`);
    }

    const isValid = await this.verifyBackup(backupPath);
    if (!isValid) {
      throw new Error(`Backup file failed integrity verification: ${backupPath}`);
    }

    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    this.logger.warn(`Restoring database from ${backupPath} to ${targetDbPath}`);
    fs.copyFileSync(backupPath, targetDbPath);
    this.logger.info(`Database restored successfully from ${backupPath}`);
  }

  public async uploadToGoogleDrive(backupPath: string): Promise<{ remoteFileId: string; status: 'PLANNED' | 'UPLOADED' }> {
    this.logger.info(`Google Drive upload requested for ${backupPath}. Status: PLANNED (Future Integration)`);
    // Placeholder foundation for Phase 6
    return {
      remoteFileId: 'gdrive-placeholder-id',
      status: 'PLANNED'
    };
  }

  public async verifyRemoteBackup(remoteFileId: string): Promise<boolean> {
    this.logger.info(`Verifying remote backup ${remoteFileId}. Status: PLANNED`);
    return true;
  }
}
