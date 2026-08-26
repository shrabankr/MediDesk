import {
  AlertConfiguration,
  UpdateAlertConfigurationDTO,
  IAlertConfigRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';
import crypto from 'crypto';

export class SqliteAlertConfigRepository implements IAlertConfigRepository {
  constructor(private db: SqliteDatabase) {}

  async findByOrg(organizationId: string): Promise<AlertConfiguration[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`SELECT * FROM alert_configurations WHERE organization_id = ?`).all(organizationId) as any[];
    return rows.map((r: any) => this.mapRow(r));
  }

  async findByType(organizationId: string, alertType: string): Promise<AlertConfiguration | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`SELECT * FROM alert_configurations WHERE organization_id = ? AND alert_type = ?`).get(organizationId, alertType) as any;
    return row ? this.mapRow(row) : null;
  }

  async upsert(
    organizationId: string,
    alertType: string,
    dto: UpdateAlertConfigurationDTO
  ): Promise<AlertConfiguration> {
    const raw = this.db.getRawDb();
    const existing = await this.findByType(organizationId, alertType);

    if (existing) {
      const fields: string[] = [];
      const params: any[] = [];

      if (dto.isEnabled !== undefined) {
        fields.push(`is_enabled = ?`);
        params.push(dto.isEnabled ? 1 : 0);
      }
      if (dto.thresholdValueInteger !== undefined) {
        fields.push(`threshold_value_integer = ?`);
        params.push(dto.thresholdValueInteger);
      }
      if (dto.warningLevel !== undefined) {
        fields.push(`warning_level = ?`);
        params.push(dto.warningLevel);
      }
      if (dto.targetRoles !== undefined) {
        fields.push(`target_roles = ?`);
        params.push(JSON.stringify(dto.targetRoles));
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(existing.id);

      raw.prepare(`UPDATE alert_configurations SET ${fields.join(', ')} WHERE id = ?`).run(...params);

      const updated = await this.findByType(organizationId, alertType);
      return updated!;
    } else {
      const id = crypto.randomUUID();
      raw.prepare(
        `INSERT INTO alert_configurations (
          id, organization_id, alert_type, is_enabled, threshold_value_integer,
          warning_level, target_roles
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        organizationId,
        alertType,
        dto.isEnabled !== false ? 1 : 0,
        dto.thresholdValueInteger || null,
        dto.warningLevel || 'WARNING',
        JSON.stringify(dto.targetRoles || ['OWNER', 'STAFF'])
      );
      const created = await this.findByType(organizationId, alertType);
      return created!;
    }
  }

  private mapRow(row: any): AlertConfiguration {
    return {
      id: row.id,
      organizationId: row.organization_id,
      alertType: row.alert_type,
      isEnabled: row.is_enabled === 1,
      thresholdValueInteger: row.threshold_value_integer !== null ? row.threshold_value_integer : undefined,
      warningLevel: row.warning_level,
      targetRoles: row.target_roles ? JSON.parse(row.target_roles) : ['OWNER'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
