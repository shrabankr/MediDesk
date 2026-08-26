import crypto from 'crypto';
import {
  Doctor,
  DoctorSchedule,
  DoctorStatus,
  CreateDoctorDTO,
  UpdateDoctorDTO,
  SetDoctorScheduleItem,
  IDoctorRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface DoctorRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  display_name: string;
  qualification: string;
  specialization: string;
  registration_number: string | null;
  mobile: string | null;
  consultation_fee: number;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface ScheduleRow {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export class SqliteDoctorRepository implements IDoctorRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapDoctorRow(row: DoctorRow, schedules?: DoctorSchedule[]): Doctor {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id ?? undefined,
      displayName: row.display_name,
      qualification: row.qualification,
      specialization: row.specialization,
      registrationNumber: row.registration_number ?? undefined,
      mobile: row.mobile ?? undefined,
      consultationFee: row.consultation_fee,
      status: row.status as DoctorStatus,
      schedules,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  private mapScheduleRow(row: ScheduleRow): DoctorSchedule {
    return {
      id: row.id,
      doctorId: row.doctor_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time,
      endTime: row.end_time,
      slotDurationMinutes: row.slot_duration_minutes,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  public async create(dto: CreateDoctorDTO): Promise<Doctor> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      raw.prepare(`
        INSERT INTO doctors (
          id, organization_id, user_id, display_name, qualification,
          specialization, registration_number, mobile, consultation_fee,
          status, created_at, updated_at, created_by, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        dto.organizationId,
        dto.userId ?? null,
        dto.displayName.trim(),
        dto.qualification.trim(),
        dto.specialization.trim(),
        dto.registrationNumber?.trim() ?? null,
        dto.mobile?.trim() ?? null,
        dto.consultationFee ?? 0.0,
        'ACTIVE',
        now,
        now,
        dto.createdBy ?? null,
        dto.createdBy ?? null
      );

      const created = this.findByIdSync(id);
      if (!created) {
        throw new Error('Failed to retrieve newly created doctor record.');
      }
      return created;
    });
  }

  private findByIdSync(id: string): Doctor | null {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as DoctorRow | undefined;
    if (!row) return null;

    const scheduleRows = raw.prepare(`
      SELECT * FROM doctor_schedules
      WHERE doctor_id = ?
      ORDER BY day_of_week ASC, start_time ASC
    `).all(id) as ScheduleRow[];

    const schedules = scheduleRows.map((s) => this.mapScheduleRow(s));
    return this.mapDoctorRow(row, schedules);
  }

  public async findById(id: string): Promise<Doctor | null> {
    return this.findByIdSync(id);
  }

  public async findByUserId(userId: string): Promise<Doctor | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM doctors WHERE user_id = ?').get(userId) as DoctorRow | undefined;
    if (!row) return null;
    return this.findById(row.id);
  }

  public async listByOrganization(organizationId: string, options?: { activeOnly?: boolean }): Promise<Doctor[]> {
    const raw = this.db.getRawDb();
    let sql = 'SELECT * FROM doctors WHERE organization_id = ?';
    const params: unknown[] = [organizationId];

    if (options?.activeOnly) {
      sql += ' AND status = ?';
      params.push('ACTIVE');
    }

    sql += ' ORDER BY display_name ASC';

    const rows = raw.prepare(sql).all(...params) as DoctorRow[];
    const result: Doctor[] = [];

    for (const row of rows) {
      const scheduleRows = raw.prepare(`
        SELECT * FROM doctor_schedules
        WHERE doctor_id = ? AND is_active = 1
        ORDER BY day_of_week ASC, start_time ASC
      `).all(row.id) as ScheduleRow[];

      result.push(this.mapDoctorRow(row, scheduleRows.map((s) => this.mapScheduleRow(s))));
    }

    return result;
  }

  public async update(id: string, dto: UpdateDoctorDTO): Promise<Doctor> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const updates: string[] = [];
      const params: unknown[] = [];
      const now = new Date().toISOString();

      if (dto.displayName !== undefined) {
        updates.push('display_name = ?');
        params.push(dto.displayName.trim());
      }
      if (dto.qualification !== undefined) {
        updates.push('qualification = ?');
        params.push(dto.qualification.trim());
      }
      if (dto.specialization !== undefined) {
        updates.push('specialization = ?');
        params.push(dto.specialization.trim());
      }
      if (dto.registrationNumber !== undefined) {
        updates.push('registration_number = ?');
        params.push(dto.registrationNumber.trim());
      }
      if (dto.mobile !== undefined) {
        updates.push('mobile = ?');
        params.push(dto.mobile.trim());
      }
      if (dto.consultationFee !== undefined) {
        updates.push('consultation_fee = ?');
        params.push(dto.consultationFee);
      }
      if (dto.status !== undefined) {
        updates.push('status = ?');
        params.push(dto.status);
      }
      if (dto.userId !== undefined) {
        updates.push('user_id = ?');
        params.push(dto.userId || null);
      }
      if (dto.updatedBy !== undefined) {
        updates.push('updated_by = ?');
        params.push(dto.updatedBy);
      }

      updates.push('updated_at = ?');
      params.push(now);

      params.push(id);

      raw.prepare(`UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const updated = this.findByIdSync(id);
      if (!updated) {
        throw new Error(`Doctor with id ${id} not found after update.`);
      }
      return updated;
    });
  }

  public async setSchedules(doctorId: string, schedules: SetDoctorScheduleItem[]): Promise<DoctorSchedule[]> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const now = new Date().toISOString();

      // Delete existing schedules
      raw.prepare('DELETE FROM doctor_schedules WHERE doctor_id = ?').run(doctorId);

      // Insert new schedules
      const insertStmt = raw.prepare(`
        INSERT INTO doctor_schedules (
          id, doctor_id, day_of_week, start_time, end_time,
          slot_duration_minutes, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of schedules) {
        const schedId = crypto.randomUUID();
        insertStmt.run(
          schedId,
          doctorId,
          s.dayOfWeek,
          s.startTime.trim(),
          s.endTime.trim(),
          s.slotDurationMinutes ?? 15,
          s.isActive !== false ? 1 : 0,
          now,
          now
        );
      }

      const rows = raw.prepare(`
        SELECT * FROM doctor_schedules
        WHERE doctor_id = ?
        ORDER BY day_of_week ASC, start_time ASC
      `).all(doctorId) as ScheduleRow[];

      return rows.map((r) => this.mapScheduleRow(r));
    });
  }

  public async getSchedules(doctorId: string): Promise<DoctorSchedule[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM doctor_schedules
      WHERE doctor_id = ?
      ORDER BY day_of_week ASC, start_time ASC
    `).all(doctorId) as ScheduleRow[];

    return rows.map((r) => this.mapScheduleRow(r));
  }
}
