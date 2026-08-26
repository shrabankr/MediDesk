import {
  ISystemAlertRepository,
  IAlertConfigRepository,
  SystemAlert,
  CreateSystemAlertDTO,
  AlertConfiguration,
  UpdateAlertConfigurationDTO,
  RoleName,
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { CreateAlertSchema, UpdateAlertConfigSchema } from '@medidesk/validation';
import crypto from 'crypto';

export class SmartAlertService {
  constructor(
    private alertRepo: ISystemAlertRepository,
    private configRepo: IAlertConfigRepository,
    private auditService: IAuditService
  ) {}

  /**
   * Generates or refreshes a system alert with deduplication and safety checks.
   */
  async raiseAlert(
    dto: CreateSystemAlertDTO,
    actorId?: string
  ): Promise<SystemAlert> {
    const validated = CreateAlertSchema.parse(dto);

    // Check configuration unless it's a MANDATORY_SAFETY alert
    if (validated.severity !== 'MANDATORY_SAFETY') {
      const config = await this.configRepo.findByType(
        validated.organizationId,
        validated.alertType
      );
      if (config && !config.isEnabled) {
        // Suppressed by Owner configuration
        return null as any;
      }
    }

    const dedupKey =
      validated.dedupKey ||
      crypto
        .createHash('sha256')
        .update(
          `${validated.organizationId}:${validated.alertType}:${validated.entityType || ''}:${validated.entityId || ''}:${new Date().toISOString().slice(0, 10)}`
        )
        .digest('hex');

    const alert = await this.alertRepo.createOrUpdate({
      ...validated,
      dedupKey
    });

    if (actorId) {
      await this.auditService.logEvent({
        action: AuditAction.ALERT_CREATED,
        actor: { id: actorId, username: actorId },
        result: AuditResult.SUCCESS,
        resource: alert.id,
        metadata: {
          alertType: alert.alertType,
          category: alert.category,
          severity: alert.severity,
          title: alert.title
        }
      });
    }

    return alert;
  }

  /**
   * Retrieves active, non-snoozed alerts filtered for the actor's role.
   * Developer role is restricted strictly to SYSTEM alerts (no clinical or financial data).
   */
  async getActiveAlertsForActor(
    organizationId: string,
    userRole: string,
    limit: number = 100
  ): Promise<SystemAlert[]> {
    const allActive = await this.alertRepo.findActive(organizationId, limit);

    return allActive.filter((alert) => {
      // Developer role can only see SYSTEM alerts
      if (userRole === RoleName.DEVELOPER) {
        return alert.category === 'SYSTEM';
      }

      // Doctor sees CLINICAL and SYSTEM alerts
      if (userRole === RoleName.DOCTOR) {
        return alert.category === 'CLINICAL' || alert.category === 'SYSTEM';
      }

      // Staff sees INVENTORY, SALES, and SYSTEM alerts
      if (userRole === RoleName.STAFF) {
        return alert.category === 'INVENTORY' || alert.category === 'SALES' || alert.category === 'SYSTEM';
      }

      // Owner sees everything
      return true;
    });
  }

  /**
   * Acknowledges and snoozes an alert for N hours.
   */
  async acknowledgeAlert(
    alertId: string,
    actorId: string,
    snoozeHours: number = 24,
    organizationId: string
  ): Promise<SystemAlert> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert || alert.organizationId !== organizationId) {
      throw new Error(`Alert ${alertId} not found`);
    }

    // Mandatory safety alerts cannot be dismissed/snoozed if the danger persists
    if (alert.severity === 'MANDATORY_SAFETY') {
      throw new Error('Mandatory safety alerts cannot be snoozed; the underlying safety violation must be resolved.');
    }

    const updated = await this.alertRepo.acknowledge(alertId, actorId, snoozeHours);

    await this.auditService.logEvent({
      action: AuditAction.ALERT_ACKNOWLEDGED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: alertId,
      metadata: {
        alertType: alert.alertType,
        snoozeHours
      }
    });

    return updated;
  }

  /**
   * Resolves an alert once the underlying condition is cleared.
   */
  async resolveAlert(
    alertId: string,
    actorId: string,
    organizationId: string
  ): Promise<SystemAlert> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert || alert.organizationId !== organizationId) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const resolved = await this.alertRepo.resolve(alertId);

    await this.auditService.logEvent({
      action: AuditAction.ALERT_RESOLVED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: alertId,
      metadata: { alertType: alert.alertType }
    });

    return resolved;
  }

  /**
   * Owner configuration for alert policies.
   */
  async configureAlertPolicy(
    organizationId: string,
    alertType: string,
    dto: UpdateAlertConfigurationDTO,
    actorId: string
  ): Promise<AlertConfiguration> {
    const validated = UpdateAlertConfigSchema.parse(dto);

    // Prevent disabling mandatory safety controls
    if (alertType.startsWith('MANDATORY_') || alertType.includes('EXPIRED_SALE_BLOCKED')) {
      if (validated.isEnabled === false) {
        throw new Error('Mandatory safety rules cannot be disabled.');
      }
    }

    const config = await this.configRepo.upsert(organizationId, alertType, validated);

    await this.auditService.logEvent({
      action: AuditAction.ALERT_CONFIG_UPDATED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: config.id,
      metadata: {
        alertType,
        isEnabled: config.isEnabled,
        threshold: config.thresholdValueInteger,
        warningLevel: config.warningLevel
      }
    });

    return config;
  }

  async getAlertConfigurations(organizationId: string): Promise<AlertConfiguration[]> {
    return this.configRepo.findByOrg(organizationId);
  }
}
