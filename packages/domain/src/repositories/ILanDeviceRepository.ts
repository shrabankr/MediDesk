import type { LanDevice, CreateLanDeviceDTO, UpdateLanDeviceDTO, DeviceStatus } from '../entities/LanDevice.js';

export interface ILanDeviceRepository {
  create(dto: CreateLanDeviceDTO): Promise<LanDevice>;
  findById(id: string, organizationId: string): Promise<LanDevice | null>;
  findByFingerprint(fingerprint: string, organizationId: string): Promise<LanDevice | null>;
  listByOrg(organizationId: string, limit?: number): Promise<LanDevice[]>;
  update(id: string, organizationId: string, dto: UpdateLanDeviceDTO): Promise<LanDevice>;
  updateStatus(id: string, organizationId: string, status: DeviceStatus, approvedBy?: string): Promise<void>;
  updateLastSeen(id: string, organizationId: string, ipAddress?: string): Promise<void>;
  delete(id: string, organizationId: string): Promise<void>;
  countApproved(organizationId: string): Promise<number>;
}
