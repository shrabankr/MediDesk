import crypto from 'crypto';
import {
  Allergy,
  RecordAllergyDTO,
  AllergyStatus,
  AllergyCategory,
  AllergySeverity,
  IAllergyRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface AllergyRow {
  id: string;
  organization_id: string;
  patient_id: string;
  status: string;
  allergen_name: string | null;
  category: string;
  severity: string;
  reaction: string | null;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export class SqliteAllergyRepository implements IAllergyRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: AllergyRow): Allergy {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      status: row.status as AllergyStatus,
      allergenName: row.allergen_name ?? undefined,
      category: row.category as AllergyCategory,
      severity: row.severity as AllergySeverity,
      reaction: row.reaction ?? undefined,
      notes: row.notes ?? undefined,
      recordedAt: new Date(row.recorded_at),
      recordedBy: row.recorded_by ?? undefined,
      updatedAt: new Date(row.updated_at),
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async create(dto: RecordAllergyDTO): Promise<Allergy> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO allergies (
        id, organization_id, patient_id, status, allergen_name,
        category, severity, reaction, notes, recorded_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.patientId,
      dto.status,
      dto.allergenName ?? null,
      dto.category ?? 'DRUG',
      dto.severity ?? 'MODERATE',
      dto.reaction ?? null,
      dto.notes ?? null,
      dto.recordedBy ?? null,
      dto.recordedBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created allergy ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Allergy | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM allergies
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as AllergyRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async listByPatient(patientId: string, organizationId: string): Promise<Allergy[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM allergies
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY recorded_at DESC
    `).all(patientId, organizationId) as AllergyRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: Partial<RecordAllergyDTO>, updatedBy?: string): Promise<Allergy> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE allergies
      SET
        status = COALESCE(?, status),
        allergen_name = COALESCE(?, allergen_name),
        category = COALESCE(?, category),
        severity = COALESCE(?, severity),
        reaction = COALESCE(?, reaction),
        notes = COALESCE(?, notes),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      dto.status ?? null,
      dto.allergenName !== undefined ? dto.allergenName : null,
      dto.category ?? null,
      dto.severity ?? null,
      dto.reaction !== undefined ? dto.reaction : null,
      dto.notes !== undefined ? dto.notes : null,
      updatedBy ?? null,
      id,
      organizationId
    );

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async delete(id: string, organizationId: string): Promise<void> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      DELETE FROM allergies
      WHERE id = ? AND organization_id = ?
    `).run(id, organizationId);
  }
}
