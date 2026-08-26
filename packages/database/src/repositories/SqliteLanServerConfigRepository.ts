import { SqliteDatabase } from '../SqliteDatabase.js';
import {
  LanServerConfig,
  UpdateLanServerConfigDTO,
  LanPairingPin,
  ILanServerConfigRepository
} from '@medidesk/domain';

interface LanServerConfigRow {
  organization_id: string;
  operating_mode: string;
  server_port: number;
  server_hostname: string | null;
  tls_certificate: string | null;
  tls_private_key_enc: string | null;
  server_fingerprint: string | null;
  max_clients: number;
  auto_discovery_enabled: number;
  created_at: string;
  updated_at: string;
}

interface LanPairingPinRow {
  id: string;
  organization_id: string;
  pin_code: string;
  expires_at: string;
  is_used: number;
  created_by: string;
  created_at: string;
}

export class SqliteLanServerConfigRepository implements ILanServerConfigRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async getConfig(organizationId: string): Promise<LanServerConfig> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM lan_server_config WHERE organization_id = ?
    `).get(organizationId) as LanServerConfigRow | undefined;

    if (!row) {
      const now = new Date().toISOString();
      const defaults: LanServerConfig = {
        organizationId,
        operatingMode: 'SINGLE_PC',
        serverPort: 4848,
        serverHostname: '0.0.0.0',
        maxClients: 10,
        autoDiscoveryEnabled: true,
        createdAt: new Date(now),
        updatedAt: new Date(now)
      };

      try {
        this.db.getRawDb().prepare(`
          INSERT INTO lan_server_config (
            organization_id, operating_mode, server_port, server_hostname,
            max_clients, auto_discovery_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          organizationId,
          defaults.operatingMode,
          defaults.serverPort,
          defaults.serverHostname ?? '0.0.0.0',
          defaults.maxClients,
          defaults.autoDiscoveryEnabled ? 1 : 0,
          now,
          now
        );
      } catch { /* ignore fallback */ }

      return defaults;
    }

    return this.mapConfigRow(row);
  }

  public async saveConfig(organizationId: string, dto: UpdateLanServerConfigDTO): Promise<LanServerConfig> {
    const current = await this.getConfig(organizationId);
    const now = new Date().toISOString();

    const operatingMode = dto.operatingMode ?? current.operatingMode;
    const serverPort = dto.serverPort ?? current.serverPort;
    const serverHostname = dto.serverHostname !== undefined ? dto.serverHostname : current.serverHostname;
    const tlsCertificate = dto.tlsCertificate !== undefined ? dto.tlsCertificate : current.tlsCertificate;
    const tlsPrivateKeyEnc = dto.tlsPrivateKeyEnc !== undefined ? dto.tlsPrivateKeyEnc : current.tlsPrivateKeyEnc;
    const serverFingerprint = dto.serverFingerprint !== undefined ? dto.serverFingerprint : current.serverFingerprint;
    const maxClients = dto.maxClients ?? current.maxClients;
    const autoDiscoveryEnabled = dto.autoDiscoveryEnabled !== undefined
      ? (dto.autoDiscoveryEnabled ? 1 : 0)
      : (current.autoDiscoveryEnabled ? 1 : 0);

    this.db.getRawDb().prepare(`
      INSERT INTO lan_server_config (
        organization_id, operating_mode, server_port, server_hostname,
        tls_certificate, tls_private_key_enc, server_fingerprint,
        max_clients, auto_discovery_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        operating_mode = excluded.operating_mode,
        server_port = excluded.server_port,
        server_hostname = excluded.server_hostname,
        tls_certificate = excluded.tls_certificate,
        tls_private_key_enc = excluded.tls_private_key_enc,
        server_fingerprint = excluded.server_fingerprint,
        max_clients = excluded.max_clients,
        auto_discovery_enabled = excluded.auto_discovery_enabled,
        updated_at = excluded.updated_at
    `).run(
      organizationId,
      operatingMode,
      serverPort,
      serverHostname ?? null,
      tlsCertificate ?? null,
      tlsPrivateKeyEnc ?? null,
      serverFingerprint ?? null,
      maxClients,
      autoDiscoveryEnabled,
      now,
      now
    );

    return this.getConfig(organizationId);
  }

  public async createPairingPin(
    organizationId: string,
    pinCode: string,
    expiresAt: Date,
    createdBy: string
  ): Promise<LanPairingPin> {
    const id = `pin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    // Expire/invalidate any prior unused pins for this org
    this.db.getRawDb().prepare(`
      UPDATE lan_pairing_pins SET is_used = 1 WHERE organization_id = ? AND is_used = 0
    `).run(organizationId);

    this.db.getRawDb().prepare(`
      INSERT INTO lan_pairing_pins (
        id, organization_id, pin_code, expires_at, is_used, created_by, created_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, organizationId, pinCode, expiresAt.toISOString(), createdBy, now);

    return {
      id,
      organizationId,
      pinCode,
      expiresAt,
      isUsed: false,
      createdBy,
      createdAt: new Date(now)
    };
  }

  public async getActivePairingPin(organizationId: string, pinCode: string): Promise<LanPairingPin | null> {
    const now = new Date().toISOString();
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM lan_pairing_pins
      WHERE organization_id = ? AND pin_code = ? AND is_used = 0 AND expires_at > ?
    `).get(organizationId, pinCode, now) as LanPairingPinRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      pinCode: row.pin_code,
      expiresAt: new Date(row.expires_at),
      isUsed: Boolean(row.is_used),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at)
    };
  }

  public async consumePairingPin(id: string): Promise<void> {
    this.db.getRawDb().prepare(`
      UPDATE lan_pairing_pins SET is_used = 1 WHERE id = ?
    `).run(id);
  }

  private mapConfigRow(row: LanServerConfigRow): LanServerConfig {
    return {
      organizationId: row.organization_id,
      operatingMode: row.operating_mode as any,
      serverPort: row.server_port,
      serverHostname: row.server_hostname ?? undefined,
      tlsCertificate: row.tls_certificate ?? undefined,
      tlsPrivateKeyEnc: row.tls_private_key_enc ?? undefined,
      serverFingerprint: row.server_fingerprint ?? undefined,
      maxClients: row.max_clients,
      autoDiscoveryEnabled: Boolean(row.auto_discovery_enabled),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
