import {
  Permission,
  PermissionCode,
  IPermissionRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface PermissionRow {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
}

export class SqlitePermissionRepository implements IPermissionRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: PermissionRow): Permission {
    return {
      id: row.id,
      code: row.code as PermissionCode,
      name: row.name,
      category: row.category,
      description: row.description
    };
  }

  public async findByCode(code: PermissionCode): Promise<Permission | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM permissions WHERE code = ?').get(code) as PermissionRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async listAll(): Promise<Permission[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare('SELECT * FROM permissions ORDER BY category ASC, code ASC').all() as PermissionRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      VALUES (?, ?)
    `).run(roleId, permissionId);
  }
}
