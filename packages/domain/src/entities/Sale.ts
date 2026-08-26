export type CustomerType = 'WALK_IN' | 'PATIENT';
export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'DUE';
export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'RETURNED';

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number; // in base units
  unitSalePrice: number;
  unitMrp: number;
  taxRatePercent: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

export interface CreateSaleItemDTO {
  productId: string;
  batchId: string;
  quantity: number;
  unitSalePrice?: number;
  discountAmount?: number;
}

export interface Sale {
  id: string;
  organizationId: string;
  billNumber: string;
  saleDate: Date;
  customerType: CustomerType;
  patientId?: string;
  customerName: string;
  customerPhone?: string;
  prescribingDoctorId?: string;
  prescribingDoctorName?: string;
  prescriptionId?: string;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  roundOff: number;
  netAmount: number;
  paymentMode: PaymentMode;
  paymentStatus: string;
  status: SaleStatus;
  items: SaleItem[];
  createdAt: Date;
  createdBy: string;
}

export interface CreateSaleDTO {
  id?: string;
  organizationId: string;
  customerType: CustomerType;
  patientId?: string;
  customerName: string;
  customerPhone?: string;
  prescribingDoctorId?: string;
  prescribingDoctorName?: string;
  prescriptionId?: string;
  discountAmount?: number;
  paymentMode: PaymentMode;
  items: CreateSaleItemDTO[];
  createdBy: string;
}

export interface SaleReturnItem {
  id: string;
  saleReturnId: string;
  saleItemId: string;
  productId: string;
  batchId: string;
  quantity: number;
  refundAmount: number;
}

export interface SaleReturn {
  id: string;
  organizationId: string;
  saleId: string;
  returnNumber: string;
  returnDate: Date;
  reason: string;
  refundAmount: number;
  refundMode: string;
  items: SaleReturnItem[];
  createdAt: Date;
  createdBy: string;
}

export interface CreateSaleReturnDTO {
  id?: string;
  organizationId: string;
  saleId: string;
  reason: string;
  refundMode?: string;
  items: Array<{
    saleItemId: string;
    quantity: number;
  }>;
  createdBy: string;
}
