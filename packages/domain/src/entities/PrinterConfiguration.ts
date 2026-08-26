export type PageSize = 'A4' | 'A5' | '80mm' | '58mm';

export interface PrinterConfiguration {
  id: string;
  organizationId: string;
  userId?: string;
  workstationName: string;
  prescriptionPrinterName?: string;
  prescriptionPageSize: PageSize;
  invoicePrinterName?: string;
  receiptPrinterName?: string;
  receiptPageSize: PageSize;
  silentPrinting: boolean;
  createdAt: Date;
  updatedAt: Date;
}
