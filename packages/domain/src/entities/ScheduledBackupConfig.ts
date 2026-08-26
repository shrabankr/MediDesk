export type BackupFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type BackupRunStatus = 'SUCCESS' | 'PARTIAL_LOCAL_ONLY' | 'FAILED';

export interface ScheduledBackupConfig {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  frequency: BackupFrequency;
  backupTime: string; // HH:MM (e.g. '22:00')
  localBackupEnabled: boolean;
  cloudBackupEnabled: boolean;
  retentionDaysLocal: number;
  retentionDaysCloud: number;
  lastRunAt?: Date;
  lastRunStatus?: BackupRunStatus;
  lastRunMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateScheduledBackupConfigDTO {
  isEnabled?: boolean;
  frequency?: BackupFrequency;
  backupTime?: string;
  localBackupEnabled?: boolean;
  cloudBackupEnabled?: boolean;
  retentionDaysLocal?: number;
  retentionDaysCloud?: number;
}
