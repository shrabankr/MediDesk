import crypto from 'crypto';
import {
  TaxRule,
  CreateTaxRuleDTO,
  ITaxRuleRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface TaxRuleRow {
  id: string;
  organization_id: string;
  tax_name: string;
  rate_percent: number;
  cgst_percent: number;
  sgst_percent: number;
  igst_percent: number;
  is_active: number;
  created_at: string;
  created_by: string | null;
}

export class SqliteTaxRuleRepository implements ITaxRuleRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: TaxRuleRow): TaxRule {
    return {
      id: row.id,
      organizationId: row.organization_id,
      taxName: row.tax_name,
      ratePercent: row.rate_percent,
      cgstPercent: row.cgst_percent,
      sgstPercent: row.sgst_percent,
      igstPercent: row.igst_percent,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by ?? undefined
    };
  }

  public async create(dto: CreateTaxRuleDTO): Promise<TaxRule> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();
    const halfRate = dto.ratePercent / 2;

    raw.prepare(`
      INSERT INTO tax_rules (
        id, organization_id, tax_name, rate_percent,
        cgst_percent, sgst_percent, igst_percent, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      dto.organizationId,
      dto.taxName.trim(),
      dto.ratePercent,
      dto.cgstPercent ?? halfRate,
      dto.sgstPercent ?? halfRate,
      dto.igstPercent ?? dto.ratePercent,
      dto.createdBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created tax rule ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<TaxRule | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM tax_rules WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as TaxRuleRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async list(organizationId: string): Promise<TaxRule[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM tax_rules WHERE organization_id = ? ORDER BY rate_percent ASC
    `).all(organizationId) as TaxRuleRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, isActive: boolean): Promise<TaxRule> {
    const raw = this.db.getRawDb();
    raw.prepare(`
      UPDATE tax_rules SET is_active = ? WHERE id = ? AND organization_id = ?
    `).run(isActive ? 1 : 0, id, organizationId);

    const updated = await this.findById(id, organizationId);
    return updated!;
  }
}
