import crypto from 'crypto';
import {
  Medicine,
  ScheduleCategory,
  CreateMedicineDTO,
  UpdateMedicineDTO,
  Manufacturer,
  CreateManufacturerDTO,
  IMedicineRepository,
  MedicineNotFoundError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface MedicineRow {
  id: string;
  organization_id: string;
  generic_name: string;
  therapeutic_class: string | null;
  is_prescription_required: number;
  schedule_category: string;
  storage_instructions: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

interface ManufacturerRow {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  country: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export class SqliteMedicineRepository implements IMedicineRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapMedicineRow(row: MedicineRow): Medicine {
    return {
      id: row.id,
      organizationId: row.organization_id,
      genericName: row.generic_name,
      therapeuticClass: row.therapeutic_class ?? undefined,
      isPrescriptionRequired: row.is_prescription_required === 1,
      scheduleCategory: row.schedule_category as ScheduleCategory,
      storageInstructions: row.storage_instructions ?? undefined,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined
    };
  }

  private mapManufacturerRow(row: ManufacturerRow): Manufacturer {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      code: row.code ?? undefined,
      country: row.country,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined
    };
  }

  public async create(dto: CreateMedicineDTO): Promise<Medicine> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO medicines (
        id, organization_id, generic_name, therapeutic_class,
        is_prescription_required, schedule_category, storage_instructions, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      dto.organizationId,
      dto.genericName.trim(),
      dto.therapeuticClass?.trim() ?? null,
      dto.isPrescriptionRequired ? 1 : 0,
      dto.scheduleCategory ?? 'GENERAL',
      dto.storageInstructions?.trim() ?? null,
      dto.createdBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created medicine ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Medicine | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM medicines WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as MedicineRow | undefined;

    return row ? this.mapMedicineRow(row) : null;
  }

  public async search(organizationId: string, query: string, limit = 20): Promise<Medicine[]> {
    const raw = this.db.getRawDb();
    const term = `%${query.trim()}%`;
    const rows = raw.prepare(`
      SELECT * FROM medicines
      WHERE organization_id = ?
        AND (generic_name LIKE ? OR therapeutic_class LIKE ?)
        AND is_active = 1
      ORDER BY generic_name ASC
      LIMIT ?
    `).all(organizationId, term, term, limit) as MedicineRow[];

    return rows.map((r) => this.mapMedicineRow(r));
  }

  public async update(id: string, organizationId: string, dto: UpdateMedicineDTO): Promise<Medicine> {
    const raw = this.db.getRawDb();
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new MedicineNotFoundError(id);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.genericName !== undefined) {
      updates.push('generic_name = ?');
      values.push(dto.genericName.trim());
    }
    if (dto.therapeuticClass !== undefined) {
      updates.push('therapeutic_class = ?');
      values.push(dto.therapeuticClass?.trim() ?? null);
    }
    if (dto.isPrescriptionRequired !== undefined) {
      updates.push('is_prescription_required = ?');
      values.push(dto.isPrescriptionRequired ? 1 : 0);
    }
    if (dto.scheduleCategory !== undefined) {
      updates.push('schedule_category = ?');
      values.push(dto.scheduleCategory);
    }
    if (dto.storageInstructions !== undefined) {
      updates.push('storage_instructions = ?');
      values.push(dto.storageInstructions?.trim() ?? null);
    }
    if (dto.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(dto.isActive ? 1 : 0);
    }

    updates.push("updated_at = datetime('now')");

    if (updates.length > 1) {
      values.push(id, organizationId);
      raw.prepare(`
        UPDATE medicines SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?
      `).run(...values);
    }

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async list(organizationId: string, limit = 50, offset = 0): Promise<Medicine[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM medicines
      WHERE organization_id = ?
      ORDER BY generic_name ASC
      LIMIT ? OFFSET ?
    `).all(organizationId, limit, offset) as MedicineRow[];

    return rows.map((r) => this.mapMedicineRow(r));
  }

  // Manufacturer sub-methods
  public async createManufacturer(dto: CreateManufacturerDTO): Promise<Manufacturer> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO manufacturers (
        id, organization_id, name, code, country, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      dto.organizationId,
      dto.name.trim(),
      dto.code?.trim() ?? null,
      dto.country ?? 'India',
      dto.createdBy ?? null
    );

    const m = await this.findManufacturerById(id, dto.organizationId);
    return m!;
  }

  public async findManufacturerById(id: string, organizationId: string): Promise<Manufacturer | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM manufacturers WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as ManufacturerRow | undefined;

    return row ? this.mapManufacturerRow(row) : null;
  }

  public async listManufacturers(organizationId: string): Promise<Manufacturer[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM manufacturers WHERE organization_id = ? ORDER BY name ASC
    `).all(organizationId) as ManufacturerRow[];

    return rows.map((r) => this.mapManufacturerRow(r));
  }
}
