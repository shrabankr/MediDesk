import { ipcMain } from 'electron';
import { IPC_CHANNELS, createSuccessResult, createErrorResult } from '@medidesk/shared';
import {
  StockReconciliationService,
  AuthenticationService,
  ErrorSanitizerService
} from '@medidesk/application';

export function registerReconciliationIpcHandlers(
  reconciliationService: StockReconciliationService,
  authService: AuthenticationService
): void {
  // 1. Create Reconciliation Session
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_CREATE_SESSION, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const session = await reconciliationService.createSession(payload?.dto || payload, actor);
      return createSuccessResult(session);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 2. Get Reconciliation Session by ID
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_GET_SESSION, async (_event, payload: any) => {
    try {
      const sessionToken = typeof payload === 'string' ? '' : payload?.sessionToken || '';
      const sessionId = typeof payload === 'string' ? payload : payload?.sessionId;
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const session = await reconciliationService.getSessionById(sessionId, actor);
      return createSuccessResult(session);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 3. List Reconciliation Sessions
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_LIST_SESSIONS, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const limit = payload?.limit || 50;
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const sessions = await reconciliationService.listSessions(actor, limit);
      return createSuccessResult(sessions);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 4. Add Item to Session
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_ADD_ITEM, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const item = await reconciliationService.addItem(payload?.dto || payload, actor);
      return createSuccessResult(item);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 5. Update Item in Session
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_UPDATE_ITEM, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const item = await reconciliationService.updateItem(
        payload?.dto || payload,
        payload?.sessionId,
        actor
      );
      return createSuccessResult(item);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 6. Delete Item from Session
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_DELETE_ITEM, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const res = await reconciliationService.deleteItem(
        payload?.itemId,
        payload?.sessionId,
        actor
      );
      return createSuccessResult({ success: res });
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 7. Submit Session for Review
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_SUBMIT, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const session = await reconciliationService.submitSession(payload?.dto || payload, actor);
      return createSuccessResult(session);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 8. Review Session (Approve / Reject)
  ipcMain.handle(IPC_CHANNELS.RECONCILIATION_REVIEW, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const session = await reconciliationService.reviewSession(payload?.dto || payload, actor);
      return createSuccessResult(session);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });
}
