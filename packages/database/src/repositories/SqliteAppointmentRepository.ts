import crypto from 'crypto';
import {
  Appointment,
  AppointmentStatus,
  CreateAppointmentDTO,
  UpdateAppointmentDTO,
  AppointmentFilterParams,
  IAppointmentRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface AppointmentRow {
  id: string;
  organization_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  queue_number: number;
  visit_purpose: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Joined fields
  patient_name?: string;
  patient_number?: string;
  patient_mobile?: string;
  doctor_name?: string;
  doctor_specialization?: string;
}

export class SqliteAppointmentRepository implements IAppointmentRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: AppointmentRow): Appointment {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      appointmentDate: row.appointment_date,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMinutes: row.duration_minutes,
      status: row.status as AppointmentStatus,
      queueNumber: row.queue_number,
      visitPurpose: row.visit_purpose ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined,
      patientName: row.patient_name,
      patientNumber: row.patient_number,
      patientMobile: row.patient_mobile,
      doctorName: row.doctor_name,
      doctorSpecialization: row.doctor_specialization
    };
  }

  public async getNextQueueNumber(organizationId: string, appointmentDate: string, doctorId: string): Promise<number> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT MAX(queue_number) as max_queue
      FROM appointments
      WHERE organization_id = ? AND appointment_date = ? AND doctor_id = ?
    `).get(organizationId, appointmentDate, doctorId) as { max_queue: number | null } | undefined;

    return (row?.max_queue ?? 0) + 1;
  }

  public async create(dto: CreateAppointmentDTO): Promise<Appointment> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      let queueNumber = dto.queueNumber;
      if (!queueNumber) {
        const lastRow = raw.prepare(`
          SELECT MAX(queue_number) as max_queue
          FROM appointments
          WHERE organization_id = ? AND appointment_date = ? AND doctor_id = ?
        `).get(dto.organizationId, dto.appointmentDate, dto.doctorId) as { max_queue: number | null } | undefined;

        queueNumber = (lastRow?.max_queue ?? 0) + 1;
      }

      raw.prepare(`
        INSERT INTO appointments (
          id, organization_id, patient_id, doctor_id, appointment_date,
          start_time, end_time, duration_minutes, status, queue_number,
          visit_purpose, notes, created_at, updated_at, created_by, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        dto.organizationId,
        dto.patientId,
        dto.doctorId,
        dto.appointmentDate,
        dto.startTime.trim(),
        dto.endTime.trim(),
        dto.durationMinutes ?? 15,
        dto.status ?? 'SCHEDULED',
        queueNumber,
        dto.visitPurpose?.trim() ?? null,
        dto.notes?.trim() ?? null,
        now,
        now,
        dto.createdBy ?? null,
        dto.createdBy ?? null
      );

      const created = this.findByIdSync(id);
      if (!created) {
        throw new Error('Failed to retrieve newly created appointment record.');
      }
      return created;
    });
  }

  private findByIdSync(id: string): Appointment | null {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.patient_number as patient_number,
        p.mobile as patient_mobile,
        d.display_name as doctor_name,
        d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      WHERE a.id = ?
    `).get(id) as AppointmentRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findById(id: string): Promise<Appointment | null> {
    return this.findByIdSync(id);
  }

  public async findDoctorConflicts(
    doctorId: string,
    appointmentDate: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): Promise<Appointment[]> {
    const raw = this.db.getRawDb();
    let sql = `
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.patient_number as patient_number,
        p.mobile as patient_mobile,
        d.display_name as doctor_name,
        d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      WHERE a.doctor_id = ?
        AND a.appointment_date = ?
        AND a.status NOT IN ('CANCELLED')
        AND (a.start_time < ? AND a.end_time > ?)
    `;
    const params: unknown[] = [doctorId, appointmentDate, endTime, startTime];

    if (excludeAppointmentId) {
      sql += ' AND a.id != ?';
      params.push(excludeAppointmentId);
    }

    const rows = raw.prepare(sql).all(...params) as AppointmentRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async list(filter: AppointmentFilterParams): Promise<Appointment[]> {
    const raw = this.db.getRawDb();
    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    let sql = `
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.patient_number as patient_number,
        p.mobile as patient_mobile,
        d.display_name as doctor_name,
        d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      WHERE a.organization_id = ?
    `;
    const params: unknown[] = [filter.organizationId];

    if (filter.startDate) {
      sql += ' AND a.appointment_date >= ?';
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      sql += ' AND a.appointment_date <= ?';
      params.push(filter.endDate);
    }
    if (filter.doctorId) {
      sql += ' AND a.doctor_id = ?';
      params.push(filter.doctorId);
    }
    if (filter.patientId) {
      sql += ' AND a.patient_id = ?';
      params.push(filter.patientId);
    }
    if (filter.status) {
      sql += ' AND a.status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY a.appointment_date DESC, a.start_time ASC, a.queue_number ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = raw.prepare(sql).all(...params) as AppointmentRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async listQueueByDate(
    organizationId: string,
    appointmentDate: string,
    doctorId?: string
  ): Promise<Appointment[]> {
    const raw = this.db.getRawDb();
    let sql = `
      SELECT 
        a.*,
        p.full_name as patient_name,
        p.patient_number as patient_number,
        p.mobile as patient_mobile,
        d.display_name as doctor_name,
        d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN patients p ON p.id = a.patient_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      WHERE a.organization_id = ?
        AND a.appointment_date = ?
    `;
    const params: unknown[] = [organizationId, appointmentDate];

    if (doctorId) {
      sql += ' AND a.doctor_id = ?';
      params.push(doctorId);
    }

    sql += ' ORDER BY a.queue_number ASC, a.start_time ASC';

    const rows = raw.prepare(sql).all(...params) as AppointmentRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, dto: UpdateAppointmentDTO): Promise<Appointment> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const updates: string[] = [];
      const params: unknown[] = [];
      const now = new Date().toISOString();

      if (dto.doctorId !== undefined) {
        updates.push('doctor_id = ?');
        params.push(dto.doctorId);
      }
      if (dto.appointmentDate !== undefined) {
        updates.push('appointment_date = ?');
        params.push(dto.appointmentDate);
      }
      if (dto.startTime !== undefined) {
        updates.push('start_time = ?');
        params.push(dto.startTime.trim());
      }
      if (dto.endTime !== undefined) {
        updates.push('end_time = ?');
        params.push(dto.endTime.trim());
      }
      if (dto.durationMinutes !== undefined) {
        updates.push('duration_minutes = ?');
        params.push(dto.durationMinutes);
      }
      if (dto.status !== undefined) {
        updates.push('status = ?');
        params.push(dto.status);
      }
      if (dto.queueNumber !== undefined) {
        updates.push('queue_number = ?');
        params.push(dto.queueNumber);
      }
      if (dto.visitPurpose !== undefined) {
        updates.push('visit_purpose = ?');
        params.push(dto.visitPurpose.trim());
      }
      if (dto.notes !== undefined) {
        updates.push('notes = ?');
        params.push(dto.notes.trim());
      }
      if (dto.updatedBy !== undefined) {
        updates.push('updated_by = ?');
        params.push(dto.updatedBy);
      }

      updates.push('updated_at = ?');
      params.push(now);

      params.push(id);

      raw.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const updated = this.findByIdSync(id);
      if (!updated) {
        throw new Error(`Appointment with id ${id} not found after update.`);
      }
      return updated;
    });
  }

  public async updateStatus(id: string, status: AppointmentStatus, updatedBy?: string): Promise<Appointment> {
    return this.update(id, { status, updatedBy });
  }

  public async countTodayMetrics(
    organizationId: string,
    appointmentDate: string,
    doctorId?: string
  ): Promise<{
    total: number;
    scheduled: number;
    checkedIn: number;
    waiting: number;
    inConsultation: number;
    completed: number;
    cancelled: number;
    noShow: number;
  }> {
    const raw = this.db.getRawDb();
    let sql = `
      SELECT status, COUNT(*) as count
      FROM appointments
      WHERE organization_id = ? AND appointment_date = ?
    `;
    const params: unknown[] = [organizationId, appointmentDate];

    if (doctorId) {
      sql += ' AND doctor_id = ?';
      params.push(doctorId);
    }

    sql += ' GROUP BY status';

    const rows = raw.prepare(sql).all(...params) as { status: string; count: number }[];

    const metrics = {
      total: 0,
      scheduled: 0,
      checkedIn: 0,
      waiting: 0,
      inConsultation: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0
    };

    for (const r of rows) {
      metrics.total += r.count;
      switch (r.status) {
        case 'SCHEDULED':
          metrics.scheduled += r.count;
          break;
        case 'CHECKED_IN':
          metrics.checkedIn += r.count;
          break;
        case 'WAITING':
          metrics.waiting += r.count;
          break;
        case 'IN_CONSULTATION':
          metrics.inConsultation += r.count;
          break;
        case 'COMPLETED':
          metrics.completed += r.count;
          break;
        case 'CANCELLED':
          metrics.cancelled += r.count;
          break;
        case 'NO_SHOW':
          metrics.noShow += r.count;
          break;
      }
    }

    return metrics;
  }
}
