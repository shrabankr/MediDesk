import {
  IScheduledBackupConfigRepository,
  ScheduledBackupConfig,
  UpdateScheduledBackupConfigDTO,
  BackupLog,
  SessionUser,
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { BackupService } from '@medidesk/backup';
import { UpdateBackupScheduleSchema } from '@medidesk/validation';

export class ScheduledBackupService {
  constructor(
    private scheduleRepo: IScheduledBackupConfigRepository,
    private backupService: BackupService,
    private auditService: IAuditService
  ) {}

  async getScheduleConfig(organizationId: string): Promise<ScheduledBackupConfig | null> {
    return this.scheduleRepo.findByOrg(organizationId);
  }

  async updateScheduleConfig(
    organizationId: string,
    dto: UpdateScheduledBackupConfigDTO,
    actorId: string
  ): Promise<ScheduledBackupConfig> {
    const validated = UpdateBackupScheduleSchema.parse(dto);
    const updated = await this.scheduleRepo.upsert(organizationId, validated);

    await this.auditService.logEvent({
      action: AuditAction.BACKUP_SCHEDULE_UPDATED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: updated.id,
      metadata: {
        isEnabled: updated.isEnabled,
        frequency: updated.frequency,
        backupTime: updated.backupTime,
        localEnabled: updated.localBackupEnabled,
        cloudEnabled: updated.cloudBackupEnabled
      }
    });

    return updated;
  }

  /**
   * Checks whether a scheduled backup is due for the given organization.
   */
  async isBackupDue(organizationId: string, now: Date = new Date()): Promise<boolean> {
    const config = await this.scheduleRepo.findByOrg(organizationId);
    if (!config || !config.isEnabled) return false;

    const [targetHour, targetMin] = config.backupTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    if (!config.lastRunAt) {
      return currentHour > targetHour || (currentHour === targetHour && currentMin >= targetMin);
    }

    const lastRunDate = new Date(config.lastRunAt);
    const isSameDay =
      lastRunDate.getFullYear() === now.getFullYear() &&
      lastRunDate.getMonth() === now.getMonth() &&
      lastRunDate.getDate() === now.getDate();

    if (isSameDay) return false;

    if (config.frequency === 'DAILY') {
      return currentHour > targetHour || (currentHour === targetHour && currentMin >= targetMin);
    }

    if (config.frequency === 'WEEKLY') {
      const daysSinceLastRun = Math.floor((now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLastRun >= 7;
    }

    if (config.frequency === 'MONTHLY') {
      const daysSinceLastRun = Math.floor((now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLastRun >= 30;
    }

    return false;
  }

  /**
   * Executes scheduled backup with resilience (local backup succeeds regardless of cloud status).
   */
  async executeScheduledBackup(
    organizationId: string,
    actor?: SessionUser
  ): Promise<BackupLog> {
    const config = await this.scheduleRepo.findByOrg(organizationId);
    if (!config) throw new Error(`Scheduled backup config not found for org ${organizationId}`);

    const backupLog = await this.backupService.createHybridBackup({
      actor,
      backupType: 'SCHEDULED' as any
    });

    const status = backupLog.cloudStatus === 'FAILED'
      ? 'PARTIAL_LOCAL_ONLY'
      : backupLog.localStatus === 'SUCCESS'
        ? 'SUCCESS'
        : 'FAILED';

    await this.scheduleRepo.updateLastRun(
      organizationId,
      status,
      `Completed: ${backupLog.filename}`
    );

    await this.auditService.logEvent({
      action: AuditAction.BACKUP_SCHEDULED_TRIGGERED,
      actor: { id: actor?.id || 'system-scheduler', username: actor?.username || 'system-scheduler' },
      result: AuditResult.SUCCESS,
      resource: backupLog.id,
      metadata: {
        status,
        backupFileName: backupLog.filename,
        cloudStatus: backupLog.cloudStatus
      }
    });

    return backupLog;
  }
}
