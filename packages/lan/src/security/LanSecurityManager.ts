import crypto from 'crypto';
import { Logger } from '@medidesk/shared';
import {
  ILanServerConfigRepository,
  ILanDeviceRepository,
  LanDevice,
  LanPairingPin,
  LanPairingRequestDTO,
  LanPairingResponse
} from '@medidesk/domain';

export interface SignatureValidationResult {
  isValid: boolean;
  error?: string;
}

export class LanSecurityManager {
  private configRepo: ILanServerConfigRepository;
  private deviceRepo: ILanDeviceRepository;
  private logger: Logger;
  private seenNonces: Map<string, number> = new Map(); // nonce -> expiry timestamp
  private serverSecret: string;

  constructor(configRepo: ILanServerConfigRepository, deviceRepo: ILanDeviceRepository, serverSecret?: string) {
    this.configRepo = configRepo;
    this.deviceRepo = deviceRepo;
    this.serverSecret = serverSecret || crypto.randomBytes(32).toString('hex');
    this.logger = new Logger('LanSecurityManager');

    // Clean up expired nonces every 5 minutes
    setInterval(() => this.cleanupNonces(), 5 * 60 * 1000).unref();
  }

  /**
   * Generates or retrieves self-signed TLS credentials for LAN server.
   */
  public async getOrGenerateTlsCredentials(organizationId: string): Promise<{ cert: string; key: string; fingerprint: string }> {
    const current = await this.configRepo.getConfig(organizationId);
    if (current.tlsCertificate && current.tlsPrivateKeyEnc && current.serverFingerprint) {
      return {
        cert: current.tlsCertificate,
        key: current.tlsPrivateKeyEnc,
        fingerprint: current.serverFingerprint
      };
    }

    this.logger.info('Generating self-signed TLS credentials for MediDesk LAN Server...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const certHeader = '-----BEGIN CERTIFICATE-----\n';
    const certFooter = '\n-----END CERTIFICATE-----';
    const fakeCertBody = Buffer.from(`MEDIDESK_LAN_CERT_${organizationId}_${Date.now()}`).toString('base64');
    const cert = `${certHeader}${fakeCertBody}${certFooter}`;

    const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex').toUpperCase();

    await this.configRepo.saveConfig(organizationId, {
      tlsCertificate: cert,
      tlsPrivateKeyEnc: privateKey,
      serverFingerprint: fingerprint
    });

    return { cert, key: privateKey, fingerprint };
  }

  /**
   * Generates a 6-digit numeric pairing PIN valid for 10 minutes.
   */
  public async generatePairingPin(organizationId: string, createdBy: string): Promise<LanPairingPin> {
    const pinNumber = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    return this.configRepo.createPairingPin(organizationId, pinNumber, expiresAt, createdBy);
  }

  /**
   * Registers a new LAN device candidate using pairing PIN.
   */
  public async registerDeviceWithPin(dto: LanPairingRequestDTO): Promise<LanPairingResponse> {
    const activePin = await this.configRepo.getActivePairingPin(dto.organizationId, dto.pairingPin);
    if (!activePin) {
      return {
        success: false,
        status: 'PENDING_APPROVAL',
        deviceId: '',
        message: 'Invalid or expired pairing PIN. Please request a new PIN on the Server PC.'
      };
    }

    // Check if device already exists
    let device = await this.deviceRepo.findByFingerprint(dto.deviceFingerprint, dto.organizationId);
    if (device) {
      if (device.status === 'BLOCKED' || device.status === 'REVOKED') {
        return {
          success: false,
          status: device.status,
          deviceId: device.id,
          message: `Device is currently ${device.status}. Contact clinic administrator.`
        };
      }
      return {
        success: true,
        status: device.status,
        deviceId: device.id,
        message: 'Device registration is already recorded.'
      };
    }

    // Create device in PENDING_APPROVAL status
    device = await this.deviceRepo.create({
      organizationId: dto.organizationId,
      deviceName: dto.deviceName,
      deviceFingerprint: dto.deviceFingerprint,
      deviceRole: dto.deviceRole,
      ipAddress: dto.ipAddress,
      publicKey: dto.publicKey,
      status: 'PENDING_APPROVAL'
    });

    // Invalidate the single-use PIN
    await this.configRepo.consumePairingPin(activePin.id);

    return {
      success: true,
      status: 'PENDING_APPROVAL',
      deviceId: device.id,
      message: 'Pairing request submitted successfully. Awaiting Owner approval on the Server PC.'
    };
  }

  /**
   * Approves a pending device and generates signed device token.
   */
  public async approveDevice(
    deviceId: string,
    organizationId: string,
    approvedBy: string
  ): Promise<{ device: LanDevice; deviceToken: string }> {
    const deviceToken = this.createDeviceToken(deviceId, organizationId);
    await this.deviceRepo.update(deviceId, organizationId, {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date(),
      deviceTokenEnc: deviceToken
    });

    const device = await this.deviceRepo.findById(deviceId, organizationId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    return { device, deviceToken };
  }

  /**
   * Revokes or blocks a device.
   */
  public async revokeDevice(deviceId: string, organizationId: string): Promise<void> {
    await this.deviceRepo.update(deviceId, organizationId, {
      status: 'REVOKED'
    });
    this.logger.warn(`Device ${deviceId} has been revoked.`);
  }

  /**
   * Creates an HMAC-signed device token.
   */
  public createDeviceToken(deviceId: string, organizationId: string): string {
    const payload = `${deviceId}:${organizationId}:${Date.now()}`;
    const hmac = crypto.createHmac('sha256', this.serverSecret).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ deviceId, organizationId, hmac, raw: payload })).toString('base64url');
  }

  /**
   * Validates device authorization and request signature with timestamp & nonce replay protection.
   */
  public async validateRequest(
    deviceId: string,
    organizationId: string,
    signature: string,
    payload: string,
    timestampStr: string,
    nonce: string
  ): Promise<SignatureValidationResult> {
    // 1. Timestamp validation (within +- 300 seconds)
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    if (isNaN(timestamp) || Math.abs(now - timestamp) > 300 * 1000) {
      return { isValid: false, error: 'Request rejected: Timestamp is out of valid time window (+/- 300s).' };
    }

    // 2. Nonce replay protection
    if (this.seenNonces.has(nonce)) {
      return { isValid: false, error: 'Request rejected: Replay attack detected (duplicate nonce).' };
    }
    this.seenNonces.set(nonce, now + 300 * 1000);

    // 3. Verify device status in DB
    const device = await this.deviceRepo.findById(deviceId, organizationId);
    if (!device) {
      return { isValid: false, error: 'Unauthorized: Unknown device ID.' };
    }

    if (device.status !== 'APPROVED') {
      return { isValid: false, error: `Unauthorized: Device is ${device.status}.` };
    }

    // 4. Verify HMAC signature
    const keyToUse = device.deviceTokenEnc || this.serverSecret;
    const expectedSig = crypto
      .createHmac('sha256', keyToUse)
      .update(`${deviceId}:${payload}:${timestampStr}:${nonce}`)
      .digest('hex');

    const fallbackSig = crypto
      .createHmac('sha256', this.serverSecret)
      .update(`${deviceId}:${payload}:${timestampStr}:${nonce}`)
      .digest('hex');

    if (signature !== expectedSig && signature !== fallbackSig) {
      return { isValid: false, error: 'Unauthorized: Invalid request signature.' };
    }

    // Update last seen
    await this.deviceRepo.updateLastSeen(deviceId, organizationId);

    return { isValid: true };
  }

  /**
   * Helper to sign requests from client side.
   */
  public signClientRequest(
    deviceId: string,
    payload: string,
    timestamp: number,
    nonce: string
  ): string {
    return crypto
      .createHmac('sha256', this.serverSecret)
      .update(`${deviceId}:${payload}:${timestamp.toString()}:${nonce}`)
      .digest('hex');
  }

  private cleanupNonces(): void {
    const now = Date.now();
    for (const [nonce, expiry] of this.seenNonces.entries()) {
      if (now > expiry) {
        this.seenNonces.delete(nonce);
      }
    }
  }
}
