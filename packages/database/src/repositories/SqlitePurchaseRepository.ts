import crypto from 'crypto';
import {
  PurchaseInvoice,
  PurchaseStatus,
  PurchasePaymentStatus,
  PurchaseItem,
  CreatePurchaseInvoiceDTO,
  IPurchaseRepository,
  PurchaseNotFoundError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface PurchaseRow {
  id: string;
  organization_id: string;
  supplier_id: string;
  supplier_name?: string;
  invoice_number: string;
  invoice_date: string;
  received_date: string;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  net_total: number;
  payment_status: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface PurchaseItemRow {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name?: string;
  batch_number: string;
  expiry_date: string;
  pack_quantity: number;
  free_pack_quantity: number;
  total_base_units: number;
  purchase_rate_per_pack: number;
  purchase_price_per_unit: number;
  mrp_per_unit: number;
  sale_price_per_unit: number;
  tax_rate_percent: number;
  tax_amount: number;
  total_amount: number;
}

export class SqlitePurchaseRepository implements IPurchaseRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapItemRow(row: PurchaseItemRow): PurchaseItem {
    return {
      id: row.id,
      purchaseId: row.purchase_id,
      productId: row.product_id,
      productName: row.product_name ?? undefined,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      packQuantity: row.pack_quantity,
      freePackQuantity: row.free_pack_quantity,
      totalBaseUnits: row.total_base_units,
      purchaseRatePerPack: row.purchase_rate_per_pack,
      purchasePricePerUnit: row.purchase_price_per_unit,
      mrpPerUnit: row.mrp_per_unit,
      salePricePerUnit: row.sale_price_per_unit,
      taxRatePercent: row.tax_rate_percent,
      taxAmount: row.tax_amount,
      totalAmount: row.total_amount
    };
  }

  private mapPurchaseRow(row: PurchaseRow, items: PurchaseItem[] = []): PurchaseInvoice {
    return {
      id: row.id,
      organizationId: row.organization_id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name ?? undefined,
      invoiceNumber: row.invoice_number,
      invoiceDate: row.invoice_date,
      receivedDate: row.received_date,
      grossAmount: row.gross_amount,
      discountAmount: row.discount_amount,
      taxAmount: row.tax_amount,
      netTotal: row.net_total,
      paymentStatus: row.payment_status as PurchasePaymentStatus,
      status: row.status as PurchaseStatus,
      notes: row.notes ?? undefined,
      items,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by
    };
  }

  public async create(dto: CreatePurchaseInvoiceDTO): Promise<PurchaseInvoice> {
    const purchaseId = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    this.db.transaction(() => {
      let grossAmount = 0;
      let taxAmount = 0;

      // 1. Initial Purchase Header
      raw.prepare(`
        INSERT INTO purchases (
          id, organization_id, supplier_id, invoice_number, invoice_date,
          received_date, gross_amount, discount_amount, tax_amount, net_total,
          payment_status, status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')), 0, ?, 0, 0, ?, 'RECEIVED', ?, ?)
      `).run(
        purchaseId,
        dto.organizationId,
        dto.supplierId,
        dto.invoiceNumber.trim(),
        dto.invoiceDate.trim(),
        dto.receivedDate?.trim() ?? null,
        dto.discountAmount ?? 0.0,
        dto.paymentStatus ?? 'PAID',
        dto.notes?.trim() ?? null,
        dto.createdBy
      );

      // 2. Insert Items, Update Batches & Insert Stock Movements
      const insertItem = raw.prepare(`
        INSERT INTO purchase_items (
          id, purchase_id, product_id, batch_number, expiry_date,
          pack_quantity, free_pack_quantity, total_base_units,
          purchase_rate_per_pack, purchase_price_per_unit, mrp_per_unit,
          sale_price_per_unit, tax_rate_percent, tax_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of dto.items) {
        const itemId = crypto.randomUUID();
        const totalPacks = item.packQuantity + (item.freePackQuantity ?? 0);
        const totalBaseUnits = totalPacks * item.packSizeMultiplier;
        const purchasePricePerUnit = item.purchaseRatePerPack / item.packSizeMultiplier;
        const salePricePerUnit = item.salePricePerUnit ?? item.mrpPerUnit;

        const lineGross = item.purchaseRatePerPack * item.packQuantity;
        const lineTax = lineGross * (item.taxRatePercent ?? 0.0) / 100;
        const lineTotal = lineGross + lineTax;

        grossAmount += lineGross;
        taxAmount += lineTax;

        insertItem.run(
          itemId,
          purchaseId,
          item.productId,
          item.batchNumber.trim(),
          item.expiryDate.trim(),
          item.packQuantity,
          item.freePackQuantity ?? 0,
          totalBaseUnits,
          item.purchaseRatePerPack,
          purchasePricePerUnit,
          item.mrpPerUnit,
          salePricePerUnit,
          item.taxRatePercent ?? 0.0,
          lineTax,
          lineTotal
        );

        // Upsert Inventory Batch
        const batchRow = raw.prepare(`
          SELECT * FROM inventory_batches
          WHERE organization_id = ? AND product_id = ? AND batch_number = ? AND expiry_date = ?
        `).get(dto.organizationId, item.productId, item.batchNumber.trim(), item.expiryDate.trim()) as any;

        let batchId: string;
        let newStock: number;

        if (batchRow) {
          batchId = batchRow.id;
          newStock = batchRow.current_stock_quantity + totalBaseUnits;
          raw.prepare(`
            UPDATE inventory_batches
            SET current_stock_quantity = ?,
                purchase_price_per_unit = ?,
                mrp_per_unit = ?,
                sale_price_per_unit = ?,
                supplier_id = ?,
                status = 'ACTIVE',
                updated_at = datetime('now')
            WHERE id = ?
          `).run(newStock, purchasePricePerUnit, item.mrpPerUnit, salePricePerUnit, dto.supplierId, batchId);
        } else {
          batchId = crypto.randomUUID();
          newStock = totalBaseUnits;
          raw.prepare(`
            INSERT INTO inventory_batches (
              id, organization_id, product_id, batch_number, expiry_date,
              purchase_price_per_unit, mrp_per_unit, sale_price_per_unit,
              current_stock_quantity, supplier_id, purchase_item_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
          `).run(
            batchId,
            dto.organizationId,
            item.productId,
            item.batchNumber.trim(),
            item.expiryDate.trim(),
            purchasePricePerUnit,
            item.mrpPerUnit,
            salePricePerUnit,
            totalBaseUnits,
            dto.supplierId,
            itemId
          );
        }

        // Insert Stock Movement
        raw.prepare(`
          INSERT INTO stock_movements (
            id, organization_id, product_id, batch_id, movement_type,
            quantity_change, balance_after, reference_type, reference_id,
            notes, created_by
          ) VALUES (?, ?, ?, ?, 'PURCHASE', ?, ?, 'PURCHASE_INVOICE', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          dto.organizationId,
          item.productId,
          batchId,
          totalBaseUnits,
          newStock,
          purchaseId,
          `Inward Purchase Inv #${dto.invoiceNumber}`,
          dto.createdBy
        );
      }

      const discount = dto.discountAmount ?? 0.0;
      const netTotal = grossAmount + taxAmount - discount;

      // Update final totals on purchases row
      raw.prepare(`
        UPDATE purchases
        SET gross_amount = ?, tax_amount = ?, net_total = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(grossAmount, taxAmount, netTotal, purchaseId);
    });

    const created = await this.findById(purchaseId, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created purchase invoice ${purchaseId}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<PurchaseInvoice | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ? AND p.organization_id = ?
    `).get(id, organizationId) as PurchaseRow | undefined;

    if (!row) return null;

    const itemRows = raw.prepare(`
      SELECT pi.*, mp.brand_name as product_name
      FROM purchase_items pi
      JOIN medicine_products mp ON pi.product_id = mp.id
      WHERE pi.purchase_id = ?
    `).all(id) as PurchaseItemRow[];

    return this.mapPurchaseRow(row, itemRows.map((r) => this.mapItemRow(r)));
  }

  public async findByInvoiceNumber(invoiceNumber: string, organizationId: string): Promise<PurchaseInvoice | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.invoice_number = ? AND p.organization_id = ?
    `).get(invoiceNumber.trim(), organizationId) as PurchaseRow | undefined;

    if (!row) return null;
    return this.findById(row.id, organizationId);
  }

  public async list(organizationId: string, limit = 50, offset = 0): Promise<PurchaseInvoice[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.organization_id = ?
      ORDER BY p.invoice_date DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(organizationId, limit, offset) as PurchaseRow[];

    return Promise.all(
      rows.map(async (r) => {
        const itemRows = raw.prepare(`
          SELECT pi.*, mp.brand_name as product_name
          FROM purchase_items pi
          JOIN medicine_products mp ON pi.product_id = mp.id
          WHERE pi.purchase_id = ?
        `).all(r.id) as PurchaseItemRow[];
        return this.mapPurchaseRow(r, itemRows.map((i) => this.mapItemRow(i)));
      })
    );
  }

  public async cancel(id: string, organizationId: string, cancelledBy: string): Promise<PurchaseInvoice> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new PurchaseNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    this.db.transaction(() => {
      // Revert inventory stock
      for (const item of existing.items) {
        const batch = raw.prepare(`
          SELECT * FROM inventory_batches
          WHERE organization_id = ? AND product_id = ? AND batch_number = ? AND expiry_date = ?
        `).get(organizationId, item.productId, item.batchNumber, item.expiryDate) as any;

        if (batch) {
          const newQty = Math.max(0, batch.current_stock_quantity - item.totalBaseUnits);
          raw.prepare(`
            UPDATE inventory_batches SET current_stock_quantity = ?, updated_at = datetime('now') WHERE id = ?
          `).run(newQty, batch.id);

          raw.prepare(`
            INSERT INTO stock_movements (
              id, organization_id, product_id, batch_id, movement_type,
              quantity_change, balance_after, reference_type, reference_id,
              notes, created_by
            ) VALUES (?, ?, ?, ?, 'PURCHASE_RETURN', ?, ?, 'PURCHASE_INVOICE', ?, 'Cancelled purchase invoice', ?)
          `).run(
            crypto.randomUUID(),
            organizationId,
            item.productId,
            batch.id,
            -item.totalBaseUnits,
            newQty,
            id,
            cancelledBy
          );
        }
      }

      raw.prepare(`
        UPDATE purchases SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ? AND organization_id = ?
      `).run(id, organizationId);
    });

    return (await this.findById(id, organizationId))!;
  }
}
