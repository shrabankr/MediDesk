import { ipcMain } from 'electron';
import { IPC_CHANNELS, createSuccessResult, createErrorResult } from '@medidesk/shared';
import {
  PackagingUnitService,
  SmartAlertService,
  DashboardService,
  DocumentDeliveryService,
  ScheduledBackupService,
  AuthenticationService,
  ErrorSanitizerService
} from '@medidesk/application';

export function registerPhase8IpcHandlers(
  packagingService: PackagingUnitService,
  smartAlertService: SmartAlertService,
  dashboardService: DashboardService,
  documentDeliveryService: DocumentDeliveryService,
  scheduledBackupService: ScheduledBackupService,
  authService: AuthenticationService
): void {
  // 1. Packaging Units
  ipcMain.handle(IPC_CHANNELS.PACKAGING_CREATE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const dto = payload?.dto || payload;
      const orgId = actor?.organizationId || dto?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const created = await packagingService.createPackagingUnit(
        { ...dto, organizationId: orgId },
        actorId
      );
      return createSuccessResult(created);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PACKAGING_GET_BY_PRODUCT, async (_event, productId: string) => {
    try {
      const units = await packagingService.getPackagingUnitsByProduct(productId);
      return createSuccessResult(units);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PACKAGING_UPDATE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const { id, dto } = payload || {};
      const orgId = actor?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const updated = await packagingService.updatePackagingUnit(id, dto, actorId, orgId);
      return createSuccessResult(updated);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PACKAGING_DELETE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const id = typeof payload === 'string' ? payload : payload?.id;
      const orgId = actor?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const deleted = await packagingService.deletePackagingUnit(id, actorId, orgId);
      return createSuccessResult(deleted);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PACKAGING_CONVERT, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const { productId, unitName, packageQuantity } = payload || {};
      const orgId = actor?.organizationId || 'default-org';

      const converted = await packagingService.convertPackageToBaseUnits(
        productId,
        unitName,
        packageQuantity,
        orgId
      );
      return createSuccessResult(converted);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 2. Smart Alerts
  ipcMain.handle(IPC_CHANNELS.ALERTS_GET_ACTIVE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || (typeof payload === 'string' ? payload : '');
      const actor = authService.getSessionUser(sessionToken);
      const orgId = actor?.organizationId || 'default-org';
      const userRole = actor?.roles?.[0] || 'OWNER';
      const limit = payload?.limit || 100;

      const alerts = await smartAlertService.getActiveAlertsForActor(orgId, userRole, limit);
      return createSuccessResult(alerts);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.ALERTS_ACKNOWLEDGE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const { alertId, snoozeHours } = payload || {};
      const orgId = actor?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const updated = await smartAlertService.acknowledgeAlert(
        alertId,
        actorId,
        snoozeHours || 24,
        orgId
      );
      return createSuccessResult(updated);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.ALERTS_RESOLVE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const alertId = typeof payload === 'string' ? payload : payload?.alertId;
      const orgId = actor?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const resolved = await smartAlertService.resolveAlert(alertId, actorId, orgId);
      return createSuccessResult(resolved);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.ALERTS_CONFIGURE_POLICY, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const { alertType, dto } = payload || {};
      const orgId = actor?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const config = await smartAlertService.configureAlertPolicy(orgId, alertType, dto, actorId);
      return createSuccessResult(config);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.ALERTS_GET_CONFIGS, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const orgId = actor?.organizationId || 'default-org';

      const configs = await smartAlertService.getAlertConfigurations(orgId);
      return createSuccessResult(configs);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 3. Dashboard Layout & Preferences
  ipcMain.handle(IPC_CHANNELS.DASHBOARD_GET_LAYOUT, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || (typeof payload === 'string' ? payload : '');
      const actor = authService.getSessionUser(sessionToken);
      const userId = actor?.id || 'default-user';
      const userRole = actor?.roles?.[0] || 'OWNER';

      const layout = await dashboardService.getDashboardLayout(userId, userRole);
      return createSuccessResult(layout);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.DASHBOARD_SAVE_LAYOUT, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const layout = payload?.layout || payload;
      const userId = actor?.id || 'default-user';
      const orgId = actor?.organizationId || 'default-org';

      const saved = await dashboardService.saveDashboardLayout(userId, orgId, layout, userId);
      return createSuccessResult(saved);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 4. Document Generation & Dispatch
  ipcMain.handle(IPC_CHANNELS.DOCUMENT_DISPATCH, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const request = payload?.request || payload;
      const actorId = actor?.id || 'system';
      const orgId = actor?.organizationId || 'default-org';

      const result = await documentDeliveryService.dispatchDocument(request, actorId, orgId);
      return createSuccessResult(result);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 5. Backup Scheduling
  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_SCHEDULE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || (typeof payload === 'string' ? payload : '');
      const actor = authService.getSessionUser(sessionToken);
      const orgId = actor?.organizationId || 'default-org';

      const config = await scheduledBackupService.getScheduleConfig(orgId);
      return createSuccessResult(config);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_UPDATE_SCHEDULE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      const dto = payload?.dto || payload;
      const orgId = actor?.organizationId || 'default-org';
      const actorId = actor?.id || 'system';

      const updated = await scheduledBackupService.updateScheduleConfig(orgId, dto, actorId);
      return createSuccessResult(updated);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });
}
