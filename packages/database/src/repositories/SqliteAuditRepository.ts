import crypto from 'crypto';
import {
  AuditEvent,
  CreateAuditEventDTO,
  IAuditRepository,
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface AuditRow {
  id: string;
  action: string;
  actor_id: string;
  actor_username: string;
  actor_role: string | null;
  actor_ip: string | null;
  target: string | null;
  result: string;
  reason: string | null;
  metadata: string | null;
  timestamp: string;
}

export class SqliteAuditRepository implements IAuditRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: AuditRow): AuditEvent {
    let parsedMeta: Record<string, unknown> | undefined;
    if (row.metadata) {
      try {
        parsedMeta = JSON.parse(row.metadata);
      } catch {
        parsedMeta = undefined;
      }
    }

    return {
      id: row.id,
      action: row.action as AuditAction,
      actor: {
        id: row.actor_id,
        username: row.actor_username,
        role: row.actor_role ?? undefined,
        ipAddress: row.actor_ip ?? undefined
      },
      target: row.target ?? undefined,
      resource: row.target ?? undefined,
      result: row.result as AuditResult,
      reason: row.reason ?? undefined,
      metadata: parsedMeta,
      timestamp: new Date(row.timestamp)
    };
  }

  public async insert(dto: CreateAuditEventDTO): Promise<AuditEvent> {
    const raw = this.db.getRawDb();
    const id = dto.id || crypto.randomUUID();
    const timestamp = (dto.timestamp || new Date()).toISOString();
    const targetOrResource = dto.target ?? dto.resource ?? null;

    raw.prepare(`
      INSERT INTO audit_events (
        id, action, actor_id, actor_username, actor_role, actor_ip,
        target, result, reason, metadata, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.action,
      dto.actor.id || 'anonymous',
      dto.actor.username || 'Anonymous',
      dto.actor.role ?? null,
      dto.actor.ipAddress ?? null,
      targetOrResource,
      dto.result,
      dto.reason ?? null,
      dto.metadata ? JSON.stringify(dto.metadata) : null,
      timestamp
    );

    return {
      id,
      action: dto.action,
      actor: dto.actor,
      target: targetOrResource ?? undefined,
      resource: targetOrResource ?? undefined,
      result: dto.result,
      reason: dto.reason,
      metadata: dto.metadata,
      timestamp: new Date(timestamp)
    };
  }

  public async listRecent(limit = 50): Promise<AuditEvent[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM audit_events
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as AuditRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async count(): Promise<number> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT COUNT(*) as count FROM audit_events').get() as { count: number };
    return row.count;
  }
}
