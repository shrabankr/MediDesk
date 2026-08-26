export type BatchStatus = 'ACTIVE' | 'EXPIRED' | 'DEPLETED' | 'QUARANTINED';

export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'SALE_RETURN'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'EXPIRED_DISCARD'
  | 'DAMAGED_WRITE_OFF';

export interface InventoryBatch {
  id: string;
  organizationId: string;
  productId: string;
  productName?: string;
  genericName?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  purchasePricePerUnit: number;
  mrpPerUnit: number;
  salePricePerUnit: number;
  currentStockQuantity: number; // in base units
  supplierId?: string;
  purchaseItemId?: string;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryBatchDTO {
  id?: string;
  organizationId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  purchasePricePerUnit: number;
  mrpPerUnit: number;
  salePricePerUnit: number;
  initialStockQuantity: number;
  supplierId?: string;
  purchaseItemId?: string;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  productId: string;
  batchId: string;
  movementType: StockMovementType;
  quantityChange: number;
  balanceAfter: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface CreateStockMovementDTO {
  id?: string;
  organizationId: string;
  productId: string;
  batchId: string;
  movementType: StockMovementType;
  quantityChange: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
}

export interface StockAdjustmentDTO {
  organizationId: string;
  productId: string;
  batchId: string;
  adjustedQuantity: number; // Absolute new quantity or delta
  isDelta?: boolean;
  reason: string;
  movementType?: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'EXPIRED_DISCARD' | 'DAMAGED_WRITE_OFF';
  adjustedBy: string;
}

export interface FefoAllocationItem {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  allocatedQuantity: number;
  salePricePerUnit: number;
  mrpPerUnit: number;
}

export interface FefoAllocationResult {
  productId: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  allocations: FefoAllocationItem[];
  isFullyAllocated: boolean;
}
