import {
  Supplier,
  PurchaseInvoice,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  ISupplierRepository,
  IPurchaseRepository,
  SupplierNotFoundError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseInvoiceSchema,
  validateSchema
} from '@medidesk/validation';

export class SupplierPurchaseService {
  private supplierRepo: ISupplierRepository;
  private purchaseRepo: IPurchaseRepository;
  private auditService: AuditService;
  private rbac: RBACEngine;

  constructor(
    supplierRepo: ISupplierRepository,
    purchaseRepo: IPurchaseRepository,
    auditService: AuditService,
    rbac: RBACEngine
  ) {
    this.supplierRepo = supplierRepo;
    this.purchaseRepo = purchaseRepo;
    this.auditService = auditService;
    this.rbac = rbac;
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (!this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  // 1. Suppliers
  public async createSupplier(input: unknown, actor: SessionUser): Promise<Supplier> {
    this.assertPermission(actor, PermissionCode.SUPPLIER_CREATE);
    const validated = validateSchema(createSupplierSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for supplier creation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const created = await this.supplierRepo.create({
      ...dto,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.SUPPLIER_CREATED,
      resource: 'supplier',
      result: AuditResult.SUCCESS,
      metadata: {
        supplierId: created.id,
        supplierName: created.name
      }
    });

    return created;
  }

  public async updateSupplier(id: string, input: unknown, actor: SessionUser): Promise<Supplier> {
    this.assertPermission(actor, PermissionCode.SUPPLIER_UPDATE);
    const validated = validateSchema(updateSupplierSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for supplier update', validated.errors);
    }
    const dto = validated.data;

    const updated = await this.supplierRepo.update(id, actor.organizationId, {
      ...dto,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.SUPPLIER_UPDATED,
      resource: 'supplier',
      result: AuditResult.SUCCESS,
      metadata: {
        supplierId: updated.id,
        supplierName: updated.name
      }
    });

    return updated;
  }

  public async getSupplierById(id: string, actor: SessionUser): Promise<Supplier | null> {
    this.assertPermission(actor, PermissionCode.SUPPLIER_READ);
    return this.supplierRepo.findById(id, actor.organizationId);
  }

  public async searchSuppliers(query: string, actor: SessionUser, limit = 20): Promise<Supplier[]> {
    this.assertPermission(actor, PermissionCode.SUPPLIER_READ);
    if (!query || query.trim().length === 0) {
      return this.supplierRepo.list(actor.organizationId, limit);
    }
    return this.supplierRepo.search(actor.organizationId, query, limit);
  }

  // 2. Purchase Invoices
  public async createPurchaseInvoice(input: unknown, actor: SessionUser): Promise<PurchaseInvoice> {
    this.assertPermission(actor, PermissionCode.PURCHASE_CREATE);
    const validated = validateSchema(createPurchaseInvoiceSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for purchase invoice creation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const supplier = await this.supplierRepo.findById(dto.supplierId, actor.organizationId);
    if (!supplier) {
      throw new SupplierNotFoundError(dto.supplierId);
    }

    const created = await this.purchaseRepo.create({
      ...dto,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PURCHASE_CREATED,
      resource: 'purchase_invoice',
      result: AuditResult.SUCCESS,
      metadata: {
        purchaseId: created.id,
        invoiceNumber: created.invoiceNumber,
        itemCount: created.items.length,
        netTotal: created.netTotal
      }
    });

    return created;
  }

  public async getPurchaseById(id: string, actor: SessionUser): Promise<PurchaseInvoice | null> {
    this.assertPermission(actor, PermissionCode.PURCHASE_READ);
    return this.purchaseRepo.findById(id, actor.organizationId);
  }

  public async listPurchases(actor: SessionUser, limit = 50, offset = 0): Promise<PurchaseInvoice[]> {
    this.assertPermission(actor, PermissionCode.PURCHASE_READ);
    return this.purchaseRepo.list(actor.organizationId, limit, offset);
  }

  public async cancelPurchase(id: string, actor: SessionUser): Promise<PurchaseInvoice> {
    this.assertPermission(actor, PermissionCode.PURCHASE_CANCEL);
    const cancelled = await this.purchaseRepo.cancel(id, actor.organizationId, actor.id);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.PURCHASE_CANCELLED,
      resource: 'purchase_invoice',
      result: AuditResult.SUCCESS,
      metadata: {
        purchaseId: cancelled.id,
        invoiceNumber: cancelled.invoiceNumber
      }
    });

    return cancelled;
  }
}
