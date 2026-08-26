export type PurchaseStatus = 'RECEIVED' | 'CANCELLED';
export type PurchasePaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL';

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  productName?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  packQuantity: number;
  freePackQuantity: number;
  totalBaseUnits: number;
  purchaseRatePerPack: number;
  purchasePricePerUnit: number;
  mrpPerUnit: number;
  salePricePerUnit: number;
  taxRatePercent: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CreatePurchaseItemDTO {
  productId: string;
  batchNumber: string;
  expiryDate: string;
  packQuantity: number;
  freePackQuantity?: number;
  packSizeMultiplier: number; // base units per pack (e.g. 10)
  purchaseRatePerPack: number;
  mrpPerUnit: number;
  salePricePerUnit?: number;
  taxRatePercent?: number;
}

export interface PurchaseInvoice {
  id: string;
  organizationId: string;
  supplierId: string;
  supplierName?: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  receivedDate: string;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netTotal: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
  notes?: string;
  items: PurchaseItem[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreatePurchaseInvoiceDTO {
  id?: string;
  organizationId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  receivedDate?: string;
  discountAmount?: number;
  paymentStatus?: PurchasePaymentStatus;
  notes?: string;
  items: CreatePurchaseItemDTO[];
  createdBy: string;
}
