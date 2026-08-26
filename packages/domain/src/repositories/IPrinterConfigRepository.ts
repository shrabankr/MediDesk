import { PrinterConfiguration } from '../entities/PrinterConfiguration.js';

export interface UpsertPrinterConfigDTO {
  id?: string;
  organizationId: string;
  userId?: string;
  workstationName?: string;
  prescriptionPrinterName?: string;
  prescriptionPageSize?: 'A4' | 'A5';
  invoicePrinterName?: string;
  receiptPrinterName?: string;
  receiptPageSize?: '80mm' | '58mm';
  silentPrinting?: boolean;
}

export interface IPrinterConfigRepository {
  getConfig(organizationId: string, userId?: string, workstationName?: string): Promise<PrinterConfiguration | null>;
  upsertConfig(dto: UpsertPrinterConfigDTO): Promise<PrinterConfiguration>;
}
