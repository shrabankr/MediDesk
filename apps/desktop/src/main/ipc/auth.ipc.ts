import { ipcMain } from 'electron';
import { AuthenticationService } from '@medidesk/application';
import { IPC_CHANNELS, IPCResponse, LoginResponseData, SessionUser } from '@medidesk/shared';
import { LoginIPCRequestSchema, validateSchema } from '@medidesk/validation';
import { Logger } from '@medidesk/shared';

const logger = new Logger('AuthIPC');

export function registerAuthIpcHandlers(authService: AuthenticationService): void {
  // 1. Login
  ipcMain.handle(
    IPC_CHANNELS.AUTH_LOGIN,
    async (_event, request: unknown): Promise<IPCResponse<LoginResponseData>> => {
      try {
        const validated = validateSchema(LoginIPCRequestSchema, request);
        if (!validated.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid login request credentials',
              details: validated.errors
            }
          };
        }

        const result = await authService.login(validated.data);
        return {
          success: true,
          data: result
        };
      } catch (error) {
        logger.warn(`Login IPC error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'AUTH_ERROR',
            message: (error as Error).message || 'Authentication failed'
          }
        };
      }
    }
  );

  // 2. Logout
  ipcMain.handle(
    IPC_CHANNELS.AUTH_LOGOUT,
    async (_event, sessionToken: unknown): Promise<IPCResponse<{ loggedOut: boolean }>> => {
      try {
        if (typeof sessionToken === 'string' && sessionToken.length > 0) {
          await authService.logout(sessionToken);
        }
        return {
          success: true,
          data: { loggedOut: true }
        };
      } catch (error) {
        logger.error(`Logout IPC error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: 'LOGOUT_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );

  // 3. Get Current User / Verify Session
  ipcMain.handle(
    IPC_CHANNELS.AUTH_GET_CURRENT_USER,
    async (_event, sessionToken: unknown): Promise<IPCResponse<SessionUser | null>> => {
      try {
        if (typeof sessionToken !== 'string' || !sessionToken) {
          return { success: true, data: null };
        }
        const user = authService.getSessionUser(sessionToken);
        return { success: true, data: user };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SESSION_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );
}
