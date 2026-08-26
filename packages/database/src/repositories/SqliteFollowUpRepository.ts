import crypto from 'crypto';
import {
  FollowUp,
  ScheduleFollowUpDTO,
  FollowUpStatus,
  IFollowUpRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface FollowUpRow {
  id: string;
  organization_id: string;
  patient_id: string;
  doctor_id: string;
  clinical_visit_id: string | null;
  follow_up_date: string;
  instructions: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export class SqliteFollowUpRepository implements IFollowUpRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: FollowUpRow): FollowUp {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      clinicalVisitId: row.clinical_visit_id ?? undefined,
      followUpDate: row.follow_up_date,
      instructions: row.instructions ?? undefined,
      notes: row.notes ?? undefined,
      status: row.status as FollowUpStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async create(dto: ScheduleFollowUpDTO): Promise<FollowUp> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO follow_ups (
        id, organization_id, patient_id, doctor_id, clinical_visit_id,
        follow_up_date, instructions, notes, status, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.patientId,
      dto.doctorId,
      dto.clinicalVisitId ?? null,
      dto.followUpDate,
      dto.instructions ?? null,
      dto.notes ?? null,
      dto.createdBy ?? null,
      dto.createdBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created follow-up ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<FollowUp | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM follow_ups
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as FollowUpRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByVisitId(visitId: string, organizationId: string): Promise<FollowUp[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM follow_ups
      WHERE clinical_visit_id = ? AND organization_id = ?
      ORDER BY follow_up_date ASC
    `).all(visitId, organizationId) as FollowUpRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listByPatient(patientId: string, organizationId: string): Promise<FollowUp[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM follow_ups
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY follow_up_date DESC
    `).all(patientId, organizationId) as FollowUpRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listDueFollowUps(organizationId: string, fromDate: string, toDate: string, doctorId?: string): Promise<FollowUp[]> {
    const raw = this.db.getRawDb();
    let sql = `
      SELECT * FROM follow_ups
      WHERE organization_id = ?
        AND follow_up_date >= ?
        AND follow_up_date <= ?
    `;
    const params: (string | number)[] = [organizationId, fromDate, toDate];

    if (doctorId) {
      sql += ' AND doctor_id = ?';
      params.push(doctorId);
    }

    sql += ' ORDER BY follow_up_date ASC';

    const rows = raw.prepare(sql).all(...params) as FollowUpRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async updateStatus(id: string, organizationId: string, status: FollowUpStatus, updatedBy?: string): Promise<FollowUp> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE follow_ups
      SET
        status = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(status, updatedBy ?? null, id, organizationId);

    const updated = await this.findById(id, organizationId);
    return updated!;
  }
}
