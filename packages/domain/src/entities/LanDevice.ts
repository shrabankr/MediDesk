export type DeviceStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REVOKED' | 'BLOCKED';

export type DeviceRole =
  | 'SERVER'
  | 'DOCTOR_WORKSTATION'
  | 'PHARMACY_POS'
  | 'RECEPTION'
  | 'GENERAL_CLIENT';

export type LanOperatingMode = 'SINGLE_PC' | 'LAN_SERVER' | 'LAN_CLIENT';

export interface LanDevice {
  id: string;
  organizationId: string;
  deviceName: string;
  deviceFingerprint: string;
  deviceRole: DeviceRole;
  ipAddress?: string;
  macAddress?: string;
  publicKey?: string;
  deviceTokenEnc?: string;
  status: DeviceStatus;
  lastSeenAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLanDeviceDTO {
  id?: string;
  organizationId: string;
  deviceName: string;
  deviceFingerprint: string;
  deviceRole?: DeviceRole;
  ipAddress?: string;
  macAddress?: string;
  publicKey?: string;
  status?: DeviceStatus;
}

export interface UpdateLanDeviceDTO {
  deviceName?: string;
  deviceRole?: DeviceRole;
  ipAddress?: string;
  deviceTokenEnc?: string;
  status?: DeviceStatus;
  lastSeenAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface LanPairingPin {
  id: string;
  organizationId: string;
  pinCode: string;
  expiresAt: Date;
  isUsed: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface LanServerConfig {
  organizationId: string;
  operatingMode: LanOperatingMode;
  serverPort: number;
  serverHostname?: string;
  tlsCertificate?: string;
  tlsPrivateKeyEnc?: string;
  serverFingerprint?: string;
  maxClients: number;
  autoDiscoveryEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateLanServerConfigDTO {
  operatingMode?: LanOperatingMode;
  serverPort?: number;
  serverHostname?: string;
  tlsCertificate?: string;
  tlsPrivateKeyEnc?: string;
  serverFingerprint?: string;
  maxClients?: number;
  autoDiscoveryEnabled?: boolean;
}

export interface LanPairingRequestDTO {
  organizationId: string;
  pairingPin: string;
  deviceName: string;
  deviceFingerprint: string;
  deviceRole: DeviceRole;
  publicKey?: string;
  ipAddress?: string;
}

export interface LanPairingResponse {
  success: boolean;
  status: DeviceStatus;
  deviceId: string;
  serverFingerprint?: string;
  deviceToken?: string;
  message: string;
}
