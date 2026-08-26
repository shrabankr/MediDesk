import crypto from 'crypto';
import { Vitals, RecordVitalsDTO, TemperatureUnit, IVitalsRepository } from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface VitalsRow {
  id: string;
  organization_id: string;
  patient_id: string;
  clinical_visit_id: string | null;
  temperature: number | null;
  temperature_unit: string;
  pulse_rate: number | null;
  respiratory_rate: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  oxygen_saturation_spo2: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

export class SqliteVitalsRepository implements IVitalsRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: VitalsRow): Vitals {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      clinicalVisitId: row.clinical_visit_id ?? undefined,
      temperature: row.temperature !== null ? row.temperature : undefined,
      temperatureUnit: row.temperature_unit as TemperatureUnit,
      pulseRate: row.pulse_rate !== null ? row.pulse_rate : undefined,
      respiratoryRate: row.respiratory_rate !== null ? row.respiratory_rate : undefined,
      systolicBp: row.systolic_bp !== null ? row.systolic_bp : undefined,
      diastolicBp: row.diastolic_bp !== null ? row.diastolic_bp : undefined,
      oxygenSaturationSpo2: row.oxygen_saturation_spo2 !== null ? row.oxygen_saturation_spo2 : undefined,
      weightKg: row.weight_kg !== null ? row.weight_kg : undefined,
      heightCm: row.height_cm !== null ? row.height_cm : undefined,
      bmi: row.bmi !== null ? row.bmi : undefined,
      notes: row.notes ?? undefined,
      recordedAt: new Date(row.recorded_at),
      recordedBy: row.recorded_by ?? undefined
    };
  }

  public async create(dto: RecordVitalsDTO): Promise<Vitals> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    // Calculate BMI if height and weight provided
    let calculatedBmi: number | null = null;
    if (dto.bmi !== undefined) {
      calculatedBmi = dto.bmi;
    } else if (dto.weightKg && dto.heightCm && dto.heightCm > 0) {
      const heightInMeters = dto.heightCm / 100;
      calculatedBmi = parseFloat((dto.weightKg / (heightInMeters * heightInMeters)).toFixed(1));
    }

    raw.prepare(`
      INSERT INTO vitals (
        id, organization_id, patient_id, clinical_visit_id,
        temperature, temperature_unit, pulse_rate, respiratory_rate,
        systolic_bp, diastolic_bp, oxygen_saturation_spo2, weight_kg,
        height_cm, bmi, notes, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.patientId,
      dto.clinicalVisitId ?? null,
      dto.temperature ?? null,
      dto.temperatureUnit ?? 'FAHRENHEIT',
      dto.pulseRate ?? null,
      dto.respiratoryRate ?? null,
      dto.systolicBp ?? null,
      dto.diastolicBp ?? null,
      dto.oxygenSaturationSpo2 ?? null,
      dto.weightKg ?? null,
      dto.heightCm ?? null,
      calculatedBmi,
      dto.notes ?? null,
      dto.recordedBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created vitals record ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Vitals | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM vitals
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as VitalsRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByVisitId(visitId: string, organizationId: string): Promise<Vitals[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM vitals
      WHERE clinical_visit_id = ? AND organization_id = ?
      ORDER BY recorded_at DESC
    `).all(visitId, organizationId) as VitalsRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listByPatient(patientId: string, organizationId: string, limit = 50): Promise<Vitals[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM vitals
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `).all(patientId, organizationId, limit) as VitalsRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async getLatestByPatient(patientId: string, organizationId: string): Promise<Vitals | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM vitals
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `).get(patientId, organizationId) as VitalsRow | undefined;

    return row ? this.mapRow(row) : null;
  }
}
