import {
  ScheduledBackupConfig,
  UpdateScheduledBackupConfigDTO,
  BackupRunStatus,
  IScheduledBackupConfigRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';
import crypto from 'crypto';

export class SqliteScheduledBackupConfigRepository implements IScheduledBackupConfigRepository {
  constructor(private db: SqliteDatabase) {}

  async findByOrg(organizationId: string): Promise<ScheduledBackupConfig | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`SELECT * FROM scheduled_backup_configs WHERE organization_id = ?`).get(organizationId) as any;
    return row ? this.mapRow(row) : null;
  }

  async upsert(
    organizationId: string,
    dto: UpdateScheduledBackupConfigDTO
  ): Promise<ScheduledBackupConfig> {
    const raw = this.db.getRawDb();
    const existing = await this.findByOrg(organizationId);

    if (existing) {
      const fields: string[] = [];
      const params: any[] = [];

      if (dto.isEnabled !== undefined) {
        fields.push(`is_enabled = ?`);
        params.push(dto.isEnabled ? 1 : 0);
      }
      if (dto.frequency !== undefined) {
        fields.push(`frequency = ?`);
        params.push(dto.frequency);
      }
      if (dto.backupTime !== undefined) {
        fields.push(`backup_time = ?`);
        params.push(dto.backupTime);
      }
      if (dto.localBackupEnabled !== undefined) {
        fields.push(`local_backup_enabled = ?`);
        params.push(dto.localBackupEnabled ? 1 : 0);
      }
      if (dto.cloudBackupEnabled !== undefined) {
        fields.push(`cloud_backup_enabled = ?`);
        params.push(dto.cloudBackupEnabled ? 1 : 0);
      }
      if (dto.retentionDaysLocal !== undefined) {
        fields.push(`retention_days_local = ?`);
        params.push(dto.retentionDaysLocal);
      }
      if (dto.retentionDaysCloud !== undefined) {
        fields.push(`retention_days_cloud = ?`);
        params.push(dto.retentionDaysCloud);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(organizationId);

      raw.prepare(`UPDATE scheduled_backup_configs SET ${fields.join(', ')} WHERE organization_id = ?`).run(...params);
    } else {
      const id = crypto.randomUUID();
      raw.prepare(
        `INSERT INTO scheduled_backup_configs (
          id, organization_id, is_enabled, frequency, backup_time,
          local_backup_enabled, cloud_backup_enabled, retention_days_local,
          retention_days_cloud
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        organizationId,
        dto.isEnabled ? 1 : 0,
        dto.frequency || 'DAILY',
        dto.backupTime || '22:00',
        dto.localBackupEnabled !== false ? 1 : 0,
        dto.cloudBackupEnabled ? 1 : 0,
        dto.retentionDaysLocal || 30,
        dto.retentionDaysCloud || 90
      );
    }

    const saved = await this.findByOrg(organizationId);
    if (!saved) throw new Error(`Failed to save scheduled backup config for org ${organizationId}`);
    return saved;
  }

  async updateLastRun(
    organizationId: string,
    status: BackupRunStatus,
    message: string
  ): Promise<ScheduledBackupConfig> {
    const raw = this.db.getRawDb();
    raw.prepare(
      `UPDATE scheduled_backup_configs SET
        last_run_at = CURRENT_TIMESTAMP,
        last_run_status = ?,
        last_run_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ?`
    ).run(status, message, organizationId);

    const updated = await this.findByOrg(organizationId);
    if (!updated) throw new Error(`Scheduled backup config not found for org ${organizationId}`);
    return updated;
  }

  private mapRow(row: any): ScheduledBackupConfig {
    return {
      id: row.id,
      organizationId: row.organization_id,
      isEnabled: row.is_enabled === 1,
      frequency: row.frequency,
      backupTime: row.backup_time,
      localBackupEnabled: row.local_backup_enabled === 1,
      cloudBackupEnabled: row.cloud_backup_enabled === 1,
      retentionDaysLocal: row.retention_days_local,
      retentionDaysCloud: row.retention_days_cloud,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      lastRunStatus: row.last_run_status || undefined,
      lastRunMessage: row.last_run_message || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
