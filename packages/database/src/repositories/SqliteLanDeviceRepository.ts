import { SqliteDatabase } from '../SqliteDatabase.js';
import {
  LanDevice,
  CreateLanDeviceDTO,
  UpdateLanDeviceDTO,
  DeviceStatus,
  ILanDeviceRepository
} from '@medidesk/domain';

interface LanDeviceRow {
  id: string;
  organization_id: string;
  device_name: string;
  device_fingerprint: string;
  device_role: string;
  ip_address: string | null;
  mac_address: string | null;
  public_key: string | null;
  device_token_enc: string | null;
  status: string;
  last_seen_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteLanDeviceRepository implements ILanDeviceRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async create(dto: CreateLanDeviceDTO): Promise<LanDevice> {
    const id = dto.id || `dev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const role = dto.deviceRole || 'GENERAL_CLIENT';
    const status = dto.status || 'PENDING_APPROVAL';

    this.db.getRawDb().prepare(`
      INSERT INTO lan_devices (
        id, organization_id, device_name, device_fingerprint, device_role,
        ip_address, mac_address, public_key, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.deviceName,
      dto.deviceFingerprint,
      role,
      dto.ipAddress ?? null,
      dto.macAddress ?? null,
      dto.publicKey ?? null,
      status,
      now,
      now
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error('Failed to create LAN device record');
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<LanDevice | null> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM lan_devices WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as LanDeviceRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByFingerprint(fingerprint: string, organizationId: string): Promise<LanDevice | null> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM lan_devices WHERE device_fingerprint = ? AND organization_id = ?
    `).get(fingerprint, organizationId) as LanDeviceRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async listByOrg(organizationId: string, limit = 100): Promise<LanDevice[]> {
    const rows = this.db.getRawDb().prepare(`
      SELECT * FROM lan_devices
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(organizationId, limit) as LanDeviceRow[];

    return rows.map(r => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: UpdateLanDeviceDTO): Promise<LanDevice> {
    const current = await this.findById(id, organizationId);
    if (!current) {
      throw new Error(`Device not found with id: ${id}`);
    }

    const now = new Date().toISOString();
    const deviceName = dto.deviceName ?? current.deviceName;
    const deviceRole = dto.deviceRole ?? current.deviceRole;
    const ipAddress = dto.ipAddress !== undefined ? dto.ipAddress : current.ipAddress;
    const deviceTokenEnc = dto.deviceTokenEnc !== undefined ? dto.deviceTokenEnc : current.deviceTokenEnc;
    const status = dto.status ?? current.status;
    const lastSeenAt = dto.lastSeenAt ? dto.lastSeenAt.toISOString() : (current.lastSeenAt ? current.lastSeenAt.toISOString() : null);
    const approvedBy = dto.approvedBy !== undefined ? dto.approvedBy : current.approvedBy;
    const approvedAt = dto.approvedAt ? dto.approvedAt.toISOString() : (current.approvedAt ? current.approvedAt.toISOString() : null);

    this.db.getRawDb().prepare(`
      UPDATE lan_devices SET
        device_name = ?,
        device_role = ?,
        ip_address = ?,
        device_token_enc = ?,
        status = ?,
        last_seen_at = ?,
        approved_by = ?,
        approved_at = ?,
        updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).run(
      deviceName,
      deviceRole,
      ipAddress ?? null,
      deviceTokenEnc ?? null,
      status,
      lastSeenAt,
      approvedBy ?? null,
      approvedAt,
      now,
      id,
      organizationId
    );

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async updateStatus(id: string, organizationId: string, status: DeviceStatus, approvedBy?: string): Promise<void> {
    const now = new Date().toISOString();
    const approvedAt = status === 'APPROVED' ? now : null;

    let validApprovedBy: string | null = null;
    if (approvedBy) {
      try {
        const u = this.db.getRawDb().prepare('SELECT id FROM users WHERE id = ?').get(approvedBy);
        if (u) validApprovedBy = approvedBy;
      } catch { /* ignore */ }
    }

    this.db.getRawDb().prepare(`
      UPDATE lan_devices SET
        status = ?,
        approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
        approved_at = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_at END,
        updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).run(
      status,
      status,
      validApprovedBy,
      status,
      approvedAt,
      now,
      id,
      organizationId
    );
  }

  public async updateLastSeen(id: string, organizationId: string, ipAddress?: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.getRawDb().prepare(`
      UPDATE lan_devices SET
        last_seen_at = ?,
        ip_address = COALESCE(?, ip_address),
        updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).run(now, ipAddress ?? null, now, id, organizationId);
  }

  public async delete(id: string, organizationId: string): Promise<void> {
    this.db.getRawDb().prepare(`
      DELETE FROM lan_devices WHERE id = ? AND organization_id = ?
    `).run(id, organizationId);
  }

  public async countApproved(organizationId: string): Promise<number> {
    const row = this.db.getRawDb().prepare(`
      SELECT count(*) as total FROM lan_devices WHERE organization_id = ? AND status = 'APPROVED'
    `).get(organizationId) as { total: number };
    return row.total;
  }

  private mapRow(row: LanDeviceRow): LanDevice {
    return {
      id: row.id,
      organizationId: row.organization_id,
      deviceName: row.device_name,
      deviceFingerprint: row.device_fingerprint,
      deviceRole: row.device_role as any,
      ipAddress: row.ip_address ?? undefined,
      macAddress: row.mac_address ?? undefined,
      publicKey: row.public_key ?? undefined,
      deviceTokenEnc: row.device_token_enc ?? undefined,
      status: row.status as DeviceStatus,
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : undefined,
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
