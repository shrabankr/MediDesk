import {
  ProductPackagingUnit,
  CreateProductPackagingUnitDTO,
  UpdateProductPackagingUnitDTO,
  IPackagingUnitRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';
import crypto from 'crypto';

export class SqlitePackagingUnitRepository implements IPackagingUnitRepository {
  constructor(private db: SqliteDatabase) {}

  async create(dto: CreateProductPackagingUnitDTO): Promise<ProductPackagingUnit> {
    const raw = this.db.getRawDb();
    const id = dto.id || crypto.randomUUID();
    const isDefault = dto.isDefaultSaleUnit ? 1 : 0;

    const tx = raw.transaction(() => {
      if (isDefault) {
        // Reset default for other packaging units of the same product
        raw.prepare(
          `UPDATE product_packaging_units SET is_default_sale_unit = 0 WHERE product_id = ?`
        ).run(dto.productId);
      }

      raw.prepare(
        `INSERT INTO product_packaging_units (
          id, organization_id, product_id, unit_name, conversion_factor,
          sale_price_paise, mrp_paise, barcode, is_default_sale_unit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        dto.organizationId,
        dto.productId,
        dto.unitName.toUpperCase(),
        dto.conversionFactor,
        dto.salePricePaise,
        dto.mrpPaise,
        dto.barcode || null,
        isDefault
      );
    });

    tx();

    const created = await this.findById(id);
    if (!created) throw new Error(`Failed to create packaging unit ${id}`);
    return created;
  }

  async findById(id: string): Promise<ProductPackagingUnit | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`SELECT * FROM product_packaging_units WHERE id = ?`).get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  async findByProduct(productId: string): Promise<ProductPackagingUnit[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(
      `SELECT * FROM product_packaging_units WHERE product_id = ? ORDER BY conversion_factor ASC`
    ).all(productId) as any[];
    return rows.map((r: any) => this.mapRow(r));
  }

  async findByBarcode(organizationId: string, barcode: string): Promise<ProductPackagingUnit | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(
      `SELECT * FROM product_packaging_units WHERE organization_id = ? AND barcode = ?`
    ).get(organizationId, barcode) as any;
    return row ? this.mapRow(row) : null;
  }

  async findByUnitName(productId: string, unitName: string): Promise<ProductPackagingUnit | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(
      `SELECT * FROM product_packaging_units WHERE product_id = ? AND unit_name = ? COLLATE NOCASE`
    ).get(productId, unitName) as any;
    return row ? this.mapRow(row) : null;
  }

  async update(id: string, dto: UpdateProductPackagingUnitDTO): Promise<ProductPackagingUnit> {
    const raw = this.db.getRawDb();
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Packaging unit ${id} not found`);

    const fields: string[] = [];
    const params: any[] = [];

    if (dto.unitName !== undefined) {
      fields.push(`unit_name = ?`);
      params.push(dto.unitName.toUpperCase());
    }
    if (dto.conversionFactor !== undefined) {
      fields.push(`conversion_factor = ?`);
      params.push(dto.conversionFactor);
    }
    if (dto.salePricePaise !== undefined) {
      fields.push(`sale_price_paise = ?`);
      params.push(dto.salePricePaise);
    }
    if (dto.mrpPaise !== undefined) {
      fields.push(`mrp_paise = ?`);
      params.push(dto.mrpPaise);
    }
    if (dto.barcode !== undefined) {
      fields.push(`barcode = ?`);
      params.push(dto.barcode);
    }
    if (dto.isDefaultSaleUnit !== undefined) {
      fields.push(`is_default_sale_unit = ?`);
      params.push(dto.isDefaultSaleUnit ? 1 : 0);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const tx = raw.transaction(() => {
      if (dto.isDefaultSaleUnit) {
        raw.prepare(
          `UPDATE product_packaging_units SET is_default_sale_unit = 0 WHERE product_id = ?`
        ).run(existing.productId);
      }
      raw.prepare(`UPDATE product_packaging_units SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    });

    tx();

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Packaging unit ${id} not found after update`);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const raw = this.db.getRawDb();
    const result = raw.prepare(`DELETE FROM product_packaging_units WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  private mapRow(row: any): ProductPackagingUnit {
    return {
      id: row.id,
      organizationId: row.organization_id,
      productId: row.product_id,
      unitName: row.unit_name,
      conversionFactor: row.conversion_factor,
      salePricePaise: row.sale_price_paise,
      mrpPaise: row.mrp_paise,
      barcode: row.barcode || undefined,
      isDefaultSaleUnit: row.is_default_sale_unit === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
