import crypto from 'crypto';
import {
  ClinicalVisit,
  ClinicalVisitStatus,
  CreateClinicalVisitDTO,
  UpdateClinicalVisitDTO,
  IClinicalVisitRepository,
  ClinicalVisitNotFoundError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface ClinicalVisitRow {
  id: string;
  organization_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  visit_date_time: string;
  status: string;
  chief_complaint: string | null;
  history_of_present_illness: string | null;
  examination_notes: string | null;
  clinical_assessment: string | null;
  completed_at: string | null;
  has_corrections: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export class SqliteClinicalVisitRepository implements IClinicalVisitRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: ClinicalVisitRow): ClinicalVisit {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      appointmentId: row.appointment_id ?? undefined,
      visitDateTime: new Date(row.visit_date_time),
      status: row.status as ClinicalVisitStatus,
      chiefComplaint: row.chief_complaint ?? undefined,
      historyOfPresentIllness: row.history_of_present_illness ?? undefined,
      examinationNotes: row.examination_notes ?? undefined,
      clinicalAssessment: row.clinical_assessment ?? undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      hasCorrections: row.has_corrections === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async create(dto: CreateClinicalVisitDTO): Promise<ClinicalVisit> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();
    const visitDateTime = dto.visitDateTime ? dto.visitDateTime.toISOString() : new Date().toISOString();
    const status = dto.status ?? 'OPEN';

    raw.prepare(`
      INSERT INTO clinical_visits (
        id, organization_id, patient_id, doctor_id, appointment_id,
        visit_date_time, status, chief_complaint, history_of_present_illness,
        examination_notes, clinical_assessment, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.patientId,
      dto.doctorId,
      dto.appointmentId ?? null,
      visitDateTime,
      status,
      dto.chiefComplaint ?? null,
      dto.historyOfPresentIllness ?? null,
      dto.examinationNotes ?? null,
      dto.clinicalAssessment ?? null,
      dto.createdBy ?? null,
      dto.createdBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created clinical visit ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<ClinicalVisit | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM clinical_visits
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as ClinicalVisitRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByAppointmentId(appointmentId: string, organizationId: string): Promise<ClinicalVisit | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM clinical_visits
      WHERE appointment_id = ? AND organization_id = ?
    `).get(appointmentId, organizationId) as ClinicalVisitRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async listByPatient(patientId: string, organizationId: string, limit = 50): Promise<ClinicalVisit[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM clinical_visits
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY visit_date_time DESC
      LIMIT ?
    `).all(patientId, organizationId, limit) as ClinicalVisitRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: UpdateClinicalVisitDTO): Promise<ClinicalVisit> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE clinical_visits
      SET
        chief_complaint = COALESCE(?, chief_complaint),
        history_of_present_illness = COALESCE(?, history_of_present_illness),
        examination_notes = COALESCE(?, examination_notes),
        clinical_assessment = COALESCE(?, clinical_assessment),
        status = COALESCE(?, status),
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      dto.chiefComplaint !== undefined ? dto.chiefComplaint : null,
      dto.historyOfPresentIllness !== undefined ? dto.historyOfPresentIllness : null,
      dto.examinationNotes !== undefined ? dto.examinationNotes : null,
      dto.clinicalAssessment !== undefined ? dto.clinicalAssessment : null,
      dto.status !== undefined ? dto.status : null,
      dto.updatedBy ?? null,
      id,
      organizationId
    );

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async complete(id: string, organizationId: string, completedBy: string): Promise<ClinicalVisit> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE clinical_visits
      SET
        status = 'COMPLETED',
        completed_at = CURRENT_TIMESTAMP,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(completedBy, id, organizationId);

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async cancel(id: string, organizationId: string, cancelledBy: string): Promise<ClinicalVisit> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new ClinicalVisitNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE clinical_visits
      SET
        status = 'CANCELLED',
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(cancelledBy, id, organizationId);

    const updated = await this.findById(id, organizationId);
    return updated!;
  }
}
