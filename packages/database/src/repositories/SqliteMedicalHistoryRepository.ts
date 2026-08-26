import crypto from 'crypto';
import {
  MedicalHistory,
  RecordMedicalHistoryDTO,
  MedicalHistoryCategory,
  IMedicalHistoryRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface MedicalHistoryRow {
  id: string;
  organization_id: string;
  patient_id: string;
  category: string;
  description: string;
  diagnosed_date: string | null;
  is_active: number;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export class SqliteMedicalHistoryRepository implements IMedicalHistoryRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: MedicalHistoryRow): MedicalHistory {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      category: row.category as MedicalHistoryCategory,
      description: row.description,
      diagnosedDate: row.diagnosed_date ?? undefined,
      isActive: row.is_active === 1,
      notes: row.notes ?? undefined,
      recordedAt: new Date(row.recorded_at),
      recordedBy: row.recorded_by ?? undefined,
      updatedAt: new Date(row.updated_at),
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async create(dto: RecordMedicalHistoryDTO): Promise<MedicalHistory> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();
    const isActive = dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : 1;

    raw.prepare(`
      INSERT INTO medical_history (
        id, organization_id, patient_id, category, description,
        diagnosed_date, is_active, notes, recorded_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.patientId,
      dto.category,
      dto.description,
      dto.diagnosedDate ?? null,
      isActive,
      dto.notes ?? null,
      dto.recordedBy ?? null,
      dto.recordedBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created medical history ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<MedicalHistory | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM medical_history
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as MedicalHistoryRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async listByPatient(patientId: string, organizationId: string): Promise<MedicalHistory[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM medical_history
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY recorded_at DESC
    `).all(patientId, organizationId) as MedicalHistoryRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: Partial<RecordMedicalHistoryDTO>, updatedBy?: string): Promise<MedicalHistory> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE medical_history
      SET
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        diagnosed_date = COALESCE(?, diagnosed_date),
        is_active = COALESCE(?, is_active),
        notes = COALESCE(?, notes),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      dto.category ?? null,
      dto.description ?? null,
      dto.diagnosedDate !== undefined ? dto.diagnosedDate : null,
      dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : null,
      dto.notes !== undefined ? dto.notes : null,
      updatedBy ?? null,
      id,
      organizationId
    );

    const updated = await this.findById(id, organizationId);
    return updated!;
  }
}
