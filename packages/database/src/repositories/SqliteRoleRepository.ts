import {
  Role,
  RoleName,
  PermissionCode,
  IRoleRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  is_system: number;
  created_at: string;
  updated_at: string;
}

export class SqliteRoleRepository implements IRoleRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: RoleRow): Role {
    return {
      id: row.id,
      name: row.name as RoleName,
      description: row.description,
      isSystem: Boolean(row.is_system),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  public async findByName(name: RoleName): Promise<Role | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM roles WHERE name = ?').get(name) as RoleRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async listAll(): Promise<Role[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare('SELECT * FROM roles ORDER BY name ASC').all() as RoleRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async getUserRoles(userId: string): Promise<RoleName[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT r.name
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(userId) as Array<{ name: string }>;
    return rows.map((r) => r.name as RoleName);
  }

  public async assignRoleToUser(userId: string, roleName: RoleName): Promise<void> {
    const raw = this.db.getRawDb();
    const role = await this.findByName(roleName);
    if (!role) throw new Error(`Role ${roleName} not found`);

    raw.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `).run(userId, role.id);
  }

  public async removeRoleFromUser(userId: string, roleName: RoleName): Promise<void> {
    const raw = this.db.getRawDb();
    const role = await this.findByName(roleName);
    if (!role) return;

    raw.prepare(`
      DELETE FROM user_roles
      WHERE user_id = ? AND role_id = ?
    `).run(userId, role.id);
  }

  public async getPermissionsForRole(roleName: RoleName): Promise<PermissionCode[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      INNER JOIN roles r ON r.id = rp.role_id
      WHERE r.name = ?
    `).all(roleName) as Array<{ code: string }>;
    return rows.map((r) => r.code as PermissionCode);
  }

  public async getPermissionsForUser(userId: string): Promise<PermissionCode[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON rp.permission_id = p.id
      INNER JOIN user_roles ur ON ur.role_id = rp.role_id
      WHERE ur.user_id = ?
    `).all(userId) as Array<{ code: string }>;
    return rows.map((r) => r.code as PermissionCode);
  }
}
