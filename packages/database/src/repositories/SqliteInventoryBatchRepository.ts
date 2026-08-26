import crypto from 'crypto';
import {
  InventoryBatch,
  BatchStatus,
  CreateInventoryBatchDTO,
  IInventoryBatchRepository,
  BatchNotFoundError,
  NegativeStockError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface InventoryBatchRow {
  id: string;
  organization_id: string;
  product_id: string;
  product_name?: string;
  generic_name?: string;
  batch_number: string;
  expiry_date: string;
  purchase_price_per_unit: number;
  mrp_per_unit: number;
  sale_price_per_unit: number;
  current_stock_quantity: number;
  supplier_id: string | null;
  purchase_item_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export class SqliteInventoryBatchRepository implements IInventoryBatchRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: InventoryBatchRow): InventoryBatch {
    return {
      id: row.id,
      organizationId: row.organization_id,
      productId: row.product_id,
      productName: row.product_name ?? undefined,
      genericName: row.generic_name ?? undefined,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      purchasePricePerUnit: row.purchase_price_per_unit,
      mrpPerUnit: row.mrp_per_unit,
      salePricePerUnit: row.sale_price_per_unit,
      currentStockQuantity: row.current_stock_quantity,
      supplierId: row.supplier_id ?? undefined,
      purchaseItemId: row.purchase_item_id ?? undefined,
      status: row.status as BatchStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  public async create(dto: CreateInventoryBatchDTO): Promise<InventoryBatch> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO inventory_batches (
        id, organization_id, product_id, batch_number, expiry_date,
        purchase_price_per_unit, mrp_per_unit, sale_price_per_unit,
        current_stock_quantity, supplier_id, purchase_item_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      id,
      dto.organizationId,
      dto.productId,
      dto.batchNumber.trim(),
      dto.expiryDate.trim(),
      dto.purchasePricePerUnit,
      dto.mrpPerUnit,
      dto.salePricePerUnit,
      dto.initialStockQuantity,
      dto.supplierId ?? null,
      dto.purchaseItemId ?? null
    );

    const created = await this.findById(id, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created batch ${id}`);
    }
    return created;
  }

  public async upsertBatch(dto: CreateInventoryBatchDTO): Promise<InventoryBatch> {
    const raw = this.db.getRawDb();

    // Check if an existing active batch with same product_id and batch_number exists in org
    const existing = raw.prepare(`
      SELECT * FROM inventory_batches
      WHERE organization_id = ? AND product_id = ? AND batch_number = ? AND expiry_date = ?
    `).get(dto.organizationId, dto.productId, dto.batchNumber.trim(), dto.expiryDate.trim()) as InventoryBatchRow | undefined;

    if (existing) {
      const newQty = existing.current_stock_quantity + dto.initialStockQuantity;
      raw.prepare(`
        UPDATE inventory_batches
        SET current_stock_quantity = ?,
            purchase_price_per_unit = ?,
            mrp_per_unit = ?,
            sale_price_per_unit = ?,
            supplier_id = COALESCE(?, supplier_id),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newQty, dto.purchasePricePerUnit, dto.mrpPerUnit, dto.salePricePerUnit, dto.supplierId ?? null, existing.id);

      return (await this.findById(existing.id, dto.organizationId))!;
    }

    return this.create(dto);
  }

  public async findById(id: string, organizationId: string): Promise<InventoryBatch | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT b.*, mp.brand_name as product_name, m.generic_name as generic_name
      FROM inventory_batches b
      JOIN medicine_products mp ON b.product_id = mp.id
      JOIN medicines m ON mp.medicine_id = m.id
      WHERE b.id = ? AND b.organization_id = ?
    `).get(id, organizationId) as InventoryBatchRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  public async findByProduct(productId: string, organizationId: string): Promise<InventoryBatch[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT b.*, mp.brand_name as product_name, m.generic_name as generic_name
      FROM inventory_batches b
      JOIN medicine_products mp ON b.product_id = mp.id
      JOIN medicines m ON mp.medicine_id = m.id
      WHERE b.product_id = ? AND b.organization_id = ?
      ORDER BY b.expiry_date ASC
    `).all(productId, organizationId) as InventoryBatchRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async findValidFefoBatches(productId: string, organizationId: string): Promise<InventoryBatch[]> {
    const raw = this.db.getRawDb();
    const today = new Date().toISOString().split('T')[0];

    const rows = raw.prepare(`
      SELECT b.*, mp.brand_name as product_name, m.generic_name as generic_name
      FROM inventory_batches b
      JOIN medicine_products mp ON b.product_id = mp.id
      JOIN medicines m ON mp.medicine_id = m.id
      WHERE b.product_id = ?
        AND b.organization_id = ?
        AND b.status = 'ACTIVE'
        AND b.current_stock_quantity > 0
        AND b.expiry_date >= ?
      ORDER BY b.expiry_date ASC, b.created_at ASC
    `).all(productId, organizationId, today) as InventoryBatchRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async updateQuantity(batchId: string, organizationId: string, newQuantity: number): Promise<InventoryBatch> {
    if (newQuantity < 0) {
      throw new NegativeStockError(`Cannot set negative stock quantity (${newQuantity}) for batch ${batchId}.`);
    }

    const raw = this.db.getRawDb();
    const existing = await this.findById(batchId, organizationId);
    if (!existing) {
      throw new BatchNotFoundError(batchId);
    }

    const newStatus = newQuantity === 0 ? 'DEPLETED' : existing.status === 'DEPLETED' ? 'ACTIVE' : existing.status;

    raw.prepare(`
      UPDATE inventory_batches
      SET current_stock_quantity = ?,
          status = ?,
          updated_at = datetime('now')
      WHERE id = ? AND organization_id = ?
    `).run(newQuantity, newStatus, batchId, organizationId);

    const updated = await this.findById(batchId, organizationId);
    return updated!;
  }

  public async listExpiringSoon(organizationId: string, withinDays = 90): Promise<InventoryBatch[]> {
    const raw = this.db.getRawDb();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);
    const futureStr = futureDate.toISOString().split('T')[0];

    const rows = raw.prepare(`
      SELECT b.*, mp.brand_name as product_name, m.generic_name as generic_name
      FROM inventory_batches b
      JOIN medicine_products mp ON b.product_id = mp.id
      JOIN medicines m ON mp.medicine_id = m.id
      WHERE b.organization_id = ?
        AND b.current_stock_quantity > 0
        AND b.expiry_date >= ?
        AND b.expiry_date <= ?
      ORDER BY b.expiry_date ASC
    `).all(organizationId, todayStr, futureStr) as InventoryBatchRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listExpired(organizationId: string): Promise<InventoryBatch[]> {
    const raw = this.db.getRawDb();
    const todayStr = new Date().toISOString().split('T')[0];

    const rows = raw.prepare(`
      SELECT b.*, mp.brand_name as product_name, m.generic_name as generic_name
      FROM inventory_batches b
      JOIN medicine_products mp ON b.product_id = mp.id
      JOIN medicines m ON mp.medicine_id = m.id
      WHERE b.organization_id = ?
        AND b.current_stock_quantity > 0
        AND b.expiry_date < ?
      ORDER BY b.expiry_date ASC
    `).all(organizationId, todayStr) as InventoryBatchRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listLowStock(organizationId: string): Promise<Array<{ product: any; totalStock: number; minStock: number }>> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT
        mp.id as product_id,
        mp.brand_name,
        mp.strength,
        mp.dosage_form,
        mp.pack_size,
        mp.min_stock_level,
        COALESCE(SUM(b.current_stock_quantity), 0) as total_stock
      FROM medicine_products mp
      LEFT JOIN inventory_batches b ON mp.id = b.product_id AND b.status = 'ACTIVE'
      WHERE mp.organization_id = ? AND mp.is_active = 1
      GROUP BY mp.id
      HAVING total_stock <= mp.min_stock_level
      ORDER BY total_stock ASC
    `).all(organizationId) as any[];

    return rows.map((r) => ({
      product: {
        id: r.product_id,
        brandName: r.brand_name,
        strength: r.strength,
        dosageForm: r.dosage_form,
        packSize: r.pack_size
      },
      totalStock: r.total_stock,
      minStock: r.min_stock_level
    }));
  }
}
