import crypto from 'crypto';
import {
  Organization,
  CreateOrganizationDTO,
  IOrganizationRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface OrgRow {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export class SqliteOrganizationRepository implements IOrganizationRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: OrgRow): Organization {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      address: row.address ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      currency: row.currency,
      timezone: row.timezone,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  public async findById(id: string): Promise<Organization | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as OrgRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async findByCode(code: string): Promise<Organization | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM organizations WHERE code = ?').get(code) as OrgRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async getFirst(): Promise<Organization | null> {
    const raw = this.db.getRawDb();
    try {
      const row = raw.prepare('SELECT * FROM organizations ORDER BY created_at ASC LIMIT 1').get() as OrgRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error: any) {
      if (error?.message?.includes('no such table')) {
        return null;
      }
      throw error;
    }
  }

  public async create(dto: CreateOrganizationDTO): Promise<Organization> {
    const raw = this.db.getRawDb();
    const id = dto.id || crypto.randomUUID();
    const now = new Date().toISOString();

    raw.prepare(`
      INSERT INTO organizations (id, name, code, address, phone, email, currency, timezone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.name,
      dto.code,
      dto.address ?? null,
      dto.phone ?? null,
      dto.email ?? null,
      dto.currency,
      dto.timezone,
      now,
      now
    );

    const created = await this.findById(id);
    if (!created) throw new Error('Failed to retrieve created organization');
    return created;
  }

  public async update(id: string, partial: Partial<Omit<Organization, 'id' | 'createdAt'>>): Promise<Organization> {
    const raw = this.db.getRawDb();
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Organization ${id} not found`);

    const updates: string[] = [];
    const params: unknown[] = [];

    if (partial.name !== undefined) { updates.push('name = ?'); params.push(partial.name); }
    if (partial.code !== undefined) { updates.push('code = ?'); params.push(partial.code); }
    if (partial.address !== undefined) { updates.push('address = ?'); params.push(partial.address); }
    if (partial.phone !== undefined) { updates.push('phone = ?'); params.push(partial.phone); }
    if (partial.email !== undefined) { updates.push('email = ?'); params.push(partial.email); }
    if (partial.currency !== undefined) { updates.push('currency = ?'); params.push(partial.currency); }
    if (partial.timezone !== undefined) { updates.push('timezone = ?'); params.push(partial.timezone); }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    raw.prepare(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Organization ${id} not found after update`);
    return updated;
  }
}
