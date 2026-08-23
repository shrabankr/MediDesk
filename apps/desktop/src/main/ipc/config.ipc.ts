import { ipcMain } from 'electron';
import { IPC_CHANNELS, IPCResponse, AppConfig } from '@medidesk/shared';

export function registerConfigIpc(config: AppConfig): void {
  ipcMain.handle(
    IPC_CHANNELS.GET_ENVIRONMENT_INFO,
    async (): Promise<IPCResponse<Partial<AppConfig>>> => {
      // Return safe, sanitized environment details to the renderer
      return {
        success: true,
        data: {
          env: config.env,
          appName: config.appName,
          version: config.version,
          logLevel: config.logLevel,
          isDevelopment: config.isDevelopment,
          isTest: config.isTest,
          isProduction: config.isProduction
        }
      };
    }
  );
}
