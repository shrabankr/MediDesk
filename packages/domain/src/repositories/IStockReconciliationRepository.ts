import {
  StockReconciliationSession,
  StockReconciliationItem,
  CreateReconciliationSessionDTO,
  AddReconciliationItemDTO,
  ReconciliationStatus,
  VarianceReason
} from '../entities/StockReconciliation.js';

export interface IStockReconciliationRepository {
  createSession(dto: CreateReconciliationSessionDTO): Promise<StockReconciliationSession>;
  findSessionById(id: string, organizationId: string): Promise<StockReconciliationSession | null>;
  findSessionByNumber(sessionNumber: string, organizationId: string): Promise<StockReconciliationSession | null>;
  listSessions(organizationId: string, limit?: number): Promise<StockReconciliationSession[]>;
  addItem(
    item: AddReconciliationItemDTO,
    systemQuantity: number,
    batchNumber: string,
    expiryDate: string,
    productName?: string
  ): Promise<StockReconciliationItem>;
  updateItem(
    itemId: string,
    physicalQty: number,
    varianceQty: number,
    varianceReason: VarianceReason,
    isLargeVariance: boolean,
    notes?: string,
    unitName?: string,
    unitQty?: number
  ): Promise<StockReconciliationItem>;
  deleteItem(itemId: string, sessionId: string): Promise<boolean>;
  updateSessionStatus(
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
  ): Promise<StockReconciliationSession>;
}
