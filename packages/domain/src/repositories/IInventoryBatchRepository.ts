import { InventoryBatch, CreateInventoryBatchDTO } from '../entities/Inventory.js';

export interface IInventoryBatchRepository {
  create(dto: CreateInventoryBatchDTO): Promise<InventoryBatch>;
  upsertBatch(dto: CreateInventoryBatchDTO): Promise<InventoryBatch>;
  findById(id: string, organizationId: string): Promise<InventoryBatch | null>;
  findByProduct(productId: string, organizationId: string): Promise<InventoryBatch[]>;
  findValidFefoBatches(productId: string, organizationId: string): Promise<InventoryBatch[]>;
  updateQuantity(batchId: string, organizationId: string, newQuantity: number): Promise<InventoryBatch>;
  listExpiringSoon(organizationId: string, withinDays: number): Promise<InventoryBatch[]>;
  listExpired(organizationId: string): Promise<InventoryBatch[]>;
  listLowStock(organizationId: string): Promise<Array<{ product: any; totalStock: number; minStock: number }>>;
}
