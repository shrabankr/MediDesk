import { Sale, CreateSaleDTO } from '../entities/Sale.js';

export interface ISaleRepository {
  create(dto: CreateSaleDTO & { billNumber: string; grossAmount: number; taxAmount: number; roundOff: number; netAmount: number }): Promise<Sale>;
  findById(id: string, organizationId: string): Promise<Sale | null>;
  findByBillNumber(billNumber: string, organizationId: string): Promise<Sale | null>;
  list(organizationId: string, limit?: number, offset?: number): Promise<Sale[]>;
  findByPatient(patientId: string, organizationId: string): Promise<Sale[]>;
  cancel(id: string, organizationId: string, cancelledBy: string): Promise<Sale>;
  getDailySalesReport(organizationId: string, dateStr: string): Promise<{
    totalSales: number;
    totalAmount: number;
    totalDiscount: number;
    totalTax: number;
    cashAmount: number;
    upiAmount: number;
    cardAmount: number;
    salesCount: number;
  }>;
}
