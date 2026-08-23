import { ipcMain } from 'electron';
import { UserManagementService, AuthenticationService } from '@medidesk/application';
import {
  IPC_CHANNELS,
  IPCResponse,
  SafeUser,
  UserPermissionsData
} from '@medidesk/shared';
import {
  CreateUserIPCRequestSchema,
  UpdateUserIPCRequestSchema,
  ResetPasswordIPCRequestSchema,
  ToggleUserStatusIPCRequestSchema,
  validateSchema
} from '@medidesk/validation';
import { Logger } from '@medidesk/shared';

const logger = new Logger('UserIPC');

export function registerUserIpcHandlers(
  userService: UserManagementService,
  authService: AuthenticationService
): void {
  // Helper to authenticate IPC caller
  function authenticateCaller(sessionToken: unknown) {
    if (typeof sessionToken !== 'string' || !sessionToken) {
      throw new Error('Unauthorized: Valid session token required');
    }
    const sessionUser = authService.getSessionUser(sessionToken);
    if (!sessionUser) {
      throw new Error('Unauthorized: Session expired or invalid');
    }
    return sessionUser;
  }

  // 1. List Users
  ipcMain.handle(
    IPC_CHANNELS.USER_LIST,
    async (_event, args: { organizationId: string; sessionToken: string }): Promise<IPCResponse<SafeUser[]>> => {
      try {
        const actor = authenticateCaller(args?.sessionToken);
        const users = await userService.listUsers(args.organizationId, actor);
        return { success: true, data: users };
      } catch (error) {
        logger.warn(`User list error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'USER_LIST_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );

  // 2. Create User
  ipcMain.handle(
    IPC_CHANNELS.USER_CREATE,
    async (_event, args: { input: unknown; sessionToken: string }): Promise<IPCResponse<SafeUser>> => {
      try {
        const actor = authenticateCaller(args?.sessionToken);
        const validated = validateSchema(CreateUserIPCRequestSchema, args?.input);
        if (!validated.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid user creation payload',
              details: validated.errors
            }
          };
        }

        const user = await userService.createUser(validated.data, actor);
        return { success: true, data: user };
      } catch (error) {
        logger.warn(`Create user error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'USER_CREATE_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );

  // 3. Update User
  ipcMain.handle(
    IPC_CHANNELS.USER_UPDATE,
    async (_event, args: { input: unknown; sessionToken: string }): Promise<IPCResponse<SafeUser>> => {
      try {
        const actor = authenticateCaller(args?.sessionToken);
        const validated = validateSchema(UpdateUserIPCRequestSchema, args?.input);
        if (!validated.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid user update payload',
              details: validated.errors
            }
          };
        }

        const user = await userService.updateUser(validated.data, actor);
        return { success: true, data: user };
      } catch (error) {
        logger.warn(`Update user error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'USER_UPDATE_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );

  // 4. Reset Password
  ipcMain.handle(
    IPC_CHANNELS.USER_RESET_PASSWORD,
    async (_event, args: { input: unknown; sessionToken: string }): Promise<IPCResponse<{ reset: boolean }>> => {
      try {
        const actor = authenticateCaller(args?.sessionToken);
        const validated = validateSchema(ResetPasswordIPCRequestSchema, args?.input);
        if (!validated.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid password reset payload',
              details: validated.errors
            }
          };
        }

        await userService.resetPassword(validated.data, actor);
        return { success: true, data: { reset: true } };
      } catch (error) {
        logger.warn(`Reset password error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'RESET_PASSWORD_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );

  // 5. Toggle User Status
  ipcMain.handle(
    IPC_CHANNELS.USER_TOGGLE_STATUS,
    async (_event, args: { input: unknown; sessionToken: string }): Promise<IPCResponse<SafeUser>> => {
      try {
        const actor = authenticateCaller(args?.sessionToken);
        const validated = validateSchema(ToggleUserStatusIPCRequestSchema, args?.input);
        if (!validated.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid toggle status payload',
              details: validated.errors
            }
          };
        }

        const user = await userService.toggleUserStatus(validated.data, actor);
        return { success: true, data: user };
      } catch (error) {
        logger.warn(`Toggle user status error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'TOGGLE_STATUS_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );

  // 6. Get User Permissions
  ipcMain.handle(
    IPC_CHANNELS.RBAC_GET_USER_PERMISSIONS,
    async (_event, args: { userId: string; sessionToken: string }): Promise<IPCResponse<UserPermissionsData>> => {
      try {
        const actor = authenticateCaller(args?.sessionToken);
        const perms = await userService.getUserPermissions(args.userId, actor);
        return { success: true, data: perms };
      } catch (error) {
        logger.warn(`Get user permissions error: ${(error as Error).message}`);
        return {
          success: false,
          error: {
            code: (error as Error).name || 'RBAC_ERROR',
            message: (error as Error).message
          }
        };
      }
    }
  );
}
