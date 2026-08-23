import { ipcMain } from 'electron';
import { IPC_CHANNELS, IPCResponse } from '@medidesk/shared';
import { IAuditService } from '@medidesk/audit';
import { AuditEvent } from '@medidesk/domain';
import {
  validateSchema,
  LogAuditEventRequestSchema,
  GetAuditEventsRequestSchema,
  CreateAuditEventInput
} from '@medidesk/validation';

export function registerAuditIpc(auditService: IAuditService): void {
  // 1. Log Audit Event (Validated)
  ipcMain.handle(
    IPC_CHANNELS.LOG_AUDIT_EVENT,
    async (_event, rawInput: unknown): Promise<IPCResponse<AuditEvent>> => {
      const validation = validateSchema(LogAuditEventRequestSchema, rawInput);
      if (!validation.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid audit event payload',
            details: validation.errors
          }
        };
      }

      try {
        const event = await auditService.logEvent(validation.data as CreateAuditEventInput);
        return { success: true, data: event };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'AUDIT_LOG_ERROR',
            message: error instanceof Error ? error.message : 'Failed to record audit event'
          }
        };
      }
    }
  );

  // 2. Get Recent Audit Events (Validated)
  ipcMain.handle(
    IPC_CHANNELS.GET_RECENT_AUDIT_EVENTS,
    async (_event, rawInput: unknown): Promise<IPCResponse<AuditEvent[]>> => {
      const validation = validateSchema(GetAuditEventsRequestSchema, rawInput ?? {});
      const limit = validation.success ? validation.data.limit : 50;

      try {
        const events = await auditService.getRecentEvents(limit);
        return { success: true, data: events };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'AUDIT_FETCH_ERROR',
            message: error instanceof Error ? error.message : 'Failed to fetch audit events'
          }
        };
      }
    }
  );
}
