import { StockMovement, CreateStockMovementDTO } from '../entities/Inventory.js';

export interface IStockMovementRepository {
  create(dto: CreateStockMovementDTO & { balanceAfter: number }): Promise<StockMovement>;
  findByBatch(batchId: string, organizationId: string): Promise<StockMovement[]>;
  findByProduct(productId: string, organizationId: string, limit?: number): Promise<StockMovement[]>;
  listRecent(organizationId: string, limit?: number): Promise<StockMovement[]>;
}
