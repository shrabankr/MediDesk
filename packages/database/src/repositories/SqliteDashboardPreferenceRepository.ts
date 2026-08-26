import {
  UserDashboardPreference,
  SaveDashboardPreferenceDTO,
  IDashboardPreferenceRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';
import crypto from 'crypto';

export class SqliteDashboardPreferenceRepository implements IDashboardPreferenceRepository {
  constructor(private db: SqliteDatabase) {}

  async findByUser(userId: string): Promise<UserDashboardPreference | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`SELECT * FROM user_dashboard_preferences WHERE user_id = ?`).get(userId) as any;
    return row ? this.mapRow(row) : null;
  }

  async save(dto: SaveDashboardPreferenceDTO): Promise<UserDashboardPreference> {
    const raw = this.db.getRawDb();
    const existing = await this.findByUser(dto.userId);

    if (existing) {
      raw.prepare(
        `UPDATE user_dashboard_preferences SET
          widget_layout_json = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`
      ).run(JSON.stringify(dto.widgetLayout), dto.userId);
    } else {
      const id = crypto.randomUUID();
      raw.prepare(
        `INSERT INTO user_dashboard_preferences (
          id, user_id, organization_id, widget_layout_json
        ) VALUES (?, ?, ?, ?)`
      ).run(id, dto.userId, dto.organizationId, JSON.stringify(dto.widgetLayout));
    }

    const saved = await this.findByUser(dto.userId);
    if (!saved) throw new Error(`Failed to save dashboard preference for user ${dto.userId}`);
    return saved;
  }

  private mapRow(row: any): UserDashboardPreference {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      widgetLayout: row.widget_layout_json ? JSON.parse(row.widget_layout_json) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
