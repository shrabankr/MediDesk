import crypto from 'crypto';
import {
  Prescription,
  PrescriptionStatus,
  PrescriptionVersion,
  PrescriptionVersionStatus,
  PrescriptionItem,
  DosageForm,
  RouteOfAdministration,
  DurationUnit,
  CreatePrescriptionDTO,
  RevisePrescriptionDTO,
  IPrescriptionRepository,
  PrescriptionNotFoundError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface PrescriptionRow {
  id: string;
  organization_id: string;
  patient_id: string;
  doctor_id: string;
  clinical_visit_id: string | null;
  status: string;
  current_version_number: number;
  signed_at: string | null;
  signed_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface PrescriptionVersionRow {
  id: string;
  prescription_id: string;
  version_number: number;
  status: string;
  reason_for_change: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

interface PrescriptionItemRow {
  id: string;
  prescription_version_id: string;
  medicine_name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string;
  route: string;
  frequency: string;
  duration_value: number | null;
  duration_unit: string;
  instructions: string | null;
  quantity: number | null;
  is_substitution_allowed: number;
  created_at: string;
}

export class SqlitePrescriptionRepository implements IPrescriptionRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapItemRow(row: PrescriptionItemRow): PrescriptionItem {
    return {
      id: row.id,
      prescriptionVersionId: row.prescription_version_id,
      medicineName: row.medicine_name,
      genericName: row.generic_name ?? undefined,
      strength: row.strength ?? undefined,
      dosageForm: row.dosage_form as DosageForm,
      route: row.route as RouteOfAdministration,
      frequency: row.frequency,
      durationValue: row.duration_value !== null ? row.duration_value : undefined,
      durationUnit: row.duration_unit as DurationUnit,
      instructions: row.instructions ?? undefined,
      quantity: row.quantity !== null ? row.quantity : undefined,
      isSubstitutionAllowed: row.is_substitution_allowed === 1,
      createdAt: new Date(row.created_at)
    };
  }

  private mapVersionRow(row: PrescriptionVersionRow, items: PrescriptionItem[]): PrescriptionVersion {
    return {
      id: row.id,
      prescriptionId: row.prescription_id,
      versionNumber: row.version_number,
      status: row.status as PrescriptionVersionStatus,
      reasonForChange: row.reason_for_change ?? undefined,
      notes: row.notes ?? undefined,
      items,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined
    };
  }

  private mapPrescriptionRow(row: PrescriptionRow, currentVersion?: PrescriptionVersion): Prescription {
    return {
      id: row.id,
      organizationId: row.organization_id,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      clinicalVisitId: row.clinical_visit_id ?? undefined,
      status: row.status as PrescriptionStatus,
      currentVersionNumber: row.current_version_number,
      currentVersion,
      signedAt: row.signed_at ? new Date(row.signed_at) : undefined,
      signedBy: row.signed_by ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  private getVersionWithItems(versionId: string): PrescriptionVersion | null {
    const raw = this.db.getRawDb();
    const vRow = raw.prepare(`
      SELECT * FROM prescription_versions WHERE id = ?
    `).get(versionId) as PrescriptionVersionRow | undefined;

    if (!vRow) return null;

    const itemRows = raw.prepare(`
      SELECT * FROM prescription_items WHERE prescription_version_id = ? ORDER BY created_at ASC
    `).all(versionId) as PrescriptionItemRow[];

    return this.mapVersionRow(vRow, itemRows.map((r) => this.mapItemRow(r)));
  }

  public async create(dto: CreatePrescriptionDTO): Promise<Prescription> {
    const rxId = dto.id ?? crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const raw = this.db.getRawDb();

    this.db.transaction(() => {
      // 1. Insert Prescription Parent
      raw.prepare(`
        INSERT INTO prescriptions (
          id, organization_id, patient_id, doctor_id, clinical_visit_id,
          status, current_version_number, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, 'DRAFT', 1, ?, ?)
      `).run(
        rxId,
        dto.organizationId,
        dto.patientId,
        dto.doctorId,
        dto.clinicalVisitId ?? null,
        dto.createdBy ?? null,
        dto.createdBy ?? null
      );

      // 2. Insert Version 1
      raw.prepare(`
        INSERT INTO prescription_versions (
          id, prescription_id, version_number, status, reason_for_change, notes, created_by
        ) VALUES (?, ?, 1, 'ACTIVE', 'Initial draft', ?, ?)
      `).run(versionId, rxId, dto.notes ?? null, dto.createdBy ?? null);

      // 3. Insert Items
      const insertItem = raw.prepare(`
        INSERT INTO prescription_items (
          id, prescription_version_id, medicine_name, generic_name, strength,
          dosage_form, route, frequency, duration_value, duration_unit,
          instructions, quantity, is_substitution_allowed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of dto.items) {
        insertItem.run(
          crypto.randomUUID(),
          versionId,
          item.medicineName,
          item.genericName ?? null,
          item.strength ?? null,
          item.dosageForm,
          item.route,
          item.frequency,
          item.durationValue ?? null,
          item.durationUnit ?? 'DAYS',
          item.instructions ?? null,
          item.quantity ?? null,
          item.isSubstitutionAllowed !== false ? 1 : 0
        );
      }
    });

    const created = await this.findById(rxId, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created prescription ${rxId}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Prescription | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM prescriptions
      WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as PrescriptionRow | undefined;

    if (!row) return null;

    // Get current version
    const versionRow = raw.prepare(`
      SELECT * FROM prescription_versions
      WHERE prescription_id = ? AND version_number = ?
    `).get(id, row.current_version_number) as PrescriptionVersionRow | undefined;

    let currentVersion: PrescriptionVersion | undefined;
    if (versionRow) {
      currentVersion = this.getVersionWithItems(versionRow.id) ?? undefined;
    }

    return this.mapPrescriptionRow(row, currentVersion);
  }

  public async findByVisitId(visitId: string, organizationId: string): Promise<Prescription | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM prescriptions
      WHERE clinical_visit_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(visitId, organizationId) as PrescriptionRow | undefined;

    if (!row) return null;
    return this.findById(row.id, organizationId);
  }

  public async listByPatient(patientId: string, organizationId: string, limit = 50): Promise<Prescription[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM prescriptions
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(patientId, organizationId, limit) as PrescriptionRow[];

    const results: Prescription[] = [];
    for (const r of rows) {
      const p = await this.findById(r.id, organizationId);
      if (p) results.push(p);
    }
    return results;
  }

  public async sign(id: string, organizationId: string, signedBy: string): Promise<Prescription> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE prescriptions
      SET
        status = 'SIGNED',
        signed_at = CURRENT_TIMESTAMP,
        signed_by = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(signedBy, signedBy, id, organizationId);

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async revise(dto: RevisePrescriptionDTO, organizationId: string): Promise<Prescription> {
    const existing = await this.findById(dto.prescriptionId, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(dto.prescriptionId);
    }

    const raw = this.db.getRawDb();
    const nextVersionNumber = existing.currentVersionNumber + 1;
    const newVersionId = crypto.randomUUID();

    this.db.transaction(() => {
      // 1. Mark previous active versions SUPERSEDED
      raw.prepare(`
        UPDATE prescription_versions
        SET status = 'SUPERSEDED'
        WHERE prescription_id = ? AND status = 'ACTIVE'
      `).run(dto.prescriptionId);

      // 2. Insert new version
      raw.prepare(`
        INSERT INTO prescription_versions (
          id, prescription_id, version_number, status, reason_for_change, notes, created_by
        ) VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?)
      `).run(
        newVersionId,
        dto.prescriptionId,
        nextVersionNumber,
        dto.reasonForChange,
        dto.notes ?? null,
        dto.updatedBy ?? null
      );

      // 3. Insert items for new version
      const insertItem = raw.prepare(`
        INSERT INTO prescription_items (
          id, prescription_version_id, medicine_name, generic_name, strength,
          dosage_form, route, frequency, duration_value, duration_unit,
          instructions, quantity, is_substitution_allowed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of dto.items) {
        insertItem.run(
          crypto.randomUUID(),
          newVersionId,
          item.medicineName,
          item.genericName ?? null,
          item.strength ?? null,
          item.dosageForm,
          item.route,
          item.frequency,
          item.durationValue ?? null,
          item.durationUnit ?? 'DAYS',
          item.instructions ?? null,
          item.quantity ?? null,
          item.isSubstitutionAllowed !== false ? 1 : 0
        );
      }

      // 4. Update prescription parent current version number
      raw.prepare(`
        UPDATE prescriptions
        SET
          current_version_number = ?,
          status = 'SIGNED',
          signed_at = CURRENT_TIMESTAMP,
          signed_by = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(nextVersionNumber, dto.updatedBy ?? null, dto.updatedBy ?? null, dto.prescriptionId, organizationId);
    });

    const updated = await this.findById(dto.prescriptionId, organizationId);
    return updated!;
  }

  public async cancel(id: string, organizationId: string, cancelledBy: string, reason?: string): Promise<Prescription> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    this.db.transaction(() => {
      raw.prepare(`
        UPDATE prescriptions
        SET
          status = 'CANCELLED',
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?
      `).run(cancelledBy, id, organizationId);

      raw.prepare(`
        UPDATE prescription_versions
        SET status = 'CANCELLED', reason_for_change = COALESCE(?, reason_for_change)
        WHERE prescription_id = ? AND version_number = ?
      `).run(reason ?? null, id, existing.currentVersionNumber);
    });

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async getVersions(prescriptionId: string, organizationId: string): Promise<PrescriptionVersion[]> {
    const existing = await this.findById(prescriptionId, organizationId);
    if (!existing) {
      throw new PrescriptionNotFoundError(prescriptionId);
    }

    const raw = this.db.getRawDb();
    const vRows = raw.prepare(`
      SELECT * FROM prescription_versions
      WHERE prescription_id = ?
      ORDER BY version_number ASC
    `).all(prescriptionId) as PrescriptionVersionRow[];

    const versions: PrescriptionVersion[] = [];
    for (const v of vRows) {
      const fullV = this.getVersionWithItems(v.id);
      if (fullV) versions.push(fullV);
    }
    return versions;
  }
}
