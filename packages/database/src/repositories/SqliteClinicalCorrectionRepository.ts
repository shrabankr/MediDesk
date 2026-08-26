import crypto from 'crypto';
import {
  ClinicalCorrection,
  ClinicalCorrectionResourceType,
  RecordClinicalCorrectionDTO,
  IClinicalCorrectionRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface ClinicalCorrectionRow {
  id: string;
  organization_id: string;
  resource_type: string;
  resource_id: string;
  prior_state_json: string;
  corrected_state_json: string;
  reason: string;
  requested_by: string;
  approved_by: string | null;
  created_at: string;
}

export class SqliteClinicalCorrectionRepository implements IClinicalCorrectionRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: ClinicalCorrectionRow): ClinicalCorrection {
    return {
      id: row.id,
      organizationId: row.organization_id,
      resourceType: row.resource_type as ClinicalCorrectionResourceType,
      resourceId: row.resource_id,
      priorStateJson: row.prior_state_json,
      correctedStateJson: row.corrected_state_json,
      reason: row.reason,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by ?? undefined,
      createdAt: new Date(row.created_at)
    };
  }

  public async create(dto: RecordClinicalCorrectionDTO): Promise<ClinicalCorrection> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO clinical_corrections (
        id, organization_id, resource_type, resource_id,
        prior_state_json, corrected_state_json, reason,
        requested_by, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.resourceType,
      dto.resourceId,
      dto.priorStateJson,
      dto.correctedStateJson,
      dto.reason,
      dto.requestedBy,
      dto.approvedBy ?? null
    );

    const row = raw.prepare(`
      SELECT * FROM clinical_corrections WHERE id = ?
    `).get(id) as ClinicalCorrectionRow | undefined;

    if (!row) {
      throw new Error(`Failed to retrieve created clinical correction ${id}`);
    }
    return this.mapRow(row);
  }

  public async listByResource(resourceType: string, resourceId: string, organizationId: string): Promise<ClinicalCorrection[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM clinical_corrections
      WHERE resource_type = ? AND resource_id = ? AND organization_id = ?
      ORDER BY created_at DESC
    `).all(resourceType, resourceId, organizationId) as ClinicalCorrectionRow[];

    return rows.map((r) => this.mapRow(r));
  }
}
