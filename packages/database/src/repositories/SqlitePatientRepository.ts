import crypto from 'crypto';
import {
  Patient,
  CreatePatientDTO,
  UpdatePatientDTO,
  PatientSearchParams,
  IPatientRepository,
  DuplicatePatientMatch,
  PatientStatus,
  Sex
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface PatientRow {
  id: string;
  organization_id: string;
  patient_number: string;
  full_name: string;
  normalized_name: string;
  date_of_birth: string | null;
  age: number | null;
  sex: string;
  mobile: string | null;
  normalized_mobile: string | null;
  alternate_mobile: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: string;
  merged_into_patient_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function normalizeMobile(mobile?: string): string | undefined {
  if (!mobile) return undefined;
  const digits = mobile.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits.length > 0 ? digits : undefined;
}

export class SqlitePatientRepository implements IPatientRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: PatientRow): Patient {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientNumber: row.patient_number,
      fullName: row.full_name,
      normalizedName: row.normalized_name,
      dateOfBirth: row.date_of_birth ?? undefined,
      age: row.age !== null ? row.age : undefined,
      sex: row.sex as Sex,
      mobile: row.mobile ?? undefined,
      normalizedMobile: row.normalized_mobile ?? undefined,
      alternateMobile: row.alternate_mobile ?? undefined,
      address: row.address ?? undefined,
      emergencyContactName: row.emergency_contact_name ?? undefined,
      emergencyContactPhone: row.emergency_contact_phone ?? undefined,
      status: row.status as PatientStatus,
      mergedIntoPatientId: row.merged_into_patient_id ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async getNextPatientNumber(organizationId: string): Promise<string> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT patient_number FROM patients
      WHERE organization_id = ?
      ORDER BY rowid DESC
      LIMIT 1
    `).get(organizationId) as { patient_number: string } | undefined;

    if (!row || !row.patient_number) {
      return 'MD-000001';
    }

    const match = row.patient_number.match(/MD-(\d+)/);
    if (!match) {
      return 'MD-000001';
    }

    const nextSeq = parseInt(match[1], 10) + 1;
    return `MD-${String(nextSeq).padStart(6, '0')}`;
  }

  public async create(dto: CreatePatientDTO): Promise<Patient> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const normName = normalizeName(dto.fullName);
      const normMobile = normalizeMobile(dto.mobile);

      // Generate sequential human-friendly patient number inside transaction
      let patientNumber = 'MD-000001';
      const lastRow = raw.prepare(`
        SELECT patient_number FROM patients
        WHERE organization_id = ?
        ORDER BY rowid DESC
        LIMIT 1
      `).get(dto.organizationId) as { patient_number: string } | undefined;

      if (lastRow?.patient_number) {
        const match = lastRow.patient_number.match(/MD-(\d+)/);
        if (match) {
          const nextSeq = parseInt(match[1], 10) + 1;
          patientNumber = `MD-${String(nextSeq).padStart(6, '0')}`;
        }
      }

      raw.prepare(`
        INSERT INTO patients (
          id, organization_id, patient_number, full_name, normalized_name,
          date_of_birth, age, sex, mobile, normalized_mobile, alternate_mobile,
          address, emergency_contact_name, emergency_contact_phone, status,
          created_at, updated_at, created_by, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        dto.organizationId,
        patientNumber,
        dto.fullName.trim(),
        normName,
        dto.dateOfBirth ?? null,
        dto.age ?? null,
        dto.sex,
        dto.mobile?.trim() ?? null,
        normMobile ?? null,
        dto.alternateMobile?.trim() ?? null,
        dto.address?.trim() ?? null,
        dto.emergencyContactName?.trim() ?? null,
        dto.emergencyContactPhone?.trim() ?? null,
        'ACTIVE',
        now,
        now,
        dto.createdBy ?? null,
        dto.createdBy ?? null
      );

      const created = this.findByIdSync(id);
      if (!created) {
        throw new Error('Failed to retrieve newly created patient record.');
      }
      return created;
    });
  }

  private findByIdSync(id: string): Patient | null {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async findById(id: string): Promise<Patient | null> {
    return this.findByIdSync(id);
  }

  public async findByPatientNumber(organizationId: string, patientNumber: string): Promise<Patient | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM patients
      WHERE organization_id = ? AND patient_number = ?
    `).get(organizationId, patientNumber.trim().toUpperCase()) as PatientRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  public async search(params: PatientSearchParams): Promise<Patient[]> {
    const raw = this.db.getRawDb();
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let sql = 'SELECT * FROM patients WHERE organization_id = ?';
    const queryParams: unknown[] = [params.organizationId];

    if (params.status) {
      sql += ' AND status = ?';
      queryParams.push(params.status);
    }

    if (params.query && params.query.trim().length > 0) {
      const q = params.query.trim();
      const normQ = normalizeName(q);
      const digits = q.replace(/\D/g, '');

      if (digits.length >= 3) {
        sql += ` AND (
          patient_number LIKE ?
          OR normalized_name LIKE ?
          OR (normalized_mobile IS NOT NULL AND normalized_mobile LIKE ?)
          OR (alternate_mobile IS NOT NULL AND alternate_mobile LIKE ?)
        )`;
        const wildcardQ = `%${normQ}%`;
        const wildcardMob = `%${digits}%`;
        const wildcardCode = `%${q.toUpperCase()}%`;
        queryParams.push(wildcardCode, wildcardQ, wildcardMob, wildcardMob);
      } else {
        sql += ` AND (
          patient_number LIKE ?
          OR normalized_name LIKE ?
        )`;
        const wildcardQ = `%${normQ}%`;
        const wildcardCode = `%${q.toUpperCase()}%`;
        queryParams.push(wildcardCode, wildcardQ);
      }
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    const rows = raw.prepare(sql).all(...queryParams) as PatientRow[];
    return rows.map((r) => this.mapRow(r));
  }

  public async findPotentialDuplicates(
    organizationId: string,
    criteria: {
      fullName: string;
      mobile?: string;
      dateOfBirth?: string;
      sex?: string;
      excludePatientId?: string;
    }
  ): Promise<DuplicatePatientMatch[]> {
    const raw = this.db.getRawDb();
    const normName = normalizeName(criteria.fullName);
    const normMobile = normalizeMobile(criteria.mobile);
    const matches: DuplicatePatientMatch[] = [];
    const seenIds = new Set<string>();

    if (criteria.excludePatientId) {
      seenIds.add(criteria.excludePatientId);
    }

    // 1. Strong Match: Exact normalized 10-digit mobile number
    if (normMobile && normMobile.length >= 10) {
      const rows = raw.prepare(`
        SELECT * FROM patients
        WHERE organization_id = ?
          AND normalized_mobile = ?
          AND status != 'MERGED'
      `).all(organizationId, normMobile) as PatientRow[];

      for (const row of rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          matches.push({
            patient: this.mapRow(row),
            confidence: 'STRONG',
            matchReason: `Exact match on mobile number (${row.mobile})`
          });
        }
      }
    }

    // 2. Medium Match: Exact normalized name + (same DOB OR same Sex)
    if (normName.length >= 3) {
      const rows = raw.prepare(`
        SELECT * FROM patients
        WHERE organization_id = ?
          AND normalized_name = ?
          AND status != 'MERGED'
      `).all(organizationId, normName) as PatientRow[];

      for (const row of rows) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          let reason = 'Identical full name';
          let confidence: 'MEDIUM' | 'LOW' = 'MEDIUM';

          if (criteria.dateOfBirth && row.date_of_birth === criteria.dateOfBirth) {
            reason = 'Identical full name and date of birth';
          } else if (criteria.sex && row.sex === criteria.sex) {
            reason = 'Identical full name and gender';
          } else {
            confidence = 'LOW';
          }

          matches.push({
            patient: this.mapRow(row),
            confidence,
            matchReason: reason
          });
        }
      }
    }

    return matches;
  }

  public async update(id: string, dto: UpdatePatientDTO): Promise<Patient> {
    return this.db.transaction(() => {
      const raw = this.db.getRawDb();
      const updates: string[] = [];
      const params: unknown[] = [];
      const now = new Date().toISOString();

      if (dto.fullName !== undefined) {
        updates.push('full_name = ?', 'normalized_name = ?');
        params.push(dto.fullName.trim(), normalizeName(dto.fullName));
      }
      if (dto.dateOfBirth !== undefined) {
        updates.push('date_of_birth = ?');
        params.push(dto.dateOfBirth);
      }
      if (dto.age !== undefined) {
        updates.push('age = ?');
        params.push(dto.age);
      }
      if (dto.sex !== undefined) {
        updates.push('sex = ?');
        params.push(dto.sex);
      }
      if (dto.mobile !== undefined) {
        updates.push('mobile = ?', 'normalized_mobile = ?');
        params.push(dto.mobile.trim(), normalizeMobile(dto.mobile) ?? null);
      }
      if (dto.alternateMobile !== undefined) {
        updates.push('alternate_mobile = ?');
        params.push(dto.alternateMobile.trim());
      }
      if (dto.address !== undefined) {
        updates.push('address = ?');
        params.push(dto.address.trim());
      }
      if (dto.emergencyContactName !== undefined) {
        updates.push('emergency_contact_name = ?');
        params.push(dto.emergencyContactName.trim());
      }
      if (dto.emergencyContactPhone !== undefined) {
        updates.push('emergency_contact_phone = ?');
        params.push(dto.emergencyContactPhone.trim());
      }
      if (dto.status !== undefined) {
        updates.push('status = ?');
        params.push(dto.status);
      }
      if (dto.mergedIntoPatientId !== undefined) {
        updates.push('merged_into_patient_id = ?');
        params.push(dto.mergedIntoPatientId);
      }
      if (dto.updatedBy !== undefined) {
        updates.push('updated_by = ?');
        params.push(dto.updatedBy);
      }

      updates.push('updated_at = ?');
      params.push(now);

      params.push(id);

      raw.prepare(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const updated = this.findByIdSync(id);
      if (!updated) {
        throw new Error(`Patient with id ${id} not found after update.`);
      }
      return updated;
    });
  }

  public async count(organizationId: string): Promise<number> {
    const raw = this.db.getRawDb();
    const row = raw.prepare('SELECT COUNT(*) as count FROM patients WHERE organization_id = ?').get(organizationId) as { count: number };
    return row.count;
  }
}
