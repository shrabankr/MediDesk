import crypto from 'crypto';
import { User, CreateUserDTO, IUserRepository, RoleName } from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface UserRow {
  id: string;
  organization_id: string;
  username: string;
  email: string;
  full_name: string;
  password_hash: string;
  is_active: number;
  is_locked: number;
  failed_login_attempts: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteUserRepository implements IUserRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: UserRow, roles: RoleName[]): User {
    return {
      id: row.id,
      organizationId: row.organization_id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      passwordHash: row.password_hash,
      isActive: Boolean(row.is_active),
      isLocked: Boolean(row.is_locked),
      failedLoginAttempts: row.failed_login_attempts,
      roles,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private getUserRoles(userId: string): RoleName[] {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT r.name
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(userId) as Array<{ name: string }>;
    return rows.map((r) => r.name as RoleName);
  }

  public async findById(id: string): Promise<User | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    if (!row) return null;
    const roles = this.getUserRoles(row.id);
    return this.mapRow(row, roles);
  }

  public async findByUsername(username: string): Promise<User | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as UserRow | undefined;
    if (!row) return null;
    const roles = this.getUserRoles(row.id);
    return this.mapRow(row, roles);
  }

  public async findByEmail(email: string): Promise<User | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as UserRow | undefined;
    if (!row) return null;
    const roles = this.getUserRoles(row.id);
    return this.mapRow(row, roles);
  }

  public async listByOrganization(organizationId: string): Promise<User[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare('SELECT * FROM users WHERE organization_id = ? ORDER BY created_at ASC').all(organizationId) as UserRow[];
    return rows.map((row) => this.mapRow(row, this.getUserRoles(row.id)));
  }

  public async create(dto: CreateUserDTO): Promise<User> {
    const id = dto.id || crypto.randomUUID();
    const now = new Date().toISOString();

    return this.db.transaction(() => {
      const raw = this.db.getRawDb();

      raw.prepare(`
        INSERT INTO users (id, organization_id, username, email, full_name, password_hash, is_active, is_locked, failed_login_attempts, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)
      `).run(
        id,
        dto.organizationId,
        dto.username,
        dto.email,
        dto.fullName,
        dto.passwordHash,
        now,
        now
      );

      for (const roleName of dto.roles) {
        const role = raw.prepare('SELECT id FROM roles WHERE name = ?').get(roleName) as { id: string } | undefined;
        if (role) {
          raw.prepare(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES (?, ?)
          `).run(id, role.id);
        }
      }

      const created = this.mapRow(
        raw.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow,
        dto.roles
      );
      return created;
    });
  }

  public async update(id: string, partial: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    const raw = this.db.getRawDb();
    const updates: string[] = [];
    const params: unknown[] = [];

    if (partial.username !== undefined) { updates.push('username = ?'); params.push(partial.username); }
    if (partial.email !== undefined) { updates.push('email = ?'); params.push(partial.email); }
    if (partial.fullName !== undefined) { updates.push('full_name = ?'); params.push(partial.fullName); }
    if (partial.isActive !== undefined) { updates.push('is_active = ?'); params.push(partial.isActive ? 1 : 0); }
    if (partial.isLocked !== undefined) { updates.push('is_locked = ?'); params.push(partial.isLocked ? 1 : 0); }
    if (partial.failedLoginAttempts !== undefined) { updates.push('failed_login_attempts = ?'); params.push(partial.failedLoginAttempts); }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    raw.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const user = await this.findById(id);
    if (!user) throw new Error(`User ${id} not found after update`);
    return user;
  }

  public async updatePassword(id: string, passwordHash: string): Promise<void> {
    const raw = this.db.getRawDb();
    raw.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      new Date().toISOString(),
      id
    );
  }

  public async updateLastLogin(id: string, date: Date): Promise<void> {
    const raw = this.db.getRawDb();
    raw.prepare('UPDATE users SET last_login_at = ?, failed_login_attempts = 0, updated_at = ? WHERE id = ?').run(
      date.toISOString(),
      new Date().toISOString(),
      id
    );
  }

  public async recordFailedLogin(id: string): Promise<number> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(id) as { failed_login_attempts: number } | undefined;
    if (!row) return 0;
    const newCount = row.failed_login_attempts + 1;
    const isLocked = newCount >= 5 ? 1 : 0;
    raw.prepare('UPDATE users SET failed_login_attempts = ?, is_locked = ?, updated_at = ? WHERE id = ?').run(
      newCount,
      isLocked,
      new Date().toISOString(),
      id
    );
    return newCount;
  }

  public async resetFailedLogins(id: string): Promise<void> {
    const raw = this.db.getRawDb();
    raw.prepare('UPDATE users SET failed_login_attempts = 0, is_locked = 0, updated_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      id
    );
  }

  public async count(): Promise<number> {
    const raw = this.db.getRawDb();
    try {
      const row = raw.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number } | undefined;
      return row ? row.count : 0;
    } catch (error: any) {
      if (error?.message?.includes('no such table')) {
        return 0;
      }
      throw error;
    }
  }
}
