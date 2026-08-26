import crypto from 'crypto';
import {
  Supplier,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  ISupplierRepository,
  SupplierNotFoundError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface SupplierRow {
  id: string;
  organization_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  drug_license_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export class SqliteSupplierRepository implements ISupplierRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: SupplierRow): Supplier {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      contactPerson: row.contact_person ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      gstin: row.gstin ?? undefined,
      drugLicenseNumber: row.drug_license_number ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      state: row.state ?? undefined,
      pincode: row.pincode ?? undefined,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async create(dto: CreateSupplierDTO): Promise<Supplier> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO suppliers (
        id, organization_id, name, contact_person, phone, email,
        gstin, drug_license_number, address, city, state, pincode,
        is_active, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.name.trim(),
      dto.contactPerson?.trim() ?? null,
      dto.phone?.trim() ?? null,
      dto.email?.trim() ?? null,
      dto.gstin?.trim() ?? null,
      dto.drugLicenseNumber?.trim() ?? null,
      dto.address?.trim() ?? null,
      dto.city?.trim() ?? null,
      dto.state?.trim() ?? null,
      dto.pincode?.trim() ?? null,
      dto.createdBy ?? null,
      dto.createdBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created supplier ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Supplier | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM suppliers WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as SupplierRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async search(organizationId: string, query: string, limit = 20): Promise<Supplier[]> {
    const raw = this.db.getRawDb();
    const term = `%${query.trim()}%`;

    const rows = raw.prepare(`
      SELECT * FROM suppliers
      WHERE organization_id = ?
        AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR gstin LIKE ?)
        AND is_active = 1
      ORDER BY name ASC
      LIMIT ?
    `).all(organizationId, term, term, term, term, limit) as SupplierRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: UpdateSupplierDTO): Promise<Supplier> {
    const raw = this.db.getRawDb();
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new SupplierNotFoundError(id);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.name !== undefined) {
      updates.push('name = ?');
      values.push(dto.name.trim());
    }
    if (dto.contactPerson !== undefined) {
      updates.push('contact_person = ?');
      values.push(dto.contactPerson?.trim() ?? null);
    }
    if (dto.phone !== undefined) {
      updates.push('phone = ?');
      values.push(dto.phone?.trim() ?? null);
    }
    if (dto.email !== undefined) {
      updates.push('email = ?');
      values.push(dto.email?.trim() ?? null);
    }
    if (dto.gstin !== undefined) {
      updates.push('gstin = ?');
      values.push(dto.gstin?.trim() ?? null);
    }
    if (dto.drugLicenseNumber !== undefined) {
      updates.push('drug_license_number = ?');
      values.push(dto.drugLicenseNumber?.trim() ?? null);
    }
    if (dto.address !== undefined) {
      updates.push('address = ?');
      values.push(dto.address?.trim() ?? null);
    }
    if (dto.city !== undefined) {
      updates.push('city = ?');
      values.push(dto.city?.trim() ?? null);
    }
    if (dto.state !== undefined) {
      updates.push('state = ?');
      values.push(dto.state?.trim() ?? null);
    }
    if (dto.pincode !== undefined) {
      updates.push('pincode = ?');
      values.push(dto.pincode?.trim() ?? null);
    }
    if (dto.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(dto.isActive ? 1 : 0);
    }
    if (dto.updatedBy !== undefined) {
      updates.push('updated_by = ?');
      values.push(dto.updatedBy);
    }

    updates.push("updated_at = datetime('now')");

    if (updates.length > 1) {
      values.push(id, organizationId);
      raw.prepare(`
        UPDATE suppliers SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?
      `).run(...values);
    }

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async list(organizationId: string, limit = 50, offset = 0): Promise<Supplier[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM suppliers
      WHERE organization_id = ?
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `).all(organizationId, limit, offset) as SupplierRow[];

    return rows.map((r) => this.mapRow(r));
  }
}
