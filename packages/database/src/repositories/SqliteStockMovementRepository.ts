import crypto from 'crypto';
import {
  StockMovement,
  StockMovementType,
  CreateStockMovementDTO,
  IStockMovementRepository
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface StockMovementRow {
  id: string;
  organization_id: string;
  product_id: string;
  batch_id: string;
  movement_type: string;
  quantity_change: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
}

export class SqliteStockMovementRepository implements IStockMovementRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapRow(row: StockMovementRow): StockMovement {
    return {
      id: row.id,
      organizationId: row.organization_id,
      productId: row.product_id,
      batchId: row.batch_id,
      movementType: row.movement_type as StockMovementType,
      quantityChange: row.quantity_change,
      balanceAfter: row.balance_after,
      referenceType: row.reference_type ?? undefined,
      referenceId: row.reference_id ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }

  public async create(dto: CreateStockMovementDTO & { balanceAfter: number }): Promise<StockMovement> {
    const id = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();

    raw.prepare(`
      INSERT INTO stock_movements (
        id, organization_id, product_id, batch_id, movement_type,
        quantity_change, balance_after, reference_type, reference_id,
        notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.productId,
      dto.batchId,
      dto.movementType,
      dto.quantityChange,
      dto.balanceAfter,
      dto.referenceType ?? null,
      dto.referenceId ?? null,
      dto.notes?.trim() ?? null,
      dto.createdBy
    );

    const row = raw.prepare(`
      SELECT * FROM stock_movements WHERE id = ? AND organization_id = ?
    `).get(id, dto.organizationId) as StockMovementRow;

    return this.mapRow(row);
  }

  public async findByBatch(batchId: string, organizationId: string): Promise<StockMovement[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM stock_movements
      WHERE batch_id = ? AND organization_id = ?
      ORDER BY created_at DESC
    `).all(batchId, organizationId) as StockMovementRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async findByProduct(productId: string, organizationId: string, limit = 50): Promise<StockMovement[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM stock_movements
      WHERE product_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(productId, organizationId, limit) as StockMovementRow[];

    return rows.map((r) => this.mapRow(r));
  }

  public async listRecent(organizationId: string, limit = 50): Promise<StockMovement[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM stock_movements
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(organizationId, limit) as StockMovementRow[];

    return rows.map((r) => this.mapRow(r));
  }
}
