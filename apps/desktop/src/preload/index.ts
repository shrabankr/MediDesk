import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  SystemStatusData,
  InitializationStateData
} from '@medidesk/shared';

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

  // Audit
  logAuditEvent: async (payload: unknown): Promise<IPCResponse<unknown>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LOG_AUDIT_EVENT, payload);
  },

  getRecentAuditEvents: async (limit?: number): Promise<IPCResponse<unknown>> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_AUDIT_EVENTS, { limit });
  }
};

export type MediDeskBridge = typeof mediDeskBridge;

// Expose safe API to renderer
contextBridge.exposeInMainWorld('mediDeskBridge', mediDeskBridge);
