import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScheduledBackupService } from '@medidesk/application';
import { IScheduledBackupConfigRepository, BackupLog } from '@medidesk/domain';
import { BackupService } from '@medidesk/backup';
import { IAuditService } from '@medidesk/audit';

describe('Phase 8G: ScheduledBackupService & Offline Resilience', () => {
  let service: ScheduledBackupService;
  let mockScheduleRepo: Partial<IScheduledBackupConfigRepository>;
  let mockBackupService: Partial<BackupService>;
  let mockAuditService: Partial<IAuditService>;

  const mockConfig = {
    id: 'sched-1',
    organizationId: 'org-1',
    isEnabled: true,
    frequency: 'DAILY' as const,
    backupTime: '22:00',
    localBackupEnabled: true,
    cloudBackupEnabled: true,
    retentionDaysLocal: 30,
    retentionDaysCloud: 90,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockBackupLog: BackupLog = {
    id: 'log-1',
    organizationId: 'org-1',
    filename: 'medidesk_backup_auto.enc',
    filePath: '/path/to/backup.enc',
    sizeBytes: 10240,
    sha256Checksum: 'abcdef123456',
    backupMode: 'HYBRID',
    storageTarget: 'HYBRID',
    backupType: 'SCHEDULED',
    localStatus: 'SUCCESS',
    cloudStatus: 'SUCCESS',
    overallStatus: 'LOCAL_SUCCESS',
    isVerified: true,
    status: 'COMPLETED',
    createdAt: new Date()
  };

  beforeEach(() => {
    mockScheduleRepo = {
      findByOrg: vi.fn().mockResolvedValue(mockConfig),
      upsert: vi.fn().mockImplementation(async (orgId, dto) => ({
        ...mockConfig,
        ...dto
      })),
      updateLastRun: vi.fn().mockResolvedValue(mockConfig as any)
    };

    mockBackupService = {
      createHybridBackup: vi.fn().mockResolvedValue(mockBackupLog)
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined as any)
    };

    service = new ScheduledBackupService(
      mockScheduleRepo as IScheduledBackupConfigRepository,
      mockBackupService as BackupService,
      mockAuditService as IAuditService
    );
  });

  describe('Backup Due Evaluation (Sleep/Resume Catch-up)', () => {
    it('detects that scheduled daily backup is due after the configured time', async () => {
      // 22:30 on current day (after 22:00)
      const now = new Date('2026-08-26T22:30:00');
      const isDue = await service.isBackupDue('org-1', now);
      expect(isDue).toBe(true);
    });

    it('returns false if current time is before the configured time', async () => {
      // 18:00 on current day (before 22:00)
      const now = new Date('2026-08-26T18:00:00');
      const isDue = await service.isBackupDue('org-1', now);
      expect(isDue).toBe(false);
    });

    it('returns false if backup was already executed today', async () => {
      mockScheduleRepo.findByOrg = vi.fn().mockResolvedValue({
        ...mockConfig,
        lastRunAt: new Date('2026-08-26T22:05:00')
      });

      const now = new Date('2026-08-26T23:00:00');
      const isDue = await service.isBackupDue('org-1', now);
      expect(isDue).toBe(false);
    });
  });

  describe('Cloud Failure Isolation', () => {
    it('succeeds with PARTIAL_LOCAL_ONLY status when cloud sync fails', async () => {
      mockBackupService.createHybridBackup = vi.fn().mockResolvedValue({
        ...mockBackupLog,
        cloudStatus: 'FAILED',
        overallStatus: 'PARTIAL'
      });

      const result = await service.executeScheduledBackup('org-1');

      expect(result.id).toBe('log-1');
      expect(result.cloudStatus).toBe('FAILED');
      expect(mockScheduleRepo.updateLastRun).toHaveBeenCalledWith(
        'org-1',
        'PARTIAL_LOCAL_ONLY',
        expect.stringContaining('Completed')
      );
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BACKUP_SCHEDULED_TRIGGERED'
        })
      );
    });
  });
});
