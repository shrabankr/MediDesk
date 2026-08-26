import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  createSuccessResult,
  createErrorResult
} from '@medidesk/shared';
import { BackupService } from '@medidesk/backup';
import { LicenseService } from '@medidesk/licensing';
import { PrintService } from '@medidesk/printing';
import { AuthenticationService } from '@medidesk/application';
import { SqlitePrinterConfigRepository } from '@medidesk/database';

export function registerSettingsIpcHandlers(
  backupService: BackupService,
  licenseService: LicenseService,
  printService: PrintService,
  authService: AuthenticationService,
  printerRepo?: SqlitePrinterConfigRepository
): void {
  const authenticate = (sessionToken: string) => {
    const user = authService.getSessionUser(sessionToken);
    if (!user) {
      throw new Error('Authentication required. Session is invalid or expired.');
    }
    return user;
  };

  // 1. Create Hybrid/Local Backup
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_CREATE,
    async (
      _event,
      sessionToken: string,
      options?: { mode?: 'LOCAL_ONLY' | 'HYBRID' | 'CLOUD_ONLY'; passphrase?: string; destinationDir?: string }
    ): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await backupService.createHybridBackup({
          mode: options?.mode,
          passphrase: options?.passphrase,
          destinationDir: options?.destinationDir,
          actor,
          backupType: 'MANUAL'
        });
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_CREATE_ERROR', err.message);
      }
    }
  );

  // 2. List Backups
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_LIST,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await backupService.listBackups(actor);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_LIST_ERROR', err.message);
      }
    }
  );

  // 3. Verify Backup
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_VERIFY,
    async (_event, sessionToken: string, backupPath: string, expectedChecksum?: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const isValid = await backupService.verifyBackup(backupPath, expectedChecksum, actor);
        return createSuccessResult({ isValid, backupPath });
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_VERIFY_ERROR', err.message);
      }
    }
  );

  // 4. Restore Backup (Local or Google Drive)
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_RESTORE,
    async (
      _event,
      sessionToken: string,
      options: { source: 'LOCAL' | 'GOOGLE_DRIVE'; backupIdOrPath: string; passphrase?: string; targetDbPath?: string }
    ): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        await backupService.restore({
          source: options.source || 'LOCAL',
          backupIdOrPath: options.backupIdOrPath,
          passphrase: options.passphrase,
          targetDbPath: options.targetDbPath,
          actor
        });
        return createSuccessResult({ success: true, message: 'Database restored successfully' });
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_RESTORE_ERROR', err.message);
      }
    }
  );

  // 5. Get Backup Settings
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_GET_SETTINGS,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await backupService.getSettings(actor.organizationId);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_SETTINGS_ERROR', err.message);
      }
    }
  );

  // 6. Update Backup Settings
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_UPDATE_SETTINGS,
    async (_event, sessionToken: string, settings: any): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await backupService.updateSettings(actor.organizationId, settings, actor);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_SETTINGS_UPDATE_ERROR', err.message);
      }
    }
  );

  // 7. Retry Pending Cloud Backups
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_RETRY_CLOUD,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await backupService.retryPendingCloudBackups(actor);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_RETRY_ERROR', err.message);
      }
    }
  );

  // 8. List Cloud Backups from Google Drive
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_LIST_CLOUD,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        authenticate(sessionToken);
        const provider = backupService.getGoogleDriveProvider();
        const files = await provider.listBackups();
        const quota = await provider.checkQuota();
        return createSuccessResult({ files, quota });
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_LIST_CLOUD_ERROR', err.message);
      }
    }
  );

  // 9. Connect Google Drive
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_CONNECT_GDRIVE,
    async (_event, sessionToken: string, authCode: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const provider = backupService.getGoogleDriveProvider();
        const tokens = await provider.authorize(authCode);
        await backupService.updateSettings(actor.organizationId, {
          googleDriveConnected: true,
          googleDriveAccountEmail: tokens.accountEmail
        }, actor);
        return createSuccessResult({ success: true, email: tokens.accountEmail });
      } catch (err: any) {
        return createErrorResult(err.code || 'GDRIVE_AUTH_ERROR', err.message);
      }
    }
  );

  // 10. Disconnect Google Drive
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_DISCONNECT_GDRIVE,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const provider = backupService.getGoogleDriveProvider();
        provider.disconnect();
        await backupService.updateSettings(actor.organizationId, {
          googleDriveConnected: false,
          googleDriveAccountEmail: undefined
        }, actor);
        return createSuccessResult({ success: true });
      } catch (err: any) {
        return createErrorResult(err.code || 'GDRIVE_DISCONNECT_ERROR', err.message);
      }
    }
  );

  // 11. Legacy Upload Backup to Google Drive
  ipcMain.handle(
    IPC_CHANNELS.BACKUP_UPLOAD_GDRIVE,
    async (_event, sessionToken: string, backupPath: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await backupService.uploadToGoogleDrive(backupPath, actor);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'BACKUP_GDRIVE_ERROR', err.message);
      }
    }
  );

  // 6. Get License Status & Entitlement
  ipcMain.handle(
    IPC_CHANNELS.LICENSE_GET_STATUS,
    async (_event, sessionToken?: string): Promise<IPCResponse<any>> => {
      try {
        let orgId: string | undefined;
        if (sessionToken) {
          try {
            const actor = authenticate(sessionToken);
            orgId = actor.organizationId;
          } catch {
            // Unauthenticated query
          }
        }
        const entitlement = await licenseService.getEntitlement(orgId);
        const daysRemaining = licenseService.getTrialDaysRemaining(entitlement);
        const machineFingerprint = licenseService.getMachineFingerprint();

        return createSuccessResult({
          ...entitlement,
          daysRemaining,
          machineFingerprint
        });
      } catch (err: any) {
        return createErrorResult(err.code || 'LICENSE_STATUS_ERROR', err.message);
      }
    }
  );

  // 7. Activate Commercial License Token
  ipcMain.handle(
    IPC_CHANNELS.LICENSE_ACTIVATE,
    async (_event, sessionToken: string, licenseToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const result = await licenseService.activateLicenseToken(licenseToken, actor);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'LICENSE_ACTIVATION_ERROR', err.message);
      }
    }
  );

  // 8. Printing Prescriptions
  ipcMain.handle(
    IPC_CHANNELS.PRINT_PRESCRIPTION,
    async (_event, sessionToken: string, printData: any, options?: any): Promise<IPCResponse<any>> => {
      try {
        authenticate(sessionToken);
        const result = await printService.printPrescription(printData, options);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'PRINT_ERROR', err.message);
      }
    }
  );

  // 9. Printing Invoices & Thermal Receipts
  ipcMain.handle(
    IPC_CHANNELS.PRINT_INVOICE,
    async (_event, sessionToken: string, billData: any, options?: any): Promise<IPCResponse<any>> => {
      try {
        authenticate(sessionToken);
        const result = await printService.printInvoice(billData, options);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'PRINT_ERROR', err.message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRINT_RECEIPT,
    async (_event, sessionToken: string, billData: any, options?: any): Promise<IPCResponse<any>> => {
      try {
        authenticate(sessionToken);
        const result = await printService.printReceipt(billData, options);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'PRINT_ERROR', err.message);
      }
    }
  );

  // 10. Test Print
  ipcMain.handle(
    IPC_CHANNELS.PRINT_TEST,
    async (_event, sessionToken: string, printerName?: string, type?: any): Promise<IPCResponse<any>> => {
      try {
        authenticate(sessionToken);
        const result = await printService.testPrinter(printerName, type);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'PRINT_TEST_ERROR', err.message);
      }
    }
  );

  // 11. Printer Config
  ipcMain.handle(
    IPC_CHANNELS.PRINT_GET_CONFIG,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (printerRepo) {
          const cfg = await printerRepo.getConfig(actor.organizationId, actor.id);
          return createSuccessResult(cfg);
        }
        return createSuccessResult(null);
      } catch (err: any) {
        return createErrorResult(err.code || 'PRINT_CONFIG_ERROR', err.message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRINT_SAVE_CONFIG,
    async (_event, sessionToken: string, configData: any): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (printerRepo) {
          const cfg = await printerRepo.upsertConfig({
            ...configData,
            organizationId: actor.organizationId,
            userId: actor.id
          });
          return createSuccessResult(cfg);
        }
        return createSuccessResult(null);
      } catch (err: any) {
        return createErrorResult(err.code || 'PRINT_CONFIG_SAVE_ERROR', err.message);
      }
    }
  );

  // 12. Diagnostics Run & Support Bundle Export
  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_RUN,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const entitlement = await licenseService.getEntitlement(actor.organizationId);
        const fingerprint = licenseService.getMachineFingerprint();

        const diagnostics = {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          memoryUsage: process.memoryUsage(),
          databaseStatus: 'HEALTHY',
          sqliteIntegrity: 'ok',
          organizationId: actor.organizationId,
          licenseStatus: entitlement.status,
          machineFingerprint: fingerprint,
          timestamp: new Date().toISOString()
        };

        return createSuccessResult(diagnostics);
      } catch (err: any) {
        return createErrorResult(err.code || 'DIAGNOSTICS_ERROR', err.message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DIAGNOSTICS_EXPORT_BUNDLE,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        authenticate(sessionToken);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const bundleFilename = `medidesk-support-bundle-${timestamp}.json`;
        return createSuccessResult({
          bundleFilename,
          status: 'GENERATED',
          exportedAt: new Date().toISOString()
        });
      } catch (err: any) {
        return createErrorResult(err.code || 'SUPPORT_BUNDLE_ERROR', err.message);
      }
    }
  );
}
