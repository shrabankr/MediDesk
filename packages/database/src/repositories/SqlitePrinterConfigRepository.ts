import crypto from 'crypto';
import { SqliteDatabase } from '../SqliteDatabase.js';
import { PrinterConfiguration, IPrinterConfigRepository, UpsertPrinterConfigDTO, PageSize } from '@medidesk/domain';

export class SqlitePrinterConfigRepository implements IPrinterConfigRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async getConfig(organizationId: string, userId?: string, workstationName = 'DEFAULT_WORKSTATION'): Promise<PrinterConfiguration | null> {
    let row: any;
    if (userId) {
      row = this.db.getRawDb().prepare(`
        SELECT * FROM printer_configurations
        WHERE organization_id = ? AND user_id = ?
      `).get(organizationId, userId);
    }

    if (!row) {
      row = this.db.getRawDb().prepare(`
        SELECT * FROM printer_configurations
        WHERE organization_id = ? AND workstation_name = ?
      `).get(organizationId, workstationName);
    }

    if (!row) {
      row = this.db.getRawDb().prepare(`
        SELECT * FROM printer_configurations
        WHERE organization_id = ?
        ORDER BY created_at ASC LIMIT 1
      `).get(organizationId);
    }

    if (!row) return null;
    return this.mapRow(row);
  }

  public async upsertConfig(dto: UpsertPrinterConfigDTO): Promise<PrinterConfiguration> {
    const existing = await this.getConfig(dto.organizationId, dto.userId, dto.workstationName);
    const now = new Date().toISOString();

    if (existing) {
      this.db.getRawDb().prepare(`
        UPDATE printer_configurations SET
          prescription_printer_name = ?,
          prescription_page_size = ?,
          invoice_printer_name = ?,
          receipt_printer_name = ?,
          receipt_page_size = ?,
          silent_printing = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        dto.prescriptionPrinterName ?? existing.prescriptionPrinterName ?? null,
        dto.prescriptionPageSize ?? existing.prescriptionPageSize ?? 'A4',
        dto.invoicePrinterName ?? existing.invoicePrinterName ?? null,
        dto.receiptPrinterName ?? existing.receiptPrinterName ?? null,
        dto.receiptPageSize ?? existing.receiptPageSize ?? '80mm',
        dto.silentPrinting !== undefined ? (dto.silentPrinting ? 1 : 0) : (existing.silentPrinting ? 1 : 0),
        now,
        existing.id
      );

      return (await this.getConfig(dto.organizationId, dto.userId, dto.workstationName))!;
    }

    const id = dto.id || crypto.randomUUID();
    this.db.getRawDb().prepare(`
      INSERT INTO printer_configurations (
        id, organization_id, user_id, workstation_name,
        prescription_printer_name, prescription_page_size,
        invoice_printer_name, receipt_printer_name, receipt_page_size,
        silent_printing, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      dto.organizationId,
      dto.userId ?? null,
      dto.workstationName || 'DEFAULT_WORKSTATION',
      dto.prescriptionPrinterName ?? null,
      dto.prescriptionPageSize || 'A4',
      dto.invoicePrinterName ?? null,
      dto.receiptPrinterName ?? null,
      dto.receiptPageSize || '80mm',
      dto.silentPrinting ? 1 : 0,
      now,
      now
    );

    return (await this.getConfig(dto.organizationId, dto.userId, dto.workstationName))!;
  }

  private mapRow(row: any): PrinterConfiguration {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id || undefined,
      workstationName: row.workstation_name,
      prescriptionPrinterName: row.prescription_printer_name || undefined,
      prescriptionPageSize: row.prescription_page_size as PageSize,
      invoicePrinterName: row.invoice_printer_name || undefined,
      receiptPrinterName: row.receipt_printer_name || undefined,
      receiptPageSize: row.receipt_page_size as PageSize,
      silentPrinting: Boolean(row.silent_printing),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
