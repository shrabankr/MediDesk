import { SqliteDatabase } from '../SqliteDatabase.js';
import {
  BackupSettings,
  IBackupSettingsRepository,
  UpdateBackupSettingsDTO,
  BackupMode
} from '@medidesk/domain';

interface BackupSettingsRow {
  organization_id: string;
  backup_mode: BackupMode;
  backup_schedule: string;
  backup_time: string;
  local_retention_days: number;
  cloud_retention_days: number;
  google_drive_folder: string;
  google_drive_connected: number;
  google_drive_account_email: string | null;
  google_drive_token_enc: string | null;
  auto_retry_cloud: number;
  created_at: string;
  updated_at: string;
}

export class SqliteBackupSettingsRepository implements IBackupSettingsRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async getByOrg(organizationId: string): Promise<BackupSettings> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM backup_settings WHERE organization_id = ?
    `).get(organizationId) as BackupSettingsRow | undefined;

    if (!row) {
      // Default settings
      const now = new Date().toISOString();
      const defaultSettings: BackupSettings = {
        organizationId,
        backupMode: 'HYBRID',
        backupSchedule: 'DAILY',
        backupTime: '21:00',
        localRetentionDays: 30,
        cloudRetentionDays: 90,
        googleDriveFolder: 'MediDesk_Backups',
        googleDriveConnected: false,
        autoRetryCloud: true,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      };

      try {
        this.db.getRawDb().prepare(`
          INSERT INTO backup_settings (
            organization_id, backup_mode, backup_schedule, backup_time,
            local_retention_days, cloud_retention_days, google_drive_folder,
            google_drive_connected, auto_retry_cloud, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
        `).run(
          organizationId,
          defaultSettings.backupMode,
          defaultSettings.backupSchedule,
          defaultSettings.backupTime,
          defaultSettings.localRetentionDays,
          defaultSettings.cloudRetentionDays,
          defaultSettings.googleDriveFolder,
          now,
          now
        );
      } catch {
        // Table might not exist yet if before migration, return fallback
      }

      return defaultSettings;
    }

    return this.mapRow(row);
  }

  public async upsert(organizationId: string, dto: UpdateBackupSettingsDTO): Promise<BackupSettings> {
    const current = await this.getByOrg(organizationId);
    const now = new Date().toISOString();

    const backupMode = dto.backupMode ?? current.backupMode;
    const backupSchedule = dto.backupSchedule ?? current.backupSchedule;
    const backupTime = dto.backupTime ?? current.backupTime;
    const localRetentionDays = dto.localRetentionDays ?? current.localRetentionDays;
    const cloudRetentionDays = dto.cloudRetentionDays ?? current.cloudRetentionDays;
    const googleDriveFolder = dto.googleDriveFolder ?? current.googleDriveFolder;
    const googleDriveConnected = dto.googleDriveConnected !== undefined
      ? (dto.googleDriveConnected ? 1 : 0)
      : (current.googleDriveConnected ? 1 : 0);
    const googleDriveAccountEmail = dto.googleDriveAccountEmail !== undefined
      ? dto.googleDriveAccountEmail
      : current.googleDriveAccountEmail;
    const googleDriveTokenEnc = dto.googleDriveTokenEnc !== undefined
      ? dto.googleDriveTokenEnc
      : current.googleDriveTokenEnc;
    const autoRetryCloud = dto.autoRetryCloud !== undefined
      ? (dto.autoRetryCloud ? 1 : 0)
      : (current.autoRetryCloud ? 1 : 0);

    this.db.getRawDb().prepare(`
      INSERT INTO backup_settings (
        organization_id, backup_mode, backup_schedule, backup_time,
        local_retention_days, cloud_retention_days, google_drive_folder,
        google_drive_connected, google_drive_account_email, google_drive_token_enc,
        auto_retry_cloud, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        backup_mode = excluded.backup_mode,
        backup_schedule = excluded.backup_schedule,
        backup_time = excluded.backup_time,
        local_retention_days = excluded.local_retention_days,
        cloud_retention_days = excluded.cloud_retention_days,
        google_drive_folder = excluded.google_drive_folder,
        google_drive_connected = excluded.google_drive_connected,
        google_drive_account_email = excluded.google_drive_account_email,
        google_drive_token_enc = excluded.google_drive_token_enc,
        auto_retry_cloud = excluded.auto_retry_cloud,
        updated_at = excluded.updated_at
    `).run(
      organizationId,
      backupMode,
      backupSchedule,
      backupTime,
      localRetentionDays,
      cloudRetentionDays,
      googleDriveFolder,
      googleDriveConnected,
      googleDriveAccountEmail ?? null,
      googleDriveTokenEnc ?? null,
      autoRetryCloud,
      now,
      now
    );

    return this.getByOrg(organizationId);
  }

  private mapRow(row: BackupSettingsRow): BackupSettings {
    return {
      organizationId: row.organization_id,
      backupMode: row.backup_mode,
      backupSchedule: row.backup_schedule as any,
      backupTime: row.backup_time,
      localRetentionDays: row.local_retention_days,
      cloudRetentionDays: row.cloud_retention_days,
      googleDriveFolder: row.google_drive_folder,
      googleDriveConnected: Boolean(row.google_drive_connected),
      googleDriveAccountEmail: row.google_drive_account_email ?? undefined,
      googleDriveTokenEnc: row.google_drive_token_enc ?? undefined,
      autoRetryCloud: Boolean(row.auto_retry_cloud),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
