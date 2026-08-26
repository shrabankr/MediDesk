import {
  IDashboardPreferenceRepository,
  UserDashboardPreference,
  RoleName,
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { SaveDashboardPreferenceSchema } from '@medidesk/validation';

export class DashboardService {
  constructor(
    private prefRepo: IDashboardPreferenceRepository,
    private auditService: IAuditService
  ) {}

  /**
   * Returns standard default widget configuration for a specific role.
   */
  getDefaultWidgetsForRole(role: string): string[] {
    switch (role) {
      case RoleName.OWNER:
        return [
          'METRIC_REVENUE_TODAY',
          'METRIC_APPOINTMENTS_TODAY',
          'METRIC_LOW_STOCK_COUNT',
          'METRIC_EXPIRING_COUNT',
          'CHART_SALES_TREND',
          'TABLE_RECENT_SALES',
          'STREAM_AUDIT_LOG',
          'WIDGET_ALERT_SUMMARY'
        ];
      case RoleName.DOCTOR:
        return [
          'METRIC_OPD_PATIENT_COUNT',
          'METRIC_PENDING_APPOINTMENTS',
          'TABLE_TODAYS_QUEUE',
          'WIDGET_QUICK_RX_PAD',
          'TABLE_PENDING_FOLLOWUPS',
          'WIDGET_CLINICAL_ALERTS'
        ];
      case RoleName.STAFF:
        return [
          'METRIC_SALES_TODAY',
          'METRIC_PATIENT_CHECKINS',
          'WIDGET_QUICK_POS_BILLING',
          'TABLE_WAITING_QUEUE',
          'WIDGET_STOCK_CHECKER',
          'WIDGET_OPERATIONAL_ALERTS'
        ];
      case RoleName.DEVELOPER:
        return [
          'WIDGET_DB_HEALTH',
          'WIDGET_WAL_STATUS',
          'WIDGET_MIGRATION_LIST',
          'WIDGET_BACKUP_STATUS',
          'WIDGET_LAN_SERVER_STATUS',
          'WIDGET_SYSTEM_LOGS'
        ];
      default:
        return ['WIDGET_WELCOME'];
    }
  }

  /**
   * Retrieves dashboard configuration for a specific user, falling back to role defaults.
   */
  async getDashboardLayout(
    userId: string,
    userRole: string
  ): Promise<{ widgets: string[]; customLayout?: Record<string, any> }> {
    const pref = await this.prefRepo.findByUser(userId);
    const defaultWidgets = this.getDefaultWidgetsForRole(userRole);

    if (!pref) {
      return { widgets: defaultWidgets };
    }

    return {
      widgets: pref.widgetLayout.widgets || defaultWidgets,
      customLayout: pref.widgetLayout
    };
  }

  /**
   * Saves custom widget layout preferences for the user.
   */
  async saveDashboardLayout(
    userId: string,
    organizationId: string,
    layout: Record<string, any>,
    actorId: string
  ): Promise<UserDashboardPreference> {
    const validated = SaveDashboardPreferenceSchema.parse({ widgetLayout: layout });

    const saved = await this.prefRepo.save({
      userId,
      organizationId,
      widgetLayout: validated.widgetLayout
    });

    await this.auditService.logEvent({
      action: AuditAction.DASHBOARD_PREFERENCES_UPDATED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: userId,
      metadata: { widgetCount: Object.keys(layout).length }
    });

    return saved;
  }
}
