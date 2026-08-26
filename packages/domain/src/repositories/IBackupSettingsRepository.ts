import { BackupSettings } from '../entities/BackupLog.js';

export interface UpdateBackupSettingsDTO {
  backupMode?: 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ONLY';
  backupSchedule?: 'DAILY' | 'HOURLY' | 'MANUAL';
  backupTime?: string;
  localRetentionDays?: number;
  cloudRetentionDays?: number;
  googleDriveFolder?: string;
  googleDriveConnected?: boolean;
  googleDriveAccountEmail?: string;
  googleDriveTokenEnc?: string;
  autoRetryCloud?: boolean;
}

export interface IBackupSettingsRepository {
  getByOrg(organizationId: string): Promise<BackupSettings>;
  upsert(organizationId: string, dto: UpdateBackupSettingsDTO): Promise<BackupSettings>;
}
