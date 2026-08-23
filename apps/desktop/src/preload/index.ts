import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  SystemStatusData,
  InitializationStateData,
  LoginResponseData,
  SessionUser,
  SafeUser,
  UserPermissionsData,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
  ToggleUserStatusRequest
} from '@medidesk/shared';
import { AuditEvent } from '@medidesk/domain';

/**
 * MediDesk Secure Preload Bridge.
 * Only typed, whitelisted methods are exposed to the React renderer.
 * Direct access to Node.js, SQLite, and the filesystem is strictly blocked.
 */
const mediDeskBridge = {
  // System & Status
  getSystemStatus: async (): Promise<IPCResponse<SystemStatusData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_STATUS);
  },

  getInitializationState: async (): Promise<IPCResponse<InitializationStateData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_INITIALIZATION_STATE);
  },

  initializeSystem: async (payload: unknown): Promise<IPCResponse<unknown>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INITIALIZE_SYSTEM, payload);
  },

  // Environment info
  getEnvironmentInfo: async (): Promise<IPCResponse<Record<string, unknown>>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_ENVIRONMENT_INFO);
  },

  // Authentication & Sessions
  login: async (payload: { username: string; password: string }): Promise<IPCResponse<LoginResponseData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload);
  },

  logout: async (sessionToken: string): Promise<IPCResponse<{ loggedOut: boolean }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT, sessionToken);
  },

  getCurrentUser: async (sessionToken: string): Promise<IPCResponse<SessionUser | null>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_CURRENT_USER, sessionToken);
  },

  recoverOwnerAccount: async (payload: { username: string; recoveryToken: string; newPassword?: string }): Promise<IPCResponse<{ success: boolean; message: string }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUTH_RECOVER_OWNER, payload);
  },

  // User Management
  listUsers: async (organizationId: string, sessionToken: string): Promise<IPCResponse<SafeUser[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_LIST, { organizationId, sessionToken });
  },

  createUser: async (input: CreateUserRequest, sessionToken: string): Promise<IPCResponse<SafeUser>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_CREATE, { input, sessionToken });
  },

  updateUser: async (input: UpdateUserRequest, sessionToken: string): Promise<IPCResponse<SafeUser>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_UPDATE, { input, sessionToken });
  },

  resetPassword: async (input: ResetPasswordRequest, sessionToken: string): Promise<IPCResponse<{ reset: boolean }>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_RESET_PASSWORD, { input, sessionToken });
  },

  toggleUserStatus: async (input: ToggleUserStatusRequest, sessionToken: string): Promise<IPCResponse<SafeUser>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.USER_TOGGLE_STATUS, { input, sessionToken });
  },

  // RBAC & Permissions
  getUserPermissions: async (userId: string, sessionToken: string): Promise<IPCResponse<UserPermissionsData>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RBAC_GET_USER_PERMISSIONS, { userId, sessionToken });
  },

  // Audit
  logAuditEvent: async (payload: unknown): Promise<IPCResponse<unknown>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LOG_AUDIT_EVENT, payload);
  },

  getRecentAuditEvents: async (limit?: number): Promise<IPCResponse<AuditEvent[]>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_AUDIT_EVENTS, { limit });
  }
};

export type MediDeskBridge = typeof mediDeskBridge;

// Expose safe API to renderer
contextBridge.exposeInMainWorld('mediDeskBridge', mediDeskBridge);
