import crypto from 'crypto';
import {
  Diagnosis,
  RecordDiagnosisDTO,
  DiagnosisType,
  DiagnosisStatus,
  IDiagnosisRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface DiagnosisRow {
  id: string;
  organization_id: string;
  patient_id: string;
  clinical_visit_id: string | null;
  doctor_id: string;
  diagnosis_text: string;
  type: string;
  status: string;
  code_system: string | null;
  code_value: string | null;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

export class SqliteDiagnosisRepository implements IDiagnosisRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: DiagnosisRow): Diagnosis {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      clinicalVisitId: row.clinical_visit_id ?? undefined,
      doctorId: row.doctor_id,
      diagnosisText: row.diagnosis_text,
      type: row.type as DiagnosisType,
      status: row.status as DiagnosisStatus,
      codeSystem: row.code_system ?? undefined,
      codeValue: row.code_value ?? undefined,
      notes: row.notes ?? undefined,
      recordedAt: new Date(row.recorded_at),
      recordedBy: row.recorded_by ?? undefined
    };
  }

  public async create(dto: RecordDiagnosisDTO): Promise<Diagnosis> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO diagnoses (
        id, organization_id, patient_id, clinical_visit_id, doctor_id,
        diagnosis_text, type, status, code_system, code_value, notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.patientId,
      dto.clinicalVisitId ?? null,
      dto.doctorId,
      dto.diagnosisText,
      dto.type ?? 'PRIMARY',
      dto.status ?? 'ACTIVE',
      dto.codeSystem ?? null,
      dto.codeValue ?? null,
      dto.notes ?? null,
      dto.recordedBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created diagnosis ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Diagnosis | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM diagnoses
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as DiagnosisRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByVisitId(visitId: string, organizationId: string): Promise<Diagnosis[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM diagnoses
      WHERE clinical_visit_id = ? AND organization_id = ?
      ORDER BY recorded_at ASC
    `).all(visitId, organizationId) as DiagnosisRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listByPatient(patientId: string, organizationId: string): Promise<Diagnosis[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM diagnoses
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY recorded_at DESC
    `).all(patientId, organizationId) as DiagnosisRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: Partial<RecordDiagnosisDTO>): Promise<Diagnosis> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE diagnoses
      SET
        diagnosis_text = COALESCE(?, diagnosis_text),
        type = COALESCE(?, type),
        status = COALESCE(?, status),
        code_system = COALESCE(?, code_system),
        code_value = COALESCE(?, code_value),
        notes = COALESCE(?, notes)
      WHERE id = ? AND organization_id = ?
    `).run(
      dto.diagnosisText ?? null,
      dto.type ?? null,
      dto.status ?? null,
      dto.codeSystem !== undefined ? dto.codeSystem : null,
      dto.codeValue !== undefined ? dto.codeValue : null,
      dto.notes !== undefined ? dto.notes : null,
      id,
      organizationId
    );

    const updated = await this.findById(id, organizationId);
    return updated!;
  }
}
