import crypto from 'crypto';
import {
  Sale,
  SaleItem,
  CustomerType,
  PaymentMode,
  SaleStatus,
  CreateSaleDTO,
  ISaleRepository,
  SaleNotFoundError,
  BatchNotFoundError,
  ExpiredBatchSaleError,
  InsufficientStockError
} from '@medidesk/domain';
import { SqliteDatabase } from '../SqliteDatabase.js';

interface SaleRow {
  id: string;
  organization_id: string;
  bill_number: string;
  sale_date: string;
  customer_type: string;
  patient_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  prescribing_doctor_id: string | null;
  prescribing_doctor_name: string | null;
  prescription_id: string | null;
  gross_amount: number;
  discount_amount: number;
  tax_amount: number;
  round_off: number;
  net_amount: number;
  payment_mode: string;
  payment_status: string;
  status: string;
  created_at: string;
  created_by: string;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  product_name?: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_sale_price: number;
  unit_mrp: number;
  tax_rate_percent: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
}

export class SqliteSaleRepository implements ISaleRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  private mapItemRow(row: SaleItemRow): SaleItem {
    return {
      id: row.id,
      saleId: row.sale_id,
      productId: row.product_id,
      productName: row.product_name ?? undefined,
      batchId: row.batch_id,
      batchNumber: row.batch_number,
      expiryDate: row.expiry_date,
      quantity: row.quantity,
      unitSalePrice: row.unit_sale_price,
      unitMrp: row.unit_mrp,
      taxRatePercent: row.tax_rate_percent,
      taxAmount: row.tax_amount,
      discountAmount: row.discount_amount,
      totalAmount: row.total_amount
    };
  }

  private mapSaleRow(row: SaleRow, items: SaleItem[] = []): Sale {
    return {
      id: row.id,
      organizationId: row.organization_id,
      billNumber: row.bill_number,
      saleDate: new Date(row.sale_date),
      customerType: row.customer_type as CustomerType,
      patientId: row.patient_id ?? undefined,
      customerName: row.customer_name,
      customerPhone: row.customer_phone ?? undefined,
      prescribingDoctorId: row.prescribing_doctor_id ?? undefined,
      prescribingDoctorName: row.prescribing_doctor_name ?? undefined,
      prescriptionId: row.prescription_id ?? undefined,
      grossAmount: row.gross_amount,
      discountAmount: row.discount_amount,
      taxAmount: row.tax_amount,
      roundOff: row.round_off,
      netAmount: row.net_amount,
      paymentMode: row.payment_mode as PaymentMode,
      paymentStatus: row.payment_status,
      status: row.status as SaleStatus,
      items,
      createdAt: new Date(row.created_at),
      createdBy: row.created_by
    };
  }

  public async create(dto: CreateSaleDTO & { billNumber: string; grossAmount: number; taxAmount: number; roundOff: number; netAmount: number }): Promise<Sale> {
    const saleId = dto.id ?? crypto.randomUUID();
    const raw = this.db.getRawDb();
    const today = new Date().toISOString().split('T')[0];

    this.db.transaction(() => {
      // 1. Insert Sales Record
      raw.prepare(`
        INSERT INTO sales (
          id, organization_id, bill_number, customer_type, patient_id,
          customer_name, customer_phone, prescribing_doctor_id, prescribing_doctor_name,
          prescription_id, gross_amount, discount_amount, tax_amount, round_off,
          net_amount, payment_mode, payment_status, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', 'COMPLETED', ?)
      `).run(
        saleId,
        dto.organizationId,
        dto.billNumber,
        dto.customerType,
        dto.patientId ?? null,
        dto.customerName.trim(),
        dto.customerPhone?.trim() ?? null,
        dto.prescribingDoctorId ?? null,
        dto.prescribingDoctorName?.trim() ?? null,
        dto.prescriptionId ?? null,
        dto.grossAmount,
        dto.discountAmount ?? 0.0,
        dto.taxAmount,
        dto.roundOff,
        dto.netAmount,
        dto.paymentMode,
        dto.createdBy
      );

      // 2. Validate, Deduct Stock & Insert Sale Items
      const insertItem = raw.prepare(`
        INSERT INTO sale_items (
          id, sale_id, product_id, batch_id, batch_number, expiry_date,
          quantity, unit_sale_price, unit_mrp, tax_rate_percent, tax_amount,
          discount_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of dto.items) {
        const batch = raw.prepare(`
          SELECT b.*, mp.brand_name, mp.tax_rate_percent
          FROM inventory_batches b
          JOIN medicine_products mp ON b.product_id = mp.id
          WHERE b.id = ? AND b.organization_id = ?
        `).get(item.batchId, dto.organizationId) as any;

        if (!batch) {
          throw new BatchNotFoundError(item.batchId);
        }

        // Expiry check
        if (batch.expiry_date < today) {
          throw new ExpiredBatchSaleError(batch.batch_number, batch.expiry_date);
        }

        // Stock check
        if (batch.current_stock_quantity < item.quantity) {
          throw new InsufficientStockError(batch.brand_name, item.quantity, batch.current_stock_quantity);
        }

        const unitSalePrice = item.unitSalePrice ?? batch.sale_price_per_unit;
        const lineGross = unitSalePrice * item.quantity;
        const itemDiscount = item.discountAmount ?? 0.0;
        const taxableAmount = Math.max(0, lineGross - itemDiscount);
        const taxRate = batch.tax_rate_percent ?? 0.0;
        const lineTax = (taxableAmount * taxRate) / 100;
        const lineTotal = taxableAmount + lineTax;

        const newStock = batch.current_stock_quantity - item.quantity;
        const newStatus = newStock === 0 ? 'DEPLETED' : 'ACTIVE';

        // Deduct Stock
        raw.prepare(`
          UPDATE inventory_batches
          SET current_stock_quantity = ?, status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(newStock, newStatus, batch.id);

        // Insert Stock Movement
        raw.prepare(`
          INSERT INTO stock_movements (
            id, organization_id, product_id, batch_id, movement_type,
            quantity_change, balance_after, reference_type, reference_id,
            notes, created_by
          ) VALUES (?, ?, ?, ?, 'SALE', ?, ?, 'SALE_INVOICE', ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          dto.organizationId,
          item.productId,
          batch.id,
          -item.quantity,
          newStock,
          saleId,
          `Sale Bill #${dto.billNumber}`,
          dto.createdBy
        );

        // Insert Line Item
        insertItem.run(
          crypto.randomUUID(),
          saleId,
          item.productId,
          batch.id,
          batch.batch_number,
          batch.expiry_date,
          item.quantity,
          unitSalePrice,
          batch.mrp_per_unit,
          taxRate,
          lineTax,
          itemDiscount,
          lineTotal
        );
      }
    });

    const created = await this.findById(saleId, dto.organizationId);
    if (!created) {
      throw new Error(`Failed to retrieve created sale ${saleId}`);
    }
    return created;
  }

  public async findById(id: string, organizationId: string): Promise<Sale | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM sales WHERE id = ? AND organization_id = ?
    `).get(id, organizationId) as SaleRow | undefined;

    if (!row) return null;

    const itemRows = raw.prepare(`
      SELECT si.*, mp.brand_name as product_name
      FROM sale_items si
      JOIN medicine_products mp ON si.product_id = mp.id
      WHERE si.sale_id = ?
    `).all(id) as SaleItemRow[];

    return this.mapSaleRow(row, itemRows.map((r) => this.mapItemRow(r)));
  }

  public async findByBillNumber(billNumber: string, organizationId: string): Promise<Sale | null> {
    const raw = this.db.getRawDb();
    const row = raw.prepare(`
      SELECT * FROM sales WHERE bill_number = ? AND organization_id = ?
    `).get(billNumber.trim(), organizationId) as SaleRow | undefined;

    if (!row) return null;
    return this.findById(row.id, organizationId);
  }

  public async list(organizationId: string, limit = 50, offset = 0): Promise<Sale[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM sales
      WHERE organization_id = ?
      ORDER BY sale_date DESC, created_at DESC
      LIMIT ? OFFSET ?
    `).all(organizationId, limit, offset) as SaleRow[];

    return Promise.all(
      rows.map(async (r) => {
        const itemRows = raw.prepare(`
          SELECT si.*, mp.brand_name as product_name
          FROM sale_items si
          JOIN medicine_products mp ON si.product_id = mp.id
          WHERE si.sale_id = ?
        `).all(r.id) as SaleItemRow[];
        return this.mapSaleRow(r, itemRows.map((i) => this.mapItemRow(i)));
      })
    );
  }

  public async findByPatient(patientId: string, organizationId: string): Promise<Sale[]> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM sales
      WHERE patient_id = ? AND organization_id = ?
      ORDER BY sale_date DESC
    `).all(patientId, organizationId) as SaleRow[];

    return Promise.all(
      rows.map(async (r) => {
        const itemRows = raw.prepare(`
          SELECT si.*, mp.brand_name as product_name
          FROM sale_items si
          JOIN medicine_products mp ON si.product_id = mp.id
          WHERE si.sale_id = ?
        `).all(r.id) as SaleItemRow[];
        return this.mapSaleRow(r, itemRows.map((i) => this.mapItemRow(i)));
      })
    );
  }

  public async cancel(id: string, organizationId: string, cancelledBy: string): Promise<Sale> {
    const existing = await this.findById(id, organizationId);
    if (!existing) {
      throw new SaleNotFoundError(id);
    }

    const raw = this.db.getRawDb();
    this.db.transaction(() => {
      for (const item of existing.items) {
        const batch = raw.prepare(`
          SELECT * FROM inventory_batches WHERE id = ?
        `).get(item.batchId) as any;

        if (batch) {
          const newQty = batch.current_stock_quantity + item.quantity;
          raw.prepare(`
            UPDATE inventory_batches SET current_stock_quantity = ?, status = 'ACTIVE', updated_at = datetime('now') WHERE id = ?
          `).run(newQty, batch.id);

          raw.prepare(`
            INSERT INTO stock_movements (
              id, organization_id, product_id, batch_id, movement_type,
              quantity_change, balance_after, reference_type, reference_id,
              notes, created_by
            ) VALUES (?, ?, ?, ?, 'SALE_RETURN', ?, ?, 'SALE_INVOICE', ?, 'Voided sale bill', ?)
          `).run(
            crypto.randomUUID(),
            organizationId,
            item.productId,
            batch.id,
            item.quantity,
            newQty,
            id,
            cancelledBy
          );
        }
      }

      raw.prepare(`
        UPDATE sales SET status = 'CANCELLED' WHERE id = ? AND organization_id = ?
      `).run(id, organizationId);
    });

    return (await this.findById(id, organizationId))!;
  }

  public async getDailySalesReport(organizationId: string, dateStr: string): Promise<{
    totalSales: number;
    totalAmount: number;
    totalDiscount: number;
    totalTax: number;
    cashAmount: number;
    upiAmount: number;
    cardAmount: number;
    salesCount: number;
  }> {
    const raw = this.db.getRawDb();
    const rows = raw.prepare(`
      SELECT * FROM sales
      WHERE organization_id = ?
        AND date(sale_date) = date(?)
        AND status = 'COMPLETED'
    `).all(organizationId, dateStr) as SaleRow[];

    let totalAmount = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let cashAmount = 0;
    let upiAmount = 0;
    let cardAmount = 0;

    for (const r of rows) {
      totalAmount += r.net_amount;
      totalDiscount += r.discount_amount;
      totalTax += r.tax_amount;

      if (r.payment_mode === 'CASH') cashAmount += r.net_amount;
      else if (r.payment_mode === 'UPI') upiAmount += r.net_amount;
      else if (r.payment_mode === 'CARD') cardAmount += r.net_amount;
    }

    return {
      totalSales: rows.length,
      totalAmount,
      totalDiscount,
      totalTax,
      cashAmount,
      upiAmount,
      cardAmount,
      salesCount: rows.length
    };
  }
}
