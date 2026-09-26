import { ipcMain } from 'electron';
import { IPC_CHANNELS, createSuccessResult, createErrorResult } from '@medidesk/shared';
import {
  BulkDataImportService,
  AuthenticationService,
  ErrorSanitizerService
} from '@medidesk/application';
import { ImportType } from '@medidesk/domain';

export function registerImportIpcHandlers(
  importService: BulkDataImportService,
  authService: AuthenticationService
): void {
  // 1. Get All Import Templates Metadata
  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_GET_TEMPLATES, async (_event, payload: any) => {
    try {
      const templates = importService.getTemplates();
      return createSuccessResult(templates);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 2. Download Specific Template Content
  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_DOWNLOAD_TEMPLATE, async (_event, payload: any) => {
    try {
      const importType = typeof payload === 'string' ? payload : payload?.importType;
      const template = importService.getTemplate(importType as ImportType);
      return createSuccessResult(template);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 3. Parse & Validate Import File (Staged Validation)
  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_VALIDATE_FILE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const result = await importService.parseAndValidate(
        {
          importType: payload.importType,
          fileName: payload.fileName,
          fileContent: payload.fileContent,
          organizationId: payload.organizationId || actor.organizationId
        },
        actor
      );

      return createSuccessResult(result);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });

  // 4. Execute Import (Atomic Transaction)
  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_EXECUTE, async (_event, payload: any) => {
    try {
      const sessionToken = payload?.sessionToken || '';
      const actor = authService.getSessionUser(sessionToken);
      if (!actor) {
        return createErrorResult('UNAUTHORIZED', 'Authentication session required.');
      }

      const result = await importService.executeImport(
        {
          importType: payload.importType,
          fileName: payload.fileName,
          policy: payload.policy,
          validRows: payload.validRows,
          organizationId: payload.organizationId || actor.organizationId
        },
        actor
      );

      return createSuccessResult(result);
    } catch (err: any) {
      const sanitized = ErrorSanitizerService.sanitize(err);
      return createErrorResult(sanitized.code, sanitized.userMessage);
    }
  });
}
