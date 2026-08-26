import crypto from 'crypto';
import { SqliteDatabase } from '../SqliteDatabase.js';
import {
  BackupLog,
  IBackupLogRepository,
  CreateBackupLogDTO,
  UpdateBackupLogDTO,
  BackupMode,
  LocalBackupStatus,
  CloudBackupStatus,
  OverallBackupStatus,
  BackupType,
  StorageTarget
} from '@medidesk/domain';

interface BackupLogRow {
  id: string;
  organization_id: string;
  filename: string;
  file_path: string;
  size_bytes: number;
  sha256_checksum: string;
  backup_type: BackupType;
  storage_target: StorageTarget;
  backup_mode: BackupMode | null;
  local_status: LocalBackupStatus | null;
  cloud_status: CloudBackupStatus | null;
  overall_status: OverallBackupStatus | null;
  remote_file_id: string | null;
  is_verified: number;
  encryption_version: string | null;
  app_version: string | null;
  schema_version: string | null;
  error_message: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
}

export class SqliteBackupLogRepository implements IBackupLogRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async create(dto: CreateBackupLogDTO): Promise<BackupLog> {
    const id = dto.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const isVerified = dto.isVerified ?? true ? 1 : 0;
    const backupType = dto.backupType || 'MANUAL';
    const storageTarget = dto.storageTarget || 'LOCAL';
    const backupMode = dto.backupMode || 'HYBRID';
    const localStatus = dto.localStatus || 'SUCCESS';
    const cloudStatus = dto.cloudStatus || 'NONE';
    const overallStatus = dto.overallStatus || 'LOCAL_SUCCESS';
    const encryptionVersion = dto.encryptionVersion || 'AES-256-GCM-SCRYPT-V1';
    const appVersion = dto.appVersion || '1.0.0';
    const schemaVersion = dto.schemaVersion || '006';
    const status = dto.status || overallStatus;

    const stmt = this.db.getRawDb().prepare(`
      INSERT INTO backup_logs (
        id, organization_id, filename, file_path, size_bytes,
        sha256_checksum, backup_type, storage_target, backup_mode,
        local_status, cloud_status, overall_status, remote_file_id,
        is_verified, encryption_version, app_version, schema_version,
        error_message, status, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let validCreatedBy: string | null = null;
    if (dto.createdBy) {
      try {
        const userRow = this.db.getRawDb().prepare('SELECT id FROM users WHERE id = ?').get(dto.createdBy);
        if (userRow) {
          validCreatedBy = dto.createdBy;
        }
      } catch { /* ignore */ }
    }

    stmt.run(
      id,
      dto.organizationId,
      dto.filename,
      dto.filePath,
      dto.sizeBytes,
      dto.sha256Checksum,
      backupType,
      storageTarget,
      backupMode,
      localStatus,
      cloudStatus,
      overallStatus,
      dto.remoteFileId ?? null,
      isVerified,
      encryptionVersion,
      appVersion,
      schemaVersion,
      dto.errorMessage ?? null,
      status,
      now,
      validCreatedBy
    );

    return {
      id,
      organizationId: dto.organizationId,
      filename: dto.filename,
      filePath: dto.filePath,
      sizeBytes: dto.sizeBytes,
      sha256Checksum: dto.sha256Checksum,
      backupType,
      storageTarget,
      backupMode,
      localStatus,
      cloudStatus,
      overallStatus,
      remoteFileId: dto.remoteFileId,
      isVerified: dto.isVerified ?? true,
      encryptionVersion,
      appVersion,
      schemaVersion,
      errorMessage: dto.errorMessage,
      status,
      createdAt: new Date(now),
      createdBy: dto.createdBy
    };
  }

  public async findById(id: string, organizationId: string): Promise<BackupLog | null> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM backup_logs WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as BackupLogRow | undefined;

    if (!row) return null;
    return this.mapRow(row);
  }

  public async listByOrg(organizationId: string, limit = 50): Promise<BackupLog[]> {
    const rows = this.db.getRawDb().prepare(`
      SELECT * FROM backup_logs
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(organizationId, limit) as BackupLogRow[];

    return rows.map(r => this.mapRow(r));
  }

  public async listPendingCloudBackups(organizationId: string): Promise<BackupLog[]> {
    const rows = this.db.getRawDb().prepare(`
      SELECT * FROM backup_logs
      WHERE organization_id = ?
        AND cloud_status IN ('PENDING', 'FAILED')
        AND local_status = 'SUCCESS'
      ORDER BY created_at ASC
    `).all(organizationId) as BackupLogRow[];

    return rows.map(r => this.mapRow(r));
  }

  public async update(id: string, dto: UpdateBackupLogDTO): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (dto.remoteFileId !== undefined) {
      sets.push('remote_file_id = ?');
      params.push(dto.remoteFileId);
    }
    if (dto.localStatus !== undefined) {
      sets.push('local_status = ?');
      params.push(dto.localStatus);
    }
    if (dto.cloudStatus !== undefined) {
      sets.push('cloud_status = ?');
      params.push(dto.cloudStatus);
    }
    if (dto.overallStatus !== undefined) {
      sets.push('overall_status = ?');
      params.push(dto.overallStatus);
    }
    if (dto.isVerified !== undefined) {
      sets.push('is_verified = ?');
      params.push(dto.isVerified ? 1 : 0);
    }
    if (dto.errorMessage !== undefined) {
      sets.push('error_message = ?');
      params.push(dto.errorMessage);
    }
    if (dto.status !== undefined) {
      sets.push('status = ?');
      params.push(dto.status);
    }

    if (sets.length === 0) return;

    params.push(id);
    this.db.getRawDb().prepare(`
      UPDATE backup_logs SET ${sets.join(', ')} WHERE id = ?
    `).run(...params);
  }

  public async updateStatus(id: string, status: string): Promise<void> {
    this.db.getRawDb().prepare(`
      UPDATE backup_logs SET status = ?, overall_status = ? WHERE id = ?
    `).run(status, status, id);
  }

  public async delete(id: string): Promise<void> {
    this.db.getRawDb().prepare(`
      DELETE FROM backup_logs WHERE id = ?
    `).run(id);
  }

  public async count(organizationId: string): Promise<number> {
    const result = this.db.getRawDb().prepare(`
      SELECT COUNT(*) as count FROM backup_logs WHERE organization_id = ?
    `).get(organizationId) as { count: number };
    return result.count;
  }

  private mapRow(row: BackupLogRow): BackupLog {
    return {
      id: row.id,
      organizationId: row.organization_id,
      filename: row.filename,
      filePath: row.file_path,
      sizeBytes: row.size_bytes,
      sha256Checksum: row.sha256_checksum,
      backupType: row.backup_type,
      storageTarget: row.storage_target,
      backupMode: row.backup_mode || 'HYBRID',
      localStatus: row.local_status || 'SUCCESS',
      cloudStatus: row.cloud_status || 'NONE',
      overallStatus: row.overall_status || 'LOCAL_SUCCESS',
      remoteFileId: row.remote_file_id ?? undefined,
      isVerified: Boolean(row.is_verified),
      encryptionVersion: row.encryption_version ?? undefined,
      appVersion: row.app_version ?? undefined,
      schemaVersion: row.schema_version ?? undefined,
      errorMessage: row.error_message ?? undefined,
      status: row.status as any,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined
    };
  }
}
