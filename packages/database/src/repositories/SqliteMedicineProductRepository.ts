import crypto from 'crypto';
import {
  MedicineProduct,
  DosageForm,
  CreateMedicineProductDTO,
  UpdateMedicineProductDTO,
  IMedicineProductRepository,
  MedicineProductNotFoundError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface MedicineProductRow {
  id: string;
  organization_id: string;
  medicine_id: string;
  manufacturer_id: string | null;
  brand_name: string;
  product_code: string | null;
  barcode: string | null;
  strength: string;
  dosage_form: string;
  pack_size: string;
  pack_quantity: number;
  unit_of_measure: string;
  hsn_code: string | null;
  tax_rate_percent: number;
  min_stock_level: number;
  max_stock_level: number;
  reorder_quantity: number;
  is_active: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export class SqliteMedicineProductRepository implements IMedicineProductRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: MedicineProductRow): MedicineProduct {
    return {
      id: row.id,
      organizationId: row.organization_id,
      medicineId: row.medicine_id,
      manufacturerId: row.manufacturer_id ?? undefined,
      brandName: row.brand_name,
      productCode: row.product_code ?? undefined,
      barcode: row.barcode ?? undefined,
      strength: row.strength,
      dosageForm: row.dosage_form as DosageForm,
      packSize: row.pack_size,
      packQuantity: row.pack_quantity,
      unitOfMeasure: row.unit_of_measure,
      hsnCode: row.hsn_code ?? undefined,
      taxRatePercent: row.tax_rate_percent,
      minStockLevel: row.min_stock_level,
      maxStockLevel: row.max_stock_level,
      reorderQuantity: row.reorder_quantity,
      isActive: row.is_active === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by ?? undefined,
      updatedBy: row.updated_by ?? undefined
    };
  }

  public async create(dto: CreateMedicineProductDTO): Promise<MedicineProduct> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO medicine_products (
        id, organization_id, medicine_id, manufacturer_id, brand_name,
        product_code, barcode, strength, dosage_form, pack_size,
        pack_quantity, unit_of_measure, hsn_code, tax_rate_percent,
        min_stock_level, max_stock_level, reorder_quantity, is_active, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.medicineId,
      dto.manufacturerId ?? null,
      dto.brandName.trim(),
      dto.productCode?.trim() ?? null,
      dto.barcode?.trim() ?? null,
      dto.strength.trim(),
      dto.dosageForm,
      dto.packSize.trim(),
      dto.packQuantity,
      dto.unitOfMeasure?.trim() ?? 'PIECE',
      dto.hsnCode?.trim() ?? null,
      dto.taxRatePercent ?? 0.0,
      dto.minStockLevel ?? 10,
      dto.maxStockLevel ?? 1000,
      dto.reorderQuantity ?? 50,
      dto.createdBy ?? null,
      dto.createdBy ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created medicine product ${id}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<MedicineProduct | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM medicine_products WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as MedicineProductRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByBarcode(barcode: string, organizationId: string): Promise<MedicineProduct | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM medicine_products
      WHERE barcode = ? AND organization_id = ? AND is_active = 1
    `).get(barcode.trim(), organizationId) as MedicineProductRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async search(organizationId: string, query: string, limit = 20): Promise<MedicineProduct[]> {
    const raw = this.db.getRawDb();
    const term = `%${query.trim()}%`;
    const exact = query.trim();

    const rows = raw.prepare(`
      SELECT mp.* FROM medicine_products mp
      LEFT JOIN medicines m ON mp.medicine_id = m.id
      WHERE mp.organization_id = ?
        AND (
          mp.brand_name LIKE ?
          OR mp.barcode = ?
          OR mp.product_code LIKE ?
          OR m.generic_name LIKE ?
        )
        AND mp.is_active = 1
      ORDER BY mp.brand_name ASC
      LIMIT ?
    `).all(organizationId, term, exact, term, term, limit) as MedicineProductRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async findByMedicineId(medicineId: string, organizationId: string): Promise<MedicineProduct[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM medicine_products
      WHERE medicine_id = ? AND organization_id = ? AND is_active = 1
      ORDER BY brand_name ASC
    `).all(medicineId, organizationId) as MedicineProductRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async update(id: string, organizationId: string, dto: UpdateMedicineProductDTO): Promise<MedicineProduct> {
    const raw = this.db.getRawDb();
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new MedicineProductNotFoundError(id);
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (dto.manufacturerId !== undefined) {
      updates.push('manufacturer_id = ?');
      values.push(dto.manufacturerId);
    }
    if (dto.brandName !== undefined) {
      updates.push('brand_name = ?');
      values.push(dto.brandName.trim());
    }
    if (dto.productCode !== undefined) {
      updates.push('product_code = ?');
      values.push(dto.productCode?.trim() ?? null);
    }
    if (dto.barcode !== undefined) {
      updates.push('barcode = ?');
      values.push(dto.barcode?.trim() ?? null);
    }
    if (dto.strength !== undefined) {
      updates.push('strength = ?');
      values.push(dto.strength.trim());
    }
    if (dto.dosageForm !== undefined) {
      updates.push('dosage_form = ?');
      values.push(dto.dosageForm);
    }
    if (dto.packSize !== undefined) {
      updates.push('pack_size = ?');
      values.push(dto.packSize.trim());
    }
    if (dto.packQuantity !== undefined) {
      updates.push('pack_quantity = ?');
      values.push(dto.packQuantity);
    }
    if (dto.unitOfMeasure !== undefined) {
      updates.push('unit_of_measure = ?');
      values.push(dto.unitOfMeasure.trim());
    }
    if (dto.hsnCode !== undefined) {
      updates.push('hsn_code = ?');
      values.push(dto.hsnCode?.trim() ?? null);
    }
    if (dto.taxRatePercent !== undefined) {
      updates.push('tax_rate_percent = ?');
      values.push(dto.taxRatePercent);
    }
    if (dto.minStockLevel !== undefined) {
      updates.push('min_stock_level = ?');
      values.push(dto.minStockLevel);
    }
    if (dto.maxStockLevel !== undefined) {
      updates.push('max_stock_level = ?');
      values.push(dto.maxStockLevel);
    }
    if (dto.reorderQuantity !== undefined) {
      updates.push('reorder_quantity = ?');
      values.push(dto.reorderQuantity);
    }
    if (dto.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(dto.isActive ? 1 : 0);
    }
    if (dto.updatedBy !== undefined) {
      updates.push('updated_by = ?');
      values.push(dto.updatedBy);
    }

    updates.push("updated_at = datetime('now')");

    if (updates.length > 1) {
      values.push(id, organizationId);
      raw.prepare(`
        UPDATE medicine_products SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?
      `).run(...values);
    }

    const updated = await this.findById(id, organizationId);
    return updated!;
  }

  public async list(organizationId: string, limit = 50, offset = 0): Promise<MedicineProduct[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM medicine_products
      WHERE organization_id = ?
      ORDER BY brand_name ASC
      LIMIT ? OFFSET ?
    `).all(organizationId, limit, offset) as MedicineProductRow[];

    return rows.map((r) => this.mapRow(r));
  }
}
