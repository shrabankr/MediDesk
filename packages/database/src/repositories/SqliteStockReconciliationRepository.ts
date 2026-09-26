import {
  StockReconciliationSession,
  StockReconciliationItem,
  CreateReconciliationSessionDTO,
  AddReconciliationItemDTO,
  IStockReconciliationRepository,
  ReconciliationStatus,
  VarianceReason
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';
import crypto from 'crypto';

export class SqliteStockReconciliationRepository implements IStockReconciliationRepository {
  constructor(private db: SqliteDatabase) {}

  async createSession(dto: CreateReconciliationSessionDTO): Promise<StockReconciliationSession> {
    const raw = this.db.getRawDb();
    const id = dto.id || crypto.randomUUID();
    const now = new Date().toISOString();

    // Generate readable session number if not provided: REC-YYYYMMDD-XXXX
    let sessionNum = dto.sessionNumber;
    if (!sessionNum) {
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countRow = raw
        .prepare(`SELECT COUNT(*) as cnt FROM stock_reconciliation_sessions WHERE organization_id = ?`)
        .get(dto.organizationId) as { cnt: number };
      const nextNum = (countRow.cnt + 1).toString().padStart(4, '0');
      sessionNum = `REC-${datePart}-${nextNum}`;
    }

    raw.prepare(
      `INSERT INTO stock_reconciliation_sessions (
        id, organization_id, session_number, status, notes,
        counted_by, counted_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)`
    ).run(
      id,
      dto.organizationId,
      sessionNum,
      dto.notes || null,
      dto.countedBy,
      now,
      now,
      now
    );

    const session = await this.findSessionById(id, dto.organizationId);
    if (!session) throw new Error(`Failed to create stock reconciliation session ${id}`);
    return session;
  }

  async findSessionById(id: string, organizationId: string): Promise<StockReconciliationSession | null> {
    const raw = this.db.getRawDb();
    const row = raw
      .prepare(
        `SELECT s.*, u.full_name as counted_by_name
         FROM stock_reconciliation_sessions s
         LEFT JOIN users u ON s.counted_by = u.id
         WHERE s.id = ? AND s.organization_id = ?`
      )
      .get(id, organizationId) as any;

    if (!row) return null;

    const items = await this.getItemsBySession(id);
    return this.mapSessionRow(row, items);
  }

  async findSessionByNumber(sessionNumber: string, organizationId: string): Promise<StockReconciliationSession | null> {
    const raw = this.db.getRawDb();
    const row = raw
      .prepare(
        `SELECT s.*, u.full_name as counted_by_name
         FROM stock_reconciliation_sessions s
         LEFT JOIN users u ON s.counted_by = u.id
         WHERE s.session_number = ? AND s.organization_id = ?`
      )
      .get(sessionNumber, organizationId) as any;

    if (!row) return null;

    const items = await this.getItemsBySession(row.id);
    return this.mapSessionRow(row, items);
  }

  async listSessions(organizationId: string, limit = 50): Promise<StockReconciliationSession[]> {
    const raw = this.db.getRawDb();
    const rows = raw
      .prepare(
        `SELECT s.*, u.full_name as counted_by_name
         FROM stock_reconciliation_sessions s
         LEFT JOIN users u ON s.counted_by = u.id
         WHERE s.organization_id = ?
         ORDER BY s.created_at DESC
         LIMIT ?`
      )
      .all(organizationId, limit) as any[];

    const sessions: StockReconciliationSession[] = [];
    for (const r of rows) {
      const items = await this.getItemsBySession(r.id);
      sessions.push(this.mapSessionRow(r, items));
    }
    return sessions;
  }

  async addItem(
    item: AddReconciliationItemDTO,
    systemQuantity: number,
    _batchNumber: string,
    _expiryDate: string,
    _productName?: string
  ): Promise<StockReconciliationItem> {
    const raw = this.db.getRawDb();
    const id = item.id || crypto.randomUUID();
    const varianceQty = item.physicalStockQuantity - systemQuantity;
    const isLarge = Math.abs(varianceQty) >= 20 || (systemQuantity > 0 && Math.abs(varianceQty) / systemQuantity >= 0.2);
    const now = new Date().toISOString();

    raw.prepare(
      `INSERT INTO stock_reconciliation_items (
        id, session_id, organization_id, product_id, batch_id,
        system_stock_quantity, physical_stock_quantity, variance_quantity,
        variance_reason, notes, packaging_unit_name, packaging_unit_quantity,
        is_large_variance, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      item.sessionId,
      item.organizationId,
      item.productId,
      item.batchId,
      systemQuantity,
      item.physicalStockQuantity,
      varianceQty,
      item.varianceReason || 'AUDIT_CORRECTION',
      item.notes || null,
      item.packagingUnitName || null,
      item.packagingUnitQuantity || null,
      isLarge ? 1 : 0,
      now,
      now
    );

    const saved = raw
      .prepare(
        `SELECT i.*, p.brand_name as product_name, b.batch_number, b.expiry_date
         FROM stock_reconciliation_items i
         JOIN medicine_products p ON i.product_id = p.id
         JOIN inventory_batches b ON i.batch_id = b.id
         WHERE i.id = ?`
      )
      .get(id) as any;

    return this.mapItemRow(saved);
  }

  async updateItem(
    itemId: string,
    physicalQty: number,
    varianceQty: number,
    varianceReason: VarianceReason,
    isLargeVariance: boolean,
    notes?: string,
    unitName?: string,
    unitQty?: number
  ): Promise<StockReconciliationItem> {
    const raw = this.db.getRawDb();
    const now = new Date().toISOString();

    raw.prepare(
      `UPDATE stock_reconciliation_items
       SET physical_stock_quantity = ?, variance_quantity = ?, variance_reason = ?,
           is_large_variance = ?, notes = ?, packaging_unit_name = ?, packaging_unit_quantity = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      physicalQty,
      varianceQty,
      varianceReason,
      isLargeVariance ? 1 : 0,
      notes || null,
      unitName || null,
      unitQty || null,
      now,
      itemId
    );

    const updated = raw
      .prepare(
        `SELECT i.*, p.brand_name as product_name, b.batch_number, b.expiry_date
         FROM stock_reconciliation_items i
         JOIN medicine_products p ON i.product_id = p.id
         JOIN inventory_batches b ON i.batch_id = b.id
         WHERE i.id = ?`
      )
      .get(itemId) as any;

    return this.mapItemRow(updated);
  }

  async deleteItem(itemId: string, sessionId: string): Promise<boolean> {
    const raw = this.db.getRawDb();
    const res = raw.prepare(`DELETE FROM stock_reconciliation_items WHERE id = ? AND session_id = ?`).run(itemId, sessionId);
    return res.changes > 0;
  }

  async updateSessionStatus(
    id: string,
    organizationId: string,
    status: ReconciliationStatus,
    metadata?: {
      submittedBy?: string;
      submittedAt?: Date;
      reviewedBy?: string;
      reviewedAt?: Date;
      reviewNotes?: string;
      postedAt?: Date;
    }
  ): Promise<StockReconciliationSession> {
    const raw = this.db.getRawDb();
    const now = new Date().toISOString();

    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];

    if (metadata?.submittedBy) {
      updates.push('submitted_by = ?');
      params.push(metadata.submittedBy);
    }
    if (metadata?.submittedAt) {
      updates.push('submitted_at = ?');
      params.push(metadata.submittedAt.toISOString());
    }
    if (metadata?.reviewedBy) {
      updates.push('reviewed_by = ?');
      params.push(metadata.reviewedBy);
    }
    if (metadata?.reviewedAt) {
      updates.push('reviewed_at = ?');
      params.push(metadata.reviewedAt.toISOString());
    }
    if (metadata?.reviewNotes !== undefined) {
      updates.push('review_notes = ?');
      params.push(metadata.reviewNotes);
    }
    if (metadata?.postedAt) {
      updates.push('posted_at = ?');
      params.push(metadata.postedAt.toISOString());
    }

    params.push(id, organizationId);
    raw.prepare(`UPDATE stock_reconciliation_sessions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`).run(...params);

    const session = await this.findSessionById(id, organizationId);
    if (!session) throw new Error(`Stock reconciliation session not found: ${id}`);
    return session;
  }

  private async getItemsBySession(sessionId: string): Promise<StockReconciliationItem[]> {
    const raw = this.db.getRawDb();
    const rows = raw
      .prepare(
        `SELECT i.*, p.brand_name as product_name, b.batch_number, b.expiry_date
         FROM stock_reconciliation_items i
         JOIN medicine_products p ON i.product_id = p.id
         JOIN inventory_batches b ON i.batch_id = b.id
         WHERE i.session_id = ?
         ORDER BY p.brand_name ASC, b.expiry_date ASC`
      )
      .all(sessionId) as any[];

    return rows.map((r) => this.mapItemRow(r));
  }

  private mapSessionRow(row: any, items: StockReconciliationItem[]): StockReconciliationSession {
    return {
      id: row.id,
      organizationId: row.organization_id,
      sessionNumber: row.session_number,
      status: row.status as ReconciliationStatus,
      notes: row.notes || undefined,
      countedBy: row.counted_by,
      countedByName: row.counted_by_name || undefined,
      countedAt: row.counted_at ? new Date(row.counted_at) : undefined,
      submittedBy: row.submitted_by || undefined,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
      reviewedBy: row.reviewed_by || undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewNotes: row.review_notes || undefined,
      postedAt: row.posted_at ? new Date(row.posted_at) : undefined,
      items,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private mapItemRow(row: any): StockReconciliationItem {
    return {
      id: row.id,
      sessionId: row.session_id,
      organizationId: row.organization_id,
      productId: row.product_id,
      productName: row.product_name,
      batchId: row.batch_id,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      systemStockQuantity: Number(row.system_stock_quantity),
      physicalStockQuantity: Number(row.physical_stock_quantity),
      varianceQuantity: Number(row.variance_quantity),
      varianceReason: row.variance_reason as VarianceReason,
      notes: row.notes || undefined,
      packagingUnitName: row.packaging_unit_name || undefined,
      packagingUnitQuantity: row.packaging_unit_quantity != null ? Number(row.packaging_unit_quantity) : undefined,
      isLargeVariance: Boolean(row.is_large_variance),
      postedStockMovementId: row.posted_stock_movement_id || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
