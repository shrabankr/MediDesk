import {
  Sale,
  SaleReturn,
  MedicineProduct,
  PrescriptionItem,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  ISaleRepository,
  ISaleReturnRepository,
  IInventoryBatchRepository,
  IMedicineProductRepository,
  IPrescriptionRepository,
  SaleNotFoundError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  createSaleSchema,
  createSaleReturnSchema,
  validateSchema
} from '@medidesk/validation';

export class PharmacyBillingService {
  private saleRepo: ISaleRepository;
  private returnRepo?: ISaleReturnRepository;
  private batchRepo: IInventoryBatchRepository;
  private productRepo: IMedicineProductRepository;
  private prescriptionRepo?: IPrescriptionRepository;
  private auditService: AuditService;
  private rbac: RBACEngine;

  constructor(
    saleRepo: ISaleRepository,
    returnRepo: ISaleReturnRepository | undefined,
    batchRepo: IInventoryBatchRepository,
    productRepo: IMedicineProductRepository,
    auditService: AuditService,
    rbac: RBACEngine,
    prescriptionRepo?: IPrescriptionRepository
  ) {
    this.saleRepo = saleRepo;
    this.returnRepo = returnRepo;
    this.batchRepo = batchRepo;
    this.productRepo = productRepo;
    this.prescriptionRepo = prescriptionRepo;
    this.auditService = auditService;
    this.rbac = rbac;
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (!this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  public async createSale(input: unknown, actor: SessionUser): Promise<Sale> {
    this.assertPermission(actor, PermissionCode.SALE_CREATE);
    const validated = validateSchema(createSaleSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for sale creation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    // Generate Human-Readable Bill Number: BILL-YYMMDD-XXXX
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const billNumber = `BILL-${datePart}-${randPart}`;

    let grossAmount = 0;
    let totalTax = 0;

    for (const item of dto.items) {
      const batch = await this.batchRepo.findById(item.batchId, actor.organizationId);
      if (batch) {
        const unitPrice = item.unitSalePrice ?? batch.salePricePerUnit;
        const lineGross = unitPrice * item.quantity;
        const itemDiscount = item.discountAmount ?? 0.0;
        const taxable = Math.max(0, lineGross - itemDiscount);

        const prod = await this.productRepo.findById(item.productId, actor.organizationId);
        const taxRate = prod?.taxRatePercent ?? 0.0;
        const lineTax = (taxable * taxRate) / 100;

        grossAmount += lineGross;
        totalTax += lineTax;
      }
    }

    const billDiscount = dto.discountAmount ?? 0.0;
    const subTotal = grossAmount + totalTax - billDiscount;
    const roundOff = Math.round(subTotal) - subTotal;
    const netAmount = Math.round(subTotal);

    const created = await this.saleRepo.create({
      ...dto,
      billNumber,
      grossAmount,
      taxAmount: totalTax,
      roundOff,
      netAmount,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.SALE_CREATED,
      resource: 'sale',
      result: AuditResult.SUCCESS,
      metadata: {
        saleId: created.id,
        billNumber: created.billNumber,
        itemCount: created.items.length,
        netAmount: created.netAmount,
        customerType: created.customerType
      }
    });

    return created;
  }

  public async getSaleById(id: string, actor: SessionUser): Promise<Sale | null> {
    this.assertPermission(actor, PermissionCode.SALE_READ);
    return this.saleRepo.findById(id, actor.organizationId);
  }

  public async getSaleByBillNumber(billNumber: string, actor: SessionUser): Promise<Sale | null> {
    this.assertPermission(actor, PermissionCode.SALE_READ);
    return this.saleRepo.findByBillNumber(billNumber, actor.organizationId);
  }

  public async listSales(actor: SessionUser, limit = 50, offset = 0): Promise<Sale[]> {
    this.assertPermission(actor, PermissionCode.SALE_READ);
    return this.saleRepo.list(actor.organizationId, limit, offset);
  }

  public async getSalesByPatient(patientId: string, actor: SessionUser): Promise<Sale[]> {
    this.assertPermission(actor, PermissionCode.SALE_READ);
    return this.saleRepo.findByPatient(patientId, actor.organizationId);
  }

  public async cancelSale(id: string, actor: SessionUser): Promise<Sale> {
    this.assertPermission(actor, PermissionCode.SALE_CANCEL);
    const cancelled = await this.saleRepo.cancel(id, actor.organizationId, actor.id);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.SALE_CANCELLED,
      resource: 'sale',
      result: AuditResult.SUCCESS,
      metadata: {
        saleId: cancelled.id,
        billNumber: cancelled.billNumber
      }
    });

    return cancelled;
  }

  public async createSaleReturn(input: unknown, actor: SessionUser): Promise<SaleReturn> {
    this.assertPermission(actor, PermissionCode.SALE_RETURN);
    if (!this.returnRepo) {
      throw new Error('SaleReturnRepository is not initialized.');
    }
    const validated = validateSchema(createSaleReturnSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for sale return', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const sale = await this.saleRepo.findById(dto.saleId, actor.organizationId);
    if (!sale) {
      throw new SaleNotFoundError(dto.saleId);
    }

    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

    const created = await this.returnRepo.create({
      ...dto,
      returnNumber,
      refundAmount: 0,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.SALE_RETURN_CREATED,
      resource: 'sale_return',
      result: AuditResult.SUCCESS,
      metadata: {
        returnId: created.id,
        saleId: created.saleId,
        returnNumber: created.returnNumber,
        refundAmount: created.refundAmount
      }
    });

    return created;
  }

  /**
   * Prescription to Medicine Master item matching.
   */
  public async matchPrescriptionItems(
    prescriptionId: string,
    actor: SessionUser
  ): Promise<Array<{
    prescriptionItem: PrescriptionItem;
    matchedProduct: MedicineProduct | null;
    availableBatches: any[];
    suggestedFefoBatch: any | null;
  }>> {
    this.assertPermission(actor, PermissionCode.SALE_CREATE);
    if (!this.prescriptionRepo) return [];

    const rx = await this.prescriptionRepo.findById(prescriptionId, actor.organizationId);
    if (!rx || !rx.currentVersion) return [];

    const results = [];
    for (const item of rx.currentVersion.items) {
      const matchedProducts = await this.productRepo.search(actor.organizationId, item.medicineName, 5);
      const matchedProduct = matchedProducts[0] ?? null;

      let availableBatches: any[] = [];
      let suggestedFefoBatch = null;

      if (matchedProduct) {
        availableBatches = await this.batchRepo.findValidFefoBatches(matchedProduct.id, actor.organizationId);
        suggestedFefoBatch = availableBatches[0] ?? null;
      }

      results.push({
        prescriptionItem: item,
        matchedProduct,
        availableBatches,
        suggestedFefoBatch
      });
    }

    return results;
  }

  public async getDailySalesReport(dateStr: string, actor: SessionUser): Promise<any> {
    this.assertPermission(actor, PermissionCode.REPORT_READ);
    return this.saleRepo.getDailySalesReport(actor.organizationId, dateStr);
  }
}
