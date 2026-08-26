import type { LanServerConfig, UpdateLanServerConfigDTO, LanPairingPin } from '../entities/LanDevice.js';

export interface ILanServerConfigRepository {
  getConfig(organizationId: string): Promise<LanServerConfig>;
  saveConfig(organizationId: string, dto: UpdateLanServerConfigDTO): Promise<LanServerConfig>;
  createPairingPin(organizationId: string, pinCode: string, expiresAt: Date, createdBy: string): Promise<LanPairingPin>;
  getActivePairingPin(organizationId: string, pinCode: string): Promise<LanPairingPin | null>;
  consumePairingPin(id: string): Promise<void>;
}
