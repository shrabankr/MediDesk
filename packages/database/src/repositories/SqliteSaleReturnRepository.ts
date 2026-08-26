import crypto from 'crypto';
import {
  SaleReturn,
  SaleReturnItem,
  CreateSaleReturnDTO,
  ISaleReturnRepository,
  SaleReturnError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface SaleReturnRow {
  id: string;
  organization_id: string;
  sale_id: string;
  return_number: string;
  return_date: string;
  reason: string;
  refund_amount: number;
  refund_mode: string;
  created_at: string;
  created_by: string;
}

interface SaleReturnItemRow {
  id: string;
  sale_return_id: string;
  sale_item_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  refund_amount: number;
}

export class SqliteSaleReturnRepository implements ISaleReturnRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapItemRow(row: SaleReturnItemRow): SaleReturnItem {
    return {
      id: row.id,
      saleReturnId: row.sale_return_id,
      saleItemId: row.sale_item_id,
      productId: row.product_id,
      batchId: row.batch_id,
      quantity: row.quantity,
      refundAmount: row.refund_amount
    };
  }

  private mapReturnRow(row: SaleReturnRow, items: SaleReturnItem[] = []): SaleReturn {
    return {
      id: row.id,
      organizationId: row.organization_id,
      saleId: row.sale_id,
      returnNumber: row.return_number,
      returnDate: new Date(row.return_date),
      reason: row.reason,
      refundAmount: row.refund_amount,
      refundMode: row.refund_mode,
      items,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }

  public async create(dto: CreateSaleReturnDTO & { returnNumber: string; refundAmount: number }): Promise<SaleReturn> {
    const returnId = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    this.db.transaction(() => {
      let totalRefund = 0;

      // 1. Insert Return Header
      raw.prepare(`
        INSERT INTO sale_returns (
          id, organization_id, sale_id, return_number, reason, refund_amount, refund_mode, created_by
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        returnId,
        dto.organizationId,
        dto.saleId,
        dto.returnNumber,
        dto.reason.trim(),
        dto.refundMode ?? 'CASH',
        dto.createdBy
      );

      // 2. Validate Items and Restore Stock
      const insertItem = raw.prepare(`
        INSERT INTO sale_return_items (
          id, sale_return_id, sale_item_id, product_id, batch_id, quantity, refund_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of dto.items) {
        const saleItem = raw.prepare(`
          SELECT * FROM sale_items WHERE id = ? AND sale_id = ?
        `).get(item.saleItemId, dto.saleId) as any;

        if (!saleItem) {
          throw new SaleReturnError(`Sale item "${item.saleItemId}" not found on original sale.`);
        }

        if (item.quantity > saleItem.quantity) {
          throw new SaleReturnError(`Cannot return ${item.quantity} units; only ${saleItem.quantity} were purchased.`);
        }

        const unitRefundPrice = saleItem.total_amount / saleItem.quantity;
        const lineRefund = unitRefundPrice * item.quantity;
        totalRefund += lineRefund;

        // Restore Batch Stock
        const batch = raw.prepare(`
          SELECT * FROM inventory_batches WHERE id = ?
        `).get(saleItem.batch_id) as any;

        if (batch) {
          const newQty = batch.current_stock_quantity + item.quantity;
          raw.prepare(`
            UPDATE inventory_batches SET current_stock_quantity = ?, status = 'ACTIVE', updated_at = datetime('now') WHERE id = ?
          `).run(newQty, batch.id);

          raw.prepare(`
            INSERT INTO stock_movements (
              id, organization_id, product_id, batch_id, movement_type,
              quantity_change, balance_after, reference_type, reference_id,
              notes, created_by
            ) VALUES (?, ?, ?, ?, 'SALE_RETURN', ?, ?, 'SALE_RETURN', ?, ?, ?)
          `).run(
            crypto.randomUUID(),
            dto.organizationId,
            saleItem.product_id,
            batch.id,
            item.quantity,
            newQty,
            returnId,
            `Customer Return #${dto.returnNumber}: ${dto.reason}`,
            dto.createdBy
          );
        }

        insertItem.run(
          crypto.randomUUID(),
          returnId,
          item.saleItemId,
          saleItem.product_id,
          saleItem.batch_id,
          item.quantity,
          lineRefund
        );
      }

      // Update refund total
      raw.prepare(`
        UPDATE sale_returns SET refund_amount = ? WHERE id = ?
      `).run(totalRefund, returnId);
    });

    const created = await this.findById(returnId, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created sale return ${returnId}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<SaleReturn | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM sale_returns WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as SaleReturnRow | undefined;

    if (!row) return null;

    const itemRows = raw.prepare(`
      SELECT * FROM sale_return_items WHERE sale_return_id = ?
    `).all(id) as SaleReturnItemRow[];

    return this.mapReturnRow(row, itemRows.map((r) => this.mapItemRow(r)));
  }

  public async findBySale(saleId: string, organizationId: string): Promise<SaleReturn[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM sale_returns WHERE sale_id = ? AND organization_id = ? ORDER BY return_date DESC
    `).all(saleId, organizationId) as SaleReturnRow[];

    return Promise.all(
      rows.map(async (r) => {
        const itemRows = raw.prepare(`
          SELECT * FROM sale_return_items WHERE sale_return_id = ?
        `).all(r.id) as SaleReturnItemRow[];
        return this.mapReturnRow(r, itemRows.map((i) => this.mapItemRow(i)));
      })
    );
  }

  public async list(organizationId: string, limit = 50, offset = 0): Promise<SaleReturn[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM sale_returns WHERE organization_id = ? ORDER BY return_date DESC LIMIT ? OFFSET ?
    `).all(organizationId, limit, offset) as SaleReturnRow[];

    return Promise.all(
      rows.map(async (r) => {
        const itemRows = raw.prepare(`
          SELECT * FROM sale_return_items WHERE sale_return_id = ?
        `).all(r.id) as SaleReturnItemRow[];
        return this.mapReturnRow(r, itemRows.map((i) => this.mapItemRow(i)));
      })
    );
  }
}
