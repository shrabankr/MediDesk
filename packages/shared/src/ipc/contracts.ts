import { LicenseStatus } from '@medidesk/domain';

export const IPC_CHANNELS = {
  // System & Status
  GET_SYSTEM_STATUS: 'app:get-system-status',
  GET_INITIALIZATION_STATE: 'app:get-initialization-state',
  INITIALIZE_SYSTEM: 'app:initialize-system',

  // Config & Diagnostics
  GET_ENVIRONMENT_INFO: 'config:get-environment-info',

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
