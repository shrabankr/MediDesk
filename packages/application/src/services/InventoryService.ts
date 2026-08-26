import {
  InventoryBatch,
  StockMovement,
  FefoAllocationResult,
  FefoAllocationItem,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  IInventoryBatchRepository,
  IStockMovementRepository,
  IMedicineProductRepository,
  BatchNotFoundError,
  NegativeStockError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  stockAdjustmentSchema,
  fefoAllocationSchema,
  validateSchema
} from '@medidesk/validation';

export class InventoryService {
  private batchRepo: IInventoryBatchRepository;
  private movementRepo: IStockMovementRepository;
  private productRepo: IMedicineProductRepository;
  private auditService: AuditService;
  private rbac: RBACEngine;

  constructor(
    batchRepo: IInventoryBatchRepository,
    movementRepo: IStockMovementRepository,
    productRepo: IMedicineProductRepository,
    auditService: AuditService,
    rbac: RBACEngine
  ) {
    this.batchRepo = batchRepo;
    this.movementRepo = movementRepo;
    this.productRepo = productRepo;
    this.auditService = auditService;
    this.rbac = rbac;
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (!this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  /**
   * Determine FEFO batch allocation for a requested product quantity without mutating stock.
   */
  public async allocateFefoStock(input: unknown, actor: SessionUser): Promise<FefoAllocationResult> {
    this.assertPermission(actor, PermissionCode.INVENTORY_READ);
    const validated = validateSchema(fefoAllocationSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for FEFO stock allocation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const batches = await this.batchRepo.findValidFefoBatches(dto.productId, actor.organizationId);
    let remaining = dto.requestedQuantity;
    const allocations: FefoAllocationItem[] = [];

    for (const b of batches) {
      if (remaining <= 0) break;

      const take = Math.min(remaining, b.currentStockQuantity);
      if (take > 0) {
        allocations.push({
          batchId: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          allocatedQuantity: take,
          salePricePerUnit: b.salePricePerUnit,
          mrpPerUnit: b.mrpPerUnit
        });
        remaining -= take;
      }
    }

    const totalAllocated = dto.requestedQuantity - remaining;

    return {
      productId: dto.productId,
      requestedQuantity: dto.requestedQuantity,
      allocatedQuantity: totalAllocated,
      allocations,
      isFullyAllocated: remaining === 0
    };
  }

  /**
   * Manual Stock Adjustment with audit trail.
   */
  public async adjustStock(input: unknown, actor: SessionUser): Promise<InventoryBatch> {
    this.assertPermission(actor, PermissionCode.INVENTORY_ADJUST);
    const validated = validateSchema(stockAdjustmentSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for stock adjustment', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const batch = await this.batchRepo.findById(dto.batchId, actor.organizationId);
    if (!batch) {
      throw new BatchNotFoundError(dto.batchId);
    }

    let newQuantity: number;
    let delta: number;

    if (dto.isDelta) {
      delta = dto.adjustedQuantity;
      newQuantity = batch.currentStockQuantity + delta;
    } else {
      newQuantity = dto.adjustedQuantity;
      delta = newQuantity - batch.currentStockQuantity;
    }

    if (newQuantity < 0) {
      throw new NegativeStockError(`Adjustment would result in negative stock quantity: ${newQuantity}`);
    }

    const movementType =
      dto.movementType ?? (delta >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT');

    const updated = await this.batchRepo.updateQuantity(dto.batchId, actor.organizationId, newQuantity);

    await this.movementRepo.create({
      organizationId: actor.organizationId,
      productId: batch.productId,
      batchId: batch.id,
      movementType,
      quantityChange: delta,
      balanceAfter: newQuantity,
      referenceType: 'STOCK_ADJUSTMENT',
      notes: dto.reason,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.STOCK_ADJUSTED,
      resource: 'inventory_batch',
      result: AuditResult.SUCCESS,
      metadata: {
        batchId: batch.id,
        productId: batch.productId,
        quantityDelta: delta,
        newStock: newQuantity,
        reason: dto.reason
      }
    });

    return updated;
  }

  public async getBatchesByProduct(productId: string, actor: SessionUser): Promise<InventoryBatch[]> {
    this.assertPermission(actor, PermissionCode.BATCH_READ);
    return this.batchRepo.findByProduct(productId, actor.organizationId);
  }

  public async getExpiringSoon(withinDays = 90, actor: SessionUser): Promise<InventoryBatch[]> {
    this.assertPermission(actor, PermissionCode.BATCH_READ);
    return this.batchRepo.listExpiringSoon(actor.organizationId, withinDays);
  }

  public async getExpired(actor: SessionUser): Promise<InventoryBatch[]> {
    this.assertPermission(actor, PermissionCode.BATCH_READ);
    return this.batchRepo.listExpired(actor.organizationId);
  }

  public async getLowStock(actor: SessionUser): Promise<Array<{ product: any; totalStock: number; minStock: number }>> {
    this.assertPermission(actor, PermissionCode.INVENTORY_READ);
    return this.batchRepo.listLowStock(actor.organizationId);
  }

  public async getStockMovementsByProduct(productId: string, actor: SessionUser): Promise<StockMovement[]> {
    this.assertPermission(actor, PermissionCode.INVENTORY_READ);
    return this.movementRepo.findByProduct(productId, actor.organizationId);
  }

  public async getRecentStockMovements(actor: SessionUser, limit = 50): Promise<StockMovement[]> {
    this.assertPermission(actor, PermissionCode.INVENTORY_READ);
    return this.movementRepo.listRecent(actor.organizationId, limit);
  }
}
