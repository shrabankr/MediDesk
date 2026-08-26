import { PurchaseInvoice, CreatePurchaseInvoiceDTO } from '../entities/Purchase.js';

export interface IPurchaseRepository {
  create(dto: CreatePurchaseInvoiceDTO): Promise<PurchaseInvoice>;
  findById(id: string, organizationId: string): Promise<PurchaseInvoice | null>;
  findByInvoiceNumber(invoiceNumber: string, organizationId: string): Promise<PurchaseInvoice | null>;
  list(organizationId: string, limit?: number, offset?: number): Promise<PurchaseInvoice[]>;
  cancel(id: string, organizationId: string, cancelledBy: string): Promise<PurchaseInvoice>;
}
