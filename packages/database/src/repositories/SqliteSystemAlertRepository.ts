import {
  SystemAlert,
  CreateSystemAlertDTO,
  ISystemAlertRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';
import crypto from 'crypto';

export class SqliteSystemAlertRepository implements ISystemAlertRepository {
  constructor(private db: SqliteDatabase) {}

  async createOrUpdate(dto: CreateSystemAlertDTO): Promise<SystemAlert> {
    const raw = this.db.getRawDb();
    const id = dto.id || crypto.randomUUID();
    const dedupKey =
      dto.dedupKey ||
      crypto
        .createHash('sha256')
        .update(
          `${dto.organizationId}:${dto.alertType}:${dto.entityType || ''}:${dto.entityId || ''}:${new Date().toISOString().slice(0, 10)}`
        )
        .digest('hex');

    const existing = await this.findByDedupKey(dto.organizationId, dedupKey);
    if (existing) {
      // If alert exists and is active or snoozed, touch updated_at and refresh message/severity
      raw.prepare(
        `UPDATE system_alerts SET
          severity = ?,
          title = ?,
          message = ?,
          metadata_json = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
      ).run(
        dto.severity,
        dto.title,
        dto.message,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        existing.id
      );
      const updated = await this.findById(existing.id);
      return updated!;
    }

    raw.prepare(
      `INSERT INTO system_alerts (
        id, organization_id, alert_type, category, severity, title, message,
        entity_type, entity_id, dedup_key, status, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`
    ).run(
      id,
      dto.organizationId,
      dto.alertType,
      dto.category,
      dto.severity,
      dto.title,
      dto.message,
      dto.entityType || null,
      dto.entityId || null,
      dedupKey,
      dto.metadata ? JSON.stringify(dto.metadata) : null
    );

    const created = await this.findById(id);
    if (!created) throw new Error(`Failed to create alert ${id}`);
    return created;
  }

  async findById(id: string): Promise<SystemAlert | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`SELECT * FROM system_alerts WHERE id = ?`).get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  async findByDedupKey(organizationId: string, dedupKey: string): Promise<SystemAlert | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(
      `SELECT * FROM system_alerts WHERE organization_id = ? AND dedup_key = ?`
    ).get(organizationId, dedupKey) as any;
    return row ? this.mapRow(row) : null;
  }

  async findActive(organizationId: string, limit: number = 100): Promise<SystemAlert[]> {
    const raw = this.db.getRawDb();
    const now = new Date().toISOString();
    const rows = raw.prepare(
      `SELECT * FROM system_alerts
       WHERE organization_id = ?
         AND status IN ('ACTIVE', 'ACKNOWLEDGED')
         AND (snooze_until IS NULL OR snooze_until <= ?)
       ORDER BY
         CASE severity
           WHEN 'MANDATORY_SAFETY' THEN 1
           WHEN 'CRITICAL' THEN 2
           WHEN 'WARNING' THEN 3
           WHEN 'INFO' THEN 4
           ELSE 5
         END,
         created_at DESC
       LIMIT ?`
    ).all(organizationId, now, limit) as any[];
    return rows.map((r: any) => this.mapRow(r));
  }

  async findByCategory(organizationId: string, category: string): Promise<SystemAlert[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(
      `SELECT * FROM system_alerts WHERE organization_id = ? AND category = ? ORDER BY created_at DESC`
    ).all(organizationId, category) as any[];
    return rows.map((r: any) => this.mapRow(r));
  }

  async acknowledge(id: string, userId: string, snoozeHours: number = 24): Promise<SystemAlert> {
    const raw = this.db.getRawDb();
    const snoozeUntil = new Date(Date.now() + snoozeHours * 60 * 60 * 1000).toISOString();
    raw.prepare(
      `UPDATE system_alerts SET
        status = 'ACKNOWLEDGED',
        acknowledged_by = ?,
        acknowledged_at = CURRENT_TIMESTAMP,
        snooze_until = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    ).run(userId, snoozeUntil, id);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Alert ${id} not found after acknowledge`);
    return updated;
  }

  async resolve(id: string): Promise<SystemAlert> {
    const raw = this.db.getRawDb();
    raw.prepare(
      `UPDATE system_alerts SET
        status = 'RESOLVED',
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    ).run(id);
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Alert ${id} not found after resolve`);
    return updated;
  }

  async resolveByDedupKey(organizationId: string, dedupKey: string): Promise<boolean> {
    const raw = this.db.getRawDb();
    const result = raw.prepare(
      `UPDATE system_alerts SET
        status = 'RESOLVED',
        resolved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ? AND dedup_key = ? AND status != 'RESOLVED'`
    ).run(organizationId, dedupKey);
    return result.changes > 0;
  }

  async purgeOldResolved(organizationId: string, olderThanDays: number = 30): Promise<number> {
    const raw = this.db.getRawDb();
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    const result = raw.prepare(
      `DELETE FROM system_alerts WHERE organization_id = ? AND status = 'RESOLVED' AND resolved_at <= ?`
    ).run(organizationId, cutoff);
    return result.changes;
  }

  private mapRow(row: any): SystemAlert {
    return {
      id: row.id,
      organizationId: row.organization_id,
      alertType: row.alert_type,
      category: row.category,
      severity: row.severity,
      title: row.title,
      message: row.message,
      entityType: row.entity_type || undefined,
      entityId: row.entity_id || undefined,
      dedupKey: row.dedup_key,
      status: row.status,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      acknowledgedBy: row.acknowledged_by || undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      snoozeUntil: row.snooze_until ? new Date(row.snooze_until) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
