export type ReconciliationStatus =
  | 'DRAFT'
  | 'COUNTED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED';

export type VarianceReason =
  | 'DAMAGE'
  | 'EXPIRY_DISPOSAL'
  | 'SHRINKAGE'
  | 'AUDIT_CORRECTION'
  | 'OTHER';

export interface StockReconciliationItem {
  id: string;
  sessionId: string;
  organizationId: string;
  productId: string;
  productName?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  systemStockQuantity: number; // In base units at count time
  physicalStockQuantity: number; // In base units
  varianceQuantity: number; // physicalStockQuantity - systemStockQuantity
  varianceReason: VarianceReason;
  notes?: string;
  packagingUnitName?: string;
  packagingUnitQuantity?: number;
  isLargeVariance: boolean;
  postedStockMovementId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockReconciliationSession {
  id: string;
  organizationId: string;
  sessionNumber: string;
  status: ReconciliationStatus;
  notes?: string;
  countedBy: string;
  countedByName?: string;
  countedAt?: Date;
  submittedBy?: string;
  submittedAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  postedAt?: Date;
  items: StockReconciliationItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReconciliationSessionDTO {
  id?: string;
  organizationId: string;
  sessionNumber?: string;
  notes?: string;
  countedBy: string;
}

export interface AddReconciliationItemDTO {
  id?: string;
  sessionId: string;
  organizationId: string;
  productId: string;
  batchId: string;
  physicalStockQuantity: number; // in base units
  varianceReason?: VarianceReason;
  notes?: string;
  packagingUnitName?: string;
  packagingUnitQuantity?: number;
}

export interface UpdateReconciliationItemDTO {
  itemId: string;
  physicalStockQuantity: number;
  varianceReason: VarianceReason;
  notes?: string;
  packagingUnitName?: string;
  packagingUnitQuantity?: number;
}

export interface ReviewReconciliationDTO {
  sessionId: string;
  action: 'APPROVE' | 'REJECT';
  reviewNotes?: string;
  reviewerId: string;
}
