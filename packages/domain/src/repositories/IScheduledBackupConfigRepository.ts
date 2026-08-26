import { ScheduledBackupConfig, UpdateScheduledBackupConfigDTO, BackupRunStatus } from '../entities/ScheduledBackupConfig.js';

export interface IScheduledBackupConfigRepository {
  findByOrg(organizationId: string): Promise<ScheduledBackupConfig | null>;
  upsert(organizationId: string, dto: UpdateScheduledBackupConfigDTO): Promise<ScheduledBackupConfig>;
  updateLastRun(organizationId: string, status: BackupRunStatus, message: string): Promise<ScheduledBackupConfig>;
}
