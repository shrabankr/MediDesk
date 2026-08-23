import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  SystemStatusData,
  InitializationStateData
} from '@medidesk/shared';
import {
  StatusService,
  SystemInitializationService
} from '@medidesk/application';
import {
  validateSchema,
  InitializeSystemRequestSchema,
  InitializeSystemRequestInput
} from '@medidesk/validation';

export function registerSystemIpc(
  statusService: StatusService,
  initService: SystemInitializationService
): void {
  // 1. Get System Status
  ipcMain.handle(
    IPC_CHANNELS.GET_SYSTEM_STATUS,
    async (): Promise<IPCResponse<SystemStatusData>> => {
      try {
        const data = await statusService.getSystemStatus();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SYSTEM_STATUS_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        };
      }
    }
  );

  // 2. Get Initialization State
  ipcMain.handle(
    IPC_CHANNELS.GET_INITIALIZATION_STATE,
    async (): Promise<IPCResponse<InitializationStateData>> => {
      try {
        const data = await initService.getInitializationState();
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'INIT_STATE_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        };
      }
    }
  );

  // 3. Initialize System (Validated)
  ipcMain.handle(
    IPC_CHANNELS.INITIALIZE_SYSTEM,
    async (_event, rawInput: unknown): Promise<IPCResponse<unknown>> => {
      const validation = validateSchema(InitializeSystemRequestSchema, rawInput);
      if (!validation.success) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid initialization request parameters',
            details: validation.errors
          }
        };
      }

      try {
        const result = await initService.initialize(validation.data as InitializeSystemRequestInput);
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'INITIALIZATION_FAILED',
            message: error instanceof Error ? error.message : 'System initialization failed'
          }
        };
      }
    }
  );
}
