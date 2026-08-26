import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartAlertService } from '@medidesk/application';
import { ISystemAlertRepository, IAlertConfigRepository, RoleName } from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';

describe('Phase 8D: SmartAlertService & Notification Engine', () => {
  let service: SmartAlertService;
  let mockAlertRepo: Partial<ISystemAlertRepository>;
  let mockConfigRepo: Partial<IAlertConfigRepository>;
  let mockAuditService: Partial<IAuditService>;

  const mockActiveAlerts = [
    {
      id: 'alert-1',
      organizationId: 'org-1',
      alertType: 'LOW_STOCK',
      category: 'INVENTORY' as const,
      severity: 'WARNING' as const,
      title: 'Low Stock Alert',
      message: 'Amoxicillin 500mg is below reorder level (8 units remaining).',
      entityType: 'PRODUCT' as const,
      entityId: 'prod-amx-500',
      dedupKey: 'dedup-low-stock-amx',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'alert-2',
      organizationId: 'org-1',
      alertType: 'FOLLOWUP_DUE',
      category: 'CLINICAL' as const,
      severity: 'INFO' as const,
      title: 'Clinical Follow-up Due',
      message: 'Patient John Doe has a cardiology follow-up due today.',
      entityType: 'VISIT' as const,
      entityId: 'visit-101',
      dedupKey: 'dedup-followup-john',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'alert-3',
      organizationId: 'org-1',
      alertType: 'BACKUP_FAILED',
      category: 'SYSTEM' as const,
      severity: 'CRITICAL' as const,
      title: 'Backup Failure',
      message: 'Cloud backup sync timed out.',
      entityType: 'BACKUP' as const,
      entityId: 'backup-99',
      dedupKey: 'dedup-backup-failed',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'alert-4',
      organizationId: 'org-1',
      alertType: 'MANDATORY_EXPIRED_BLOCKED',
      category: 'INVENTORY' as const,
      severity: 'MANDATORY_SAFETY' as const,
      title: 'Expired Medicine Blocked',
      message: 'Attempted dispensing of expired batch #EXP-2025 was blocked.',
      dedupKey: 'dedup-expired-safety',
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeEach(() => {
    mockAlertRepo = {
      createOrUpdate: vi.fn().mockImplementation(async (dto) => ({
        id: dto.id || 'alert-new',
        ...dto,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      findActive: vi.fn().mockResolvedValue(mockActiveAlerts),
      findById: vi.fn().mockImplementation(async (id) => mockActiveAlerts.find((a) => a.id === id) || null),
      acknowledge: vi.fn().mockImplementation(async (id) => ({
        ...mockActiveAlerts.find((a) => a.id === id)!,
        status: 'ACKNOWLEDGED'
      })),
      resolve: vi.fn().mockImplementation(async (id) => ({
        ...mockActiveAlerts.find((a) => a.id === id)!,
        status: 'RESOLVED'
      }))
    };

    mockConfigRepo = {
      findByType: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(async (orgId, type, dto) => ({
        id: 'cfg-1',
        organizationId: orgId,
        alertType: type,
        isEnabled: dto.isEnabled ?? true,
        thresholdValueInteger: dto.thresholdValueInteger,
        warningLevel: dto.warningLevel || 'WARNING',
        targetRoles: dto.targetRoles || ['OWNER'],
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined as any)
    };

    service = new SmartAlertService(
      mockAlertRepo as ISystemAlertRepository,
      mockConfigRepo as IAlertConfigRepository,
      mockAuditService as IAuditService
    );
  });

  describe('Role-Targeted Alert Filtering (Developer Isolation)', () => {
    it('restricts Developer role strictly to SYSTEM alerts (no clinical or inventory data)', async () => {
      const devAlerts = await service.getActiveAlertsForActor('org-1', RoleName.DEVELOPER);

      expect(devAlerts.length).toBe(1);
      expect(devAlerts[0].alertType).toBe('BACKUP_FAILED');
      expect(devAlerts[0].category).toBe('SYSTEM');
    });

    it('returns CLINICAL and SYSTEM alerts for DOCTOR role', async () => {
      const docAlerts = await service.getActiveAlertsForActor('org-1', RoleName.DOCTOR);

      expect(docAlerts.some((a) => a.category === 'CLINICAL')).toBe(true);
      expect(docAlerts.some((a) => a.category === 'SYSTEM')).toBe(true);
      expect(docAlerts.some((a) => a.category === 'INVENTORY')).toBe(false);
    });

    it('returns INVENTORY, SALES, and SYSTEM alerts for STAFF role', async () => {
      const staffAlerts = await service.getActiveAlertsForActor('org-1', RoleName.STAFF);

      expect(staffAlerts.some((a) => a.category === 'INVENTORY')).toBe(true);
      expect(staffAlerts.some((a) => a.category === 'SYSTEM')).toBe(true);
      expect(staffAlerts.some((a) => a.category === 'CLINICAL')).toBe(false);
    });

    it('returns all alerts for OWNER role', async () => {
      const ownerAlerts = await service.getActiveAlertsForActor('org-1', RoleName.OWNER);
      expect(ownerAlerts.length).toBe(mockActiveAlerts.length);
    });
  });

  describe('Alert Lifecycle & Safety Invariants', () => {
    it('acknowledges an advisory alert and logs audit event', async () => {
      const ack = await service.acknowledgeAlert('alert-1', 'user-owner-1', 24, 'org-1');
      expect(ack.status).toBe('ACKNOWLEDGED');
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ALERT_ACKNOWLEDGED',
          resource: 'alert-1'
        })
      );
    });

    it('blocks snoozing or silencing of MANDATORY_SAFETY alerts', async () => {
      await expect(
        service.acknowledgeAlert('alert-4', 'user-owner-1', 24, 'org-1')
      ).rejects.toThrow('Mandatory safety alerts cannot be snoozed');
    });

    it('blocks disabling of mandatory safety policies', async () => {
      await expect(
        service.configureAlertPolicy(
          'org-1',
          'MANDATORY_EXPIRED_BLOCKED',
          { isEnabled: false },
          'user-owner-1'
        )
      ).rejects.toThrow('Mandatory safety rules cannot be disabled.');
    });
  });
});
