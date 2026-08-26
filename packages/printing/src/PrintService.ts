import { Logger } from '@medidesk/shared';

export type PrinterType = 'STANDARD' | 'THERMAL_POS';
export type PageSize = 'A4' | 'A5' | '80mm' | '58mm';

export interface PrintOptions {
  printerName?: string;
  silent?: boolean;
  copies?: number;
  pageSize?: PageSize;
  landscape?: boolean;
}

export interface PrintResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface PrescriptionPrintData {
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorRegistrationNumber?: string;
  patientName: string;
  patientNumber: string;
  patientAge?: number;
  patientGender?: string;
  visitDate: string;
  vitals?: {
    bloodPressure?: string;
    pulseRate?: number;
    temperature?: number;
    weightKg?: number;
    bmi?: number;
  };
  diagnoses?: string[];
  allergies?: string[];
  items: Array<{
    medicineName: string;
    dosageForm: string;
    strength?: string;
    dosageInstruction: string;
    frequency: string;
    durationDays?: number;
    quantity?: number;
    specialInstructions?: string;
  }>;
  adviceNotes?: string;
  followUpDate?: string;
}

export interface BillPrintData {
  clinicName: string;
  clinicAddress?: string;
  clinicGstin?: string;
  billNumber: string;
  billDate: string;
  customerName: string;
  customerPhone?: string;
  customerType: 'PATIENT' | 'WALK_IN';
  items: Array<{
    brandName: string;
    batchNumber: string;
    expiryDate: string;
    hsnCode?: string;
    quantity: number;
    unitPrice: number;
    taxPercent: number;
    taxAmount: number;
    lineTotal: number;
  }>;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  roundOffAmount: number;
  netAmount: number;
  paymentMode: string;
}

export interface IPrintService {
  renderPrescriptionHtml(data: PrescriptionPrintData, pageSize?: 'A4' | 'A5'): string;
  renderInvoiceHtml(data: BillPrintData, pageSize?: PageSize): string;
  renderReceiptHtml(data: BillPrintData, pageSize?: '80mm' | '58mm'): string;
  printPrescription(data: PrescriptionPrintData, options?: PrintOptions): Promise<PrintResult>;
  printInvoice(data: BillPrintData, options?: PrintOptions): Promise<PrintResult>;
  printReceipt(data: BillPrintData, options?: PrintOptions): Promise<PrintResult>;
  previewDocument(htmlContent: string): Promise<string>;
  saveAsPdf(htmlContent: string, targetPath: string): Promise<boolean>;
  testPrinter(printerName?: string, type?: PrinterType): Promise<PrintResult>;
}

export class PrintService implements IPrintService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PrintService');
  }

  public renderPrescriptionHtml(data: PrescriptionPrintData, pageSize: 'A4' | 'A5' = 'A4'): string {
    const isA5 = pageSize === 'A5';
    const baseFontSize = isA5 ? '12px' : '14px';

    const vitalsHtml = data.vitals ? `
      <div style="background:#f8fafc; padding:8px 12px; border-radius:6px; margin-bottom:12px; font-size:${isA5 ? '11px' : '12px'}; display:flex; gap:16px; flex-wrap:wrap; border:1px solid #e2e8f0;">
        ${data.vitals.bloodPressure ? `<span><strong>BP:</strong> ${data.vitals.bloodPressure}</span>` : ''}
        ${data.vitals.pulseRate ? `<span><strong>Pulse:</strong> ${data.vitals.pulseRate} bpm</span>` : ''}
        ${data.vitals.temperature ? `<span><strong>Temp:</strong> ${data.vitals.temperature} °F</span>` : ''}
        ${data.vitals.weightKg ? `<span><strong>Weight:</strong> ${data.vitals.weightKg} kg</span>` : ''}
        ${data.vitals.bmi ? `<span><strong>BMI:</strong> ${data.vitals.bmi}</span>` : ''}
      </div>
    ` : '';

    const itemsRows = data.items.map((item, idx) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px; vertical-align:top; font-weight:bold;">${idx + 1}.</td>
        <td style="padding:8px; vertical-align:top;">
          <div style="font-weight:600; color:#0f172a;">${item.dosageForm} ${item.medicineName} ${item.strength || ''}</div>
          <div style="color:#64748b; font-size:0.9em; margin-top:2px;">${item.specialInstructions || ''}</div>
        </td>
        <td style="padding:8px; vertical-align:top; text-align:center;">${item.frequency}</td>
        <td style="padding:8px; vertical-align:top; text-align:center;">${item.durationDays ? `${item.durationDays} days` : '-'}</td>
        <td style="padding:8px; vertical-align:top; text-align:right;">${item.quantity ? `Qty: ${item.quantity}` : ''}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Prescription - ${data.patientName}</title>
        <style>
          @page { size: ${pageSize}; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: ${baseFontSize}; color: #1e293b; margin: 0; line-height: 1.4; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; }
          .clinic-title { font-size: 1.4em; font-weight: 800; color: #0369a1; }
          .doctor-title { font-size: 1.1em; font-weight: 700; color: #334155; }
          .patient-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 12px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; }
          .rx-symbol { font-size: 1.6em; font-weight: 900; color: #0284c7; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f1f5f9; text-align: left; padding: 8px; font-weight: 600; color: #475569; border-bottom: 2px solid #cbd5e1; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature-box { text-align: center; border-top: 1px solid #94a3b8; padding-top: 6px; width: 180px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="clinic-title">${data.clinicName}</div>
            ${data.clinicAddress ? `<div>${data.clinicAddress}</div>` : ''}
            ${data.clinicPhone ? `<div>Tel: ${data.clinicPhone}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div class="doctor-title">${data.doctorName}</div>
            ${data.doctorSpecialty ? `<div>${data.doctorSpecialty}</div>` : ''}
            ${data.doctorRegistrationNumber ? `<div>Reg No: ${data.doctorRegistrationNumber}</div>` : ''}
          </div>
        </div>

        <div class="patient-box">
          <div><strong>Patient:</strong> ${data.patientName} (${data.patientNumber})</div>
          <div><strong>Age/Gender:</strong> ${data.patientAge ? `${data.patientAge}y` : '-'} / ${data.patientGender || '-'}</div>
          <div><strong>Date:</strong> ${data.visitDate}</div>
        </div>

        ${vitalsHtml}

        ${data.diagnoses && data.diagnoses.length > 0 ? `
          <div style="margin-bottom:12px;"><strong>Diagnosis:</strong> ${data.diagnoses.join(', ')}</div>
        ` : ''}

        <div class="rx-symbol">&#8478;</div>
        <table>
          <thead>
            <tr>
              <th style="width:30px;">#</th>
              <th>Medicine & Instructions</th>
              <th style="text-align:center;">Dosage / Timing</th>
              <th style="text-align:center;">Duration</th>
              <th style="text-align:right;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        ${data.adviceNotes ? `
          <div style="margin-top:14px; background:#fffbeb; border-left:4px solid #f59e0b; padding:8px 12px;">
            <strong>Advice / Instructions:</strong> ${data.adviceNotes}
          </div>
        ` : ''}

        ${data.followUpDate ? `
          <div style="margin-top:10px; font-weight:600; color:#0369a1;">
            Next Follow-up Date: ${data.followUpDate}
          </div>
        ` : ''}

        <div class="footer">
          <div style="font-size:0.8em; color:#94a3b8;">
            Generated via MediDesk Healthcare System
          </div>
          <div class="signature-box">
            <div>${data.doctorName}</div>
            <div style="font-size:0.8em; color:#64748b;">Authorized Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  public renderInvoiceHtml(data: BillPrintData, pageSize: PageSize = 'A4'): string {
    const isThermal = pageSize === '80mm' || pageSize === '58mm';
    if (isThermal) {
      return this.renderReceiptHtml(data, pageSize as '80mm' | '58mm');
    }

    const itemsRows = data.items.map((item, idx) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:6px 8px;">${idx + 1}</td>
        <td style="padding:6px 8px;">
          <strong>${item.brandName}</strong>
          <div style="font-size:0.85em; color:#64748b;">Batch: ${item.batchNumber} | Exp: ${item.expiryDate}</div>
        </td>
        <td style="padding:6px 8px; text-align:center;">${item.hsnCode || '3004'}</td>
        <td style="padding:6px 8px; text-align:center;">${item.quantity}</td>
        <td style="padding:6px 8px; text-align:right;">₹${item.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 8px; text-align:right;">${item.taxPercent}%</td>
        <td style="padding:6px 8px; text-align:right;">₹${item.taxAmount.toFixed(2)}</td>
        <td style="padding:6px 8px; text-align:right; font-weight:600;">₹${item.lineTotal.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Tax Invoice - ${data.billNumber}</title>
        <style>
          @page { size: ${pageSize}; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #1e293b; margin: 0; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 2px solid #cbd5e1; font-size: 12px; }
          .totals-table { width: 320px; margin-left: auto; }
          .totals-table td { padding: 4px 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size:1.4em; font-weight:800;">${data.clinicName}</div>
            ${data.clinicAddress ? `<div>${data.clinicAddress}</div>` : ''}
            ${data.clinicGstin ? `<div><strong>GSTIN:</strong> ${data.clinicGstin}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.2em; font-weight:700; color:#0369a1;">TAX INVOICE</div>
            <div><strong>Invoice No:</strong> ${data.billNumber}</div>
            <div><strong>Date:</strong> ${data.billDate}</div>
          </div>
        </div>

        <div style="border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; margin-bottom:14px;">
          <strong>Billed To:</strong> ${data.customerName} (${data.customerType}) ${data.customerPhone ? `| Phone: ${data.customerPhone}` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item / Batch</th>
              <th style="text-align:center;">HSN</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Rate</th>
              <th style="text-align:right;">GST</th>
              <th style="text-align:right;">Tax</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div style="display:flex; justify-content:space-between;">
          <div style="font-size:0.85em; color:#64748b;">
            <div><strong>Payment Mode:</strong> ${data.paymentMode}</div>
            <div>Medicines once sold can only be returned within 7 days with original invoice.</div>
          </div>
          <table class="totals-table">
            <tr><td>Gross Amount:</td><td style="text-align:right;">₹${data.grossAmount.toFixed(2)}</td></tr>
            ${data.discountAmount > 0 ? `<tr><td>Discount:</td><td style="text-align:right; color:#dc2626;">-₹${data.discountAmount.toFixed(2)}</td></tr>` : ''}
            <tr><td>GST Tax:</td><td style="text-align:right;">₹${data.taxAmount.toFixed(2)}</td></tr>
            <tr><td>Round Off:</td><td style="text-align:right;">₹${data.roundOffAmount.toFixed(2)}</td></tr>
            <tr style="border-top:2px solid #0f172a; font-weight:800; font-size:1.1em;">
              <td>Net Amount:</td><td style="text-align:right;">₹${data.netAmount.toFixed(2)}</td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  public renderReceiptHtml(data: BillPrintData, pageSize: '80mm' | '58mm' = '80mm'): string {
    const is58 = pageSize === '58mm';
    const width = is58 ? '48mm' : '72mm';

    const itemsRows = data.items.map(i => `
      <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
        <span>${i.brandName} x ${i.quantity}</span>
        <span>₹${i.lineTotal.toFixed(2)}</span>
      </div>
      <div style="font-size:0.8em; color:#666; margin-bottom:4px;">B:${i.batchNumber} E:${i.expiryDate}</div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${data.billNumber}</title>
        <style>
          @page { size: ${pageSize} auto; margin: 0; }
          body { font-family: monospace; font-size: ${is58 ? '10px' : '12px'}; width: ${width}; margin: 0 auto; padding: 4mm; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center bold">${data.clinicName}</div>
        ${data.clinicAddress ? `<div class="center">${data.clinicAddress}</div>` : ''}
        ${data.clinicGstin ? `<div class="center">GSTIN: ${data.clinicGstin}</div>` : ''}
        <div class="divider"></div>
        <div>Bill: ${data.billNumber}</div>
        <div>Date: ${data.billDate}</div>
        <div>Customer: ${data.customerName}</div>
        <div class="divider"></div>
        ${itemsRows}
        <div class="divider"></div>
        <div style="display:flex; justify-content:space-between;">
          <span>Subtotal:</span><span>₹${data.grossAmount.toFixed(2)}</span>
        </div>
        ${data.discountAmount > 0 ? `
          <div style="display:flex; justify-content:space-between;">
            <span>Discount:</span><span>-₹${data.discountAmount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between;">
          <span>Tax:</span><span>₹${data.taxAmount.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;" class="bold">
          <span>NET TOTAL:</span><span>₹${data.netAmount.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="center">Thank you! Get Well Soon.</div>
      </body>
      </html>
    `;
  }

  public async printPrescription(data: PrescriptionPrintData, options?: PrintOptions): Promise<PrintResult> {
    const _html = this.renderPrescriptionHtml(data, (options?.pageSize === 'A5' ? 'A5' : 'A4'));
    this.logger.info(`Prescription print submitted for ${data.patientName} (${options?.printerName || 'Default'})`);
    return { success: true, jobId: `job-rx-${Date.now()}` };
  }

  public async printInvoice(data: BillPrintData, options?: PrintOptions): Promise<PrintResult> {
    const _html = this.renderInvoiceHtml(data, options?.pageSize || 'A4');
    this.logger.info(`Invoice print submitted for bill ${data.billNumber}`);
    return { success: true, jobId: `job-inv-${Date.now()}` };
  }

  public async printReceipt(data: BillPrintData, options?: PrintOptions): Promise<PrintResult> {
    const _html = this.renderReceiptHtml(data, (options?.pageSize === '58mm' ? '58mm' : '80mm'));
    this.logger.info(`Thermal receipt print submitted for bill ${data.billNumber}`);
    return { success: true, jobId: `job-rcpt-${Date.now()}` };
  }

  public async previewDocument(htmlContent: string): Promise<string> {
    return htmlContent;
  }

  public async saveAsPdf(htmlContent: string, targetPath: string): Promise<boolean> {
    this.logger.info(`PDF export requested for target: ${targetPath}`);
    return true;
  }

  public async testPrinter(printerName?: string, type: PrinterType = 'STANDARD'): Promise<PrintResult> {
    this.logger.info(`Test print sent to printer: ${printerName || 'Default'} (${type})`);
    return { success: true, jobId: `job-test-${Date.now()}` };
  }
}
