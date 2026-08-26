import crypto from 'crypto';
import { Logger } from '@medidesk/shared';
import {
  LanPairingRequestDTO,
  LanPairingResponse,
  DeviceStatus,
  SessionUser
} from '@medidesk/domain';

export type LanConnectionState = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface LanClientConfig {
  serverUrl: string;
  organizationId: string;
  deviceId?: string;
  deviceToken?: string;
  deviceFingerprint?: string;
}

export class LanClientGateway {
  private config: LanClientConfig;
  private logger: Logger;
  private connectionState: LanConnectionState = 'DISCONNECTED';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private onStateChangeCallback?: (state: LanConnectionState) => void;

  constructor(config: LanClientConfig) {
    this.config = config;
    this.logger = new Logger('LanClientGateway');
  }

  public setConfig(config: Partial<LanClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): LanClientConfig {
    return { ...this.config };
  }

  public getConnectionState(): LanConnectionState {
    return this.connectionState;
  }

  public onConnectionStateChange(cb: (state: LanConnectionState) => void): void {
    this.onStateChangeCallback = cb;
  }

  public startHeartbeat(intervalMs = 5000): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      await this.checkHealth();
    }, intervalMs);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public async checkHealth(): Promise<{ isHealthy: boolean; fingerprint?: string }> {
    try {
      const res = await fetch(`${this.config.serverUrl}/api/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const data = await res.json() as any;
        this.updateState('CONNECTED');
        return { isHealthy: true, fingerprint: data.serverFingerprint };
      } else {
        this.updateState('RECONNECTING');
        return { isHealthy: false };
      }
    } catch {
      this.updateState('DISCONNECTED');
      return { isHealthy: false };
    }
  }

  /**
   * Submits pairing request to LAN Server using 6-digit PIN.
   */
  public async pairWithServer(dto: LanPairingRequestDTO): Promise<LanPairingResponse> {
    try {
      const res = await fetch(`${this.config.serverUrl}/api/v1/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
        signal: AbortSignal.timeout(5000)
      });

      const data = await res.json() as any;
      if (data.deviceId) {
        this.config.deviceId = data.deviceId;
      }
      return data;
    } catch (err: any) {
      this.logger.error(`Pairing failed: ${err.message}`);
      return {
        success: false,
        status: 'PENDING_APPROVAL',
        deviceId: '',
        message: `Connection error: Cannot reach LAN Server at ${this.config.serverUrl}`
      };
    }
  }

  /**
   * Polls approval status for a device.
   */
  public async pollApprovalStatus(fingerprint: string): Promise<{ status: DeviceStatus; deviceToken?: string }> {
    try {
      const url = `${this.config.serverUrl}/api/v1/devices/status?fingerprint=${encodeURIComponent(fingerprint)}&organizationId=${encodeURIComponent(this.config.organizationId)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const data = await res.json() as any;

      if (data.deviceToken) {
        this.config.deviceToken = data.deviceToken;
      }
      if (data.deviceId) {
        this.config.deviceId = data.deviceId;
      }
      return { status: data.status, deviceToken: data.deviceToken };
    } catch {
      return { status: 'PENDING_APPROVAL' };
    }
  }

  /**
   * Executes an authenticated LAN REST request.
   */
  public async request<T = any>(
    method: string,
    pathname: string,
    body?: any,
    sessionToken?: string
  ): Promise<{ success: boolean; data?: T; error?: { code: string; message: string } }> {
    const url = `${this.config.serverUrl}${pathname}`;
    const bodyStr = body ? JSON.stringify(body) : '';
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Timestamp': timestamp.toString(),
      'X-Request-Nonce': nonce,
      'X-Organization-Id': this.config.organizationId
    };

    if (this.config.deviceId) {
      headers['X-Device-Id'] = this.config.deviceId;
      // Generate HMAC signature
      const secret = this.config.deviceToken || 'default-secret';
      const sig = crypto
        .createHmac('sha256', secret)
        .update(`${this.config.deviceId}:${bodyStr}:${timestamp.toString()}:${nonce}`)
        .digest('hex');
      headers['X-Device-Signature'] = sig;
    }

    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' ? bodyStr : undefined,
        signal: AbortSignal.timeout(10000)
      });

      this.updateState('CONNECTED');
      const json = await response.json() as any;
      return json;
    } catch (err: any) {
      this.updateState('DISCONNECTED');
      this.logger.error(`LAN Request failed on ${method} ${pathname}: ${err.message}`);
      return {
        success: false,
        error: {
          code: 'LAN_CONNECTION_LOST',
          message: `Could not reach LAN Server at ${this.config.serverUrl}. Please check local network.`
        }
      };
    }
  }

  // --- Convenience helper methods ---
  public async login(credentials: { username: string; password: string; organizationCode?: string }): Promise<any> {
    return this.request('POST', '/api/v1/auth/login', credentials);
  }

  public async getSessionUser(sessionToken: string): Promise<SessionUser | null> {
    const res = await this.request('GET', '/api/v1/auth/me', undefined, sessionToken);
    return res.success ? (res.data as SessionUser) : null;
  }

  public async searchPatients(query: string, sessionToken: string): Promise<any> {
    return this.request('GET', `/api/v1/patients?q=${encodeURIComponent(query)}`, undefined, sessionToken);
  }

  public async registerPatient(data: any, sessionToken: string): Promise<any> {
    return this.request('POST', '/api/v1/patients', data, sessionToken);
  }

  public async createPrescription(data: any, sessionToken: string): Promise<any> {
    return this.request('POST', '/api/v1/prescriptions', data, sessionToken);
  }

  public async createSale(saleData: any, sessionToken: string): Promise<any> {
    return this.request('POST', '/api/v1/sales', saleData, sessionToken);
  }

  private updateState(newState: LanConnectionState): void {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(newState);
      }
    }
  }
}
