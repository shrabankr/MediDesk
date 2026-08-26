import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  createSuccessResult,
  createErrorResult
} from '@medidesk/shared';
import {
  LanServer,
  LanClientGateway,
  LanSecurityManager
} from '@medidesk/lan';
import {
  ILanServerConfigRepository,
  ILanDeviceRepository,
  UpdateLanServerConfigDTO,
  LanPairingRequestDTO,
  PermissionCode,
  AuthorizationError
} from '@medidesk/domain';
import { AuthenticationService } from '@medidesk/application';

export function registerLanIpcHandlers(
  lanServer: LanServer,
  lanGateway: LanClientGateway,
  securityManager: LanSecurityManager,
  authService: AuthenticationService,
  configRepo: ILanServerConfigRepository,
  deviceRepo: ILanDeviceRepository
): void {
  const authenticate = (sessionToken: string) => {
    const user = authService.getSessionUser(sessionToken);
    if (!user) {
      throw new Error('Authentication required. Session is invalid or expired.');
    }
    return user;
  };

  // 1. Get LAN Config
  ipcMain.handle(
    IPC_CHANNELS.LAN_GET_CONFIG,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const config = await configRepo.getConfig(actor.organizationId);
        return createSuccessResult(config);
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_CONFIG_ERROR', err.message);
      }
    }
  );

  // 2. Save LAN Config
  ipcMain.handle(
    IPC_CHANNELS.LAN_SAVE_CONFIG,
    async (_event, sessionToken: string, dto: UpdateLanServerConfigDTO): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (!actor.roles.includes('OWNER' as any)) {
          throw new AuthorizationError('Only clinic Owner can modify LAN configuration.');
        }
        const updated = await configRepo.saveConfig(actor.organizationId, dto);
        return createSuccessResult(updated);
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_CONFIG_SAVE_ERROR', err.message);
      }
    }
  );

  // 3. Start LAN Server
  ipcMain.handle(
    IPC_CHANNELS.LAN_START_SERVER,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (!actor.roles.includes('OWNER' as any)) {
          throw new AuthorizationError('Only clinic Owner can start the LAN Server.');
        }
        const config = await lanServer.start(actor.organizationId);
        return createSuccessResult({ isRunning: true, config });
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_SERVER_START_ERROR', err.message);
      }
    }
  );

  // 4. Stop LAN Server
  ipcMain.handle(
    IPC_CHANNELS.LAN_STOP_SERVER,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (!actor.roles.includes('OWNER' as any)) {
          throw new AuthorizationError('Only clinic Owner can stop the LAN Server.');
        }
        await lanServer.stop();
        return createSuccessResult({ isRunning: false });
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_SERVER_STOP_ERROR', err.message);
      }
    }
  );

  // 5. Generate Pairing PIN
  ipcMain.handle(
    IPC_CHANNELS.LAN_GENERATE_PIN,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (!actor.roles.includes('OWNER' as any)) {
          throw new AuthorizationError('Only clinic Owner can generate pairing PINs.');
        }
        const pin = await securityManager.generatePairingPin(actor.organizationId, actor.id);
        return createSuccessResult(pin);
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_PIN_GEN_ERROR', err.message);
      }
    }
  );

  // 6. Register Device (from client gateway or local)
  ipcMain.handle(
    IPC_CHANNELS.LAN_REGISTER_DEVICE,
    async (_event, dto: LanPairingRequestDTO): Promise<IPCResponse<any>> => {
      try {
        const result = await securityManager.registerDeviceWithPin(dto);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_REGISTER_ERROR', err.message);
      }
    }
  );

  // 7. Approve Device
  ipcMain.handle(
    IPC_CHANNELS.LAN_APPROVE_DEVICE,
    async (_event, sessionToken: string, deviceId: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (!actor.roles.includes('OWNER' as any)) {
          throw new AuthorizationError('Only clinic Owner can approve client devices.');
        }
        const result = await securityManager.approveDevice(deviceId, actor.organizationId, actor.id);
        return createSuccessResult(result);
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_APPROVE_ERROR', err.message);
      }
    }
  );

  // 8. Revoke Device
  ipcMain.handle(
    IPC_CHANNELS.LAN_REVOKE_DEVICE,
    async (_event, sessionToken: string, deviceId: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (!actor.roles.includes('OWNER' as any)) {
          throw new AuthorizationError('Only clinic Owner can revoke client devices.');
        }
        await securityManager.revokeDevice(deviceId, actor.organizationId);
        return createSuccessResult({ success: true, deviceId });
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_REVOKE_ERROR', err.message);
      }
    }
  );

  // 9. List Devices
  ipcMain.handle(
    IPC_CHANNELS.LAN_LIST_DEVICES,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const devices = await deviceRepo.listByOrg(actor.organizationId);
        return createSuccessResult(devices);
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_LIST_DEVICES_ERROR', err.message);
      }
    }
  );

  // 10. Get LAN Status & Gateway State
  ipcMain.handle(
    IPC_CHANNELS.LAN_GET_STATUS,
    async (_event, sessionToken?: string): Promise<IPCResponse<any>> => {
      try {
        let orgId = 'default-org';
        if (sessionToken) {
          const user = authService.getSessionUser(sessionToken);
          if (user) orgId = user.organizationId;
        }

        const config = await configRepo.getConfig(orgId);
        const approvedCount = await deviceRepo.countApproved(orgId);

        return createSuccessResult({
          operatingMode: config.operatingMode,
          isServerRunning: lanServer.getIsRunning(),
          serverPort: lanServer.getPort(),
          serverFingerprint: config.serverFingerprint,
          clientConnectionState: lanGateway.getConnectionState(),
          approvedDevicesCount: approvedCount
        });
      } catch (err: any) {
        return createErrorResult(err.code || 'LAN_STATUS_ERROR', err.message);
      }
    }
  );
}
