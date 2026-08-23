import { LicenseStatus, SafeUser, SessionUser, RoleName } from '@medidesk/domain';

export type { SafeUser, SessionUser };

export const IPC_CHANNELS = {
  // System & Status
  GET_SYSTEM_STATUS: 'app:get-system-status',
  GET_INITIALIZATION_STATE: 'app:get-initialization-state',
  INITIALIZE_SYSTEM: 'app:initialize-system',

  // Config & Diagnostics
  GET_ENVIRONMENT_INFO: 'config:get-environment-info',

  // Authentication & Session
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_CURRENT_USER: 'auth:get-current-user',
  AUTH_RECOVER_OWNER: 'auth:recover-owner',

  // User Management
  USER_LIST: 'user:list',
  USER_CREATE: 'user:create',
  USER_CREATE_OWNER_RECOVERY: 'user:create-owner-recovery',
  USER_UPDATE: 'user:update',
  USER_RESET_PASSWORD: 'user:reset-password',
  USER_TOGGLE_STATUS: 'user:toggle-status',

  // RBAC & Permissions
  RBAC_GET_USER_PERMISSIONS: 'rbac:get-user-permissions',

  // Audit
  LOG_AUDIT_EVENT: 'audit:log-event',
  GET_RECENT_AUDIT_EVENTS: 'audit:get-recent-events'
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface SystemStatusData {
  appName: string;
  version: string;
  database: {
    status: 'connected' | 'disconnected' | 'migrating' | 'error';
    databasePath: string;
    appliedMigrations: number;
  };
  application: {
    status: 'ready' | 'initializing' | 'maintenance' | 'error';
    initialized: boolean;
    uptimeSeconds: number;
  };
  network: {
    mode: 'offline_first';
    internetRequired: false;
    isOnline: boolean;
  };
  licensing: {
    status: LicenseStatus;
    trialDaysRemaining?: number;
  };
  security: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
  };
  environment: 'development' | 'test' | 'production';
}

export interface InitializationStateData {
  isInitialized: boolean;
  requiresDeveloperSetup: boolean;
  organizationCount: number;
  userCount: number;
}

export interface LoginResponseData {
  user: SessionUser;
  sessionToken: string;
}

export interface CreateUserRequest {
  organizationId: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  roles: RoleName[];
}

export interface UpdateUserRequest {
  userId: string;
  fullName?: string;
  email?: string;
  roles?: RoleName[];
}

export interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

export interface ToggleUserStatusRequest {
  userId: string;
  isActive: boolean;
}

export interface RecoverOwnerRequest {
  username: string;
  recoveryToken: string;
  newPassword?: string;
}

export interface CreateOwnerViaRecoveryRequest {
  organizationId: string;
  username: string;
  email: string;
  fullName: string;
  password: string;
  recoveryToken: string;
}

export interface UserPermissionsData {
  userId: string;
  username: string;
  roles: RoleName[];
  permissions: string[];
  isOwner: boolean;
  isDeveloper: boolean;
}
