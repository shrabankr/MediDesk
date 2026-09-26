import {
  StockReconciliationSession,
  StockReconciliationItem,
  CreateReconciliationSessionDTO,
  AddReconciliationItemDTO,
  UpdateReconciliationItemDTO,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  IStockReconciliationRepository,
  IInventoryBatchRepository,
  IStockMovementRepository,
  IMedicineProductRepository,
  AuthorizationError,
  ValidationError,
  BatchNotFoundError,
  NegativeStockError,
  StockMovementType
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import { PackagingUnitService } from './PackagingUnitService.js';
import {
  createReconciliationSessionSchema,
  addReconciliationItemSchema,
  updateReconciliationItemSchema,
  submitReconciliationSchema,
  reviewReconciliationSchema,
  validateSchema
} from '@medidesk/validation';

export class StockReconciliationService {
  constructor(
    private reconciliationRepo: IStockReconciliationRepository,
    private batchRepo: IInventoryBatchRepository,
    private movementRepo: IStockMovementRepository,
    private productRepo: IMedicineProductRepository,
    private packagingService: PackagingUnitService,
    private auditService: AuditService,
    private rbac: RBACEngine
  ) {}

  private assertPermission(actor: SessionUser, permission: string): void {
    if (!this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  /**
   * 1. Create a new physical stock count session (DRAFT state).
   */
  async createSession(input: unknown, actor: SessionUser): Promise<StockReconciliationSession> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_CREATE);
    const validated = validateSchema(createReconciliationSessionSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for reconciliation session', validated.errors);
    }

    const session = await this.reconciliationRepo.createSession({
      organizationId: actor.organizationId,
      notes: validated.data.notes,
      countedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.RECONCILIATION_CREATED,
      resource: 'stock_reconciliation_session',
      result: AuditResult.SUCCESS,
      metadata: {
        sessionId: session.id,
        sessionNumber: session.sessionNumber
      }
    });

    return session;
  }

  /**
   * 2. Add or record an item count in an active reconciliation session.
   */
  async addItem(input: unknown, actor: SessionUser): Promise<StockReconciliationItem> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_CREATE);
    const validated = validateSchema(addReconciliationItemSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for reconciliation item', validated.errors);
    }
    const dto = validated.data;

    const session = await this.reconciliationRepo.findSessionById(dto.sessionId, actor.organizationId);
    if (!session) {
      throw new ValidationError(`Reconciliation session not found: ${dto.sessionId}`);
    }
    if (session.status !== 'DRAFT' && session.status !== 'COUNTED') {
      throw new ValidationError(`Cannot add items to session in ${session.status} status.`);
    }

    const batch = await this.batchRepo.findById(dto.batchId, actor.organizationId);
    if (!batch) {
      throw new BatchNotFoundError(dto.batchId);
    }

    const product = await this.productRepo.findById(dto.productId, actor.organizationId);

    // Calculate physical quantity in base units if packaged count entered
    let physicalBaseUnits = dto.physicalStockQuantity;
    if (dto.packagingUnitName && dto.packagingUnitQuantity != null && dto.packagingUnitQuantity > 0) {
      const converted = await this.packagingService.convertPackageToBaseUnits(
        dto.productId,
        dto.packagingUnitName,
        dto.packagingUnitQuantity,
        actor.organizationId
      );
      physicalBaseUnits = converted.totalBaseUnits;
    }

    const systemQty = batch.currentStockQuantity;

    const item = await this.reconciliationRepo.addItem(
      {
        sessionId: dto.sessionId,
        organizationId: actor.organizationId,
        productId: dto.productId,
        batchId: dto.batchId,
        physicalStockQuantity: physicalBaseUnits,
        varianceReason: dto.varianceReason,
        notes: dto.notes,
        packagingUnitName: dto.packagingUnitName,
        packagingUnitQuantity: dto.packagingUnitQuantity
      },
      systemQty,
      batch.batchNumber,
      batch.expiryDate,
      product?.brandName
    );

    if (session.status === 'DRAFT') {
      await this.reconciliationRepo.updateSessionStatus(session.id, actor.organizationId, 'COUNTED');
    }

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.RECONCILIATION_ITEM_UPDATED,
      resource: 'stock_reconciliation_item',
      result: AuditResult.SUCCESS,
      metadata: {
        sessionId: session.id,
        itemId: item.id,
        batchNumber: batch.batchNumber,
        systemQuantity: systemQty,
        physicalQuantity: physicalBaseUnits,
        varianceQuantity: physicalBaseUnits - systemQty
      }
    });

    return item;
  }

  /**
   * 3. Update an existing item's physical count or variance reason.
   */
  async updateItem(input: unknown, sessionId: string, actor: SessionUser): Promise<StockReconciliationItem> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_CREATE);
    const validated = validateSchema(updateReconciliationItemSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for item update', validated.errors);
    }
    const dto = validated.data;

    const session = await this.reconciliationRepo.findSessionById(sessionId, actor.organizationId);
    if (!session) {
      throw new ValidationError(`Reconciliation session not found: ${sessionId}`);
    }
    if (session.status !== 'DRAFT' && session.status !== 'COUNTED') {
      throw new ValidationError(`Cannot modify items in ${session.status} status.`);
    }

    const existingItem = session.items.find((i) => i.id === dto.itemId);
    if (!existingItem) {
      throw new ValidationError(`Item ${dto.itemId} not found in session.`);
    }

    let physicalBaseUnits = dto.physicalStockQuantity;
    if (dto.packagingUnitName && dto.packagingUnitQuantity != null && dto.packagingUnitQuantity > 0) {
      const converted = await this.packagingService.convertPackageToBaseUnits(
        existingItem.productId,
        dto.packagingUnitName,
        dto.packagingUnitQuantity,
        actor.organizationId
      );
      physicalBaseUnits = converted.totalBaseUnits;
    }

    const varianceQty = physicalBaseUnits - existingItem.systemStockQuantity;
    const isLarge =
      Math.abs(varianceQty) >= 20 ||
      (existingItem.systemStockQuantity > 0 && Math.abs(varianceQty) / existingItem.systemStockQuantity >= 0.2);

    const updated = await this.reconciliationRepo.updateItem(
      dto.itemId,
      physicalBaseUnits,
      varianceQty,
      dto.varianceReason,
      isLarge,
      dto.notes,
      dto.packagingUnitName,
      dto.packagingUnitQuantity
    );

    return updated;
  }

  /**
   * 4. Remove an item from an in-progress draft count.
   */
  async deleteItem(itemId: string, sessionId: string, actor: SessionUser): Promise<boolean> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_CREATE);
    const session = await this.reconciliationRepo.findSessionById(sessionId, actor.organizationId);
    if (!session) {
      throw new ValidationError(`Reconciliation session not found: ${sessionId}`);
    }
    if (session.status !== 'DRAFT' && session.status !== 'COUNTED') {
      throw new ValidationError(`Cannot delete items in ${session.status} status.`);
    }

    return this.reconciliationRepo.deleteItem(itemId, sessionId);
  }

  /**
   * 5. Submit count session for Owner review.
   */
  async submitSession(input: unknown, actor: SessionUser): Promise<StockReconciliationSession> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_SUBMIT);
    const validated = validateSchema(submitReconciliationSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for session submission', validated.errors);
    }
    const { sessionId } = validated.data;

    const session = await this.reconciliationRepo.findSessionById(sessionId, actor.organizationId);
    if (!session) {
      throw new ValidationError(`Reconciliation session not found: ${sessionId}`);
    }
    if (session.status !== 'DRAFT' && session.status !== 'COUNTED') {
      throw new ValidationError(`Session cannot be submitted from current status: ${session.status}`);
    }
    if (session.items.length === 0) {
      throw new ValidationError('Cannot submit an empty reconciliation session. Count at least one item.');
    }

    const updated = await this.reconciliationRepo.updateSessionStatus(sessionId, actor.organizationId, 'SUBMITTED', {
      submittedBy: actor.id,
      submittedAt: new Date()
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.RECONCILIATION_SUBMITTED,
      resource: 'stock_reconciliation_session',
      result: AuditResult.SUCCESS,
      metadata: {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        totalItems: session.items.length
      }
    });

    return updated;
  }

  /**
   * 6. Owner Review & Approval / Rejection with Compensating Ledger Post.
   *
   * CONCURRENCY & CONFLICT STRATEGY:
   * - Validates live current stock for each batch.
   * - Calculates variance adjustment against live stock.
   * - Prevents negative stock creation if concurrent sales occurred.
   * - Creates immutable compensating StockMovement records without overwriting history.
   */
  async reviewSession(input: unknown, actor: SessionUser): Promise<StockReconciliationSession> {
    const validated = validateSchema(reviewReconciliationSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for review', validated.errors);
    }
    const { sessionId, action, reviewNotes } = validated.data;

    if (action === 'APPROVE') {
      this.assertPermission(actor, PermissionCode.RECONCILIATION_APPROVE);
    } else {
      this.assertPermission(actor, PermissionCode.RECONCILIATION_REJECT);
    }

    const session = await this.reconciliationRepo.findSessionById(sessionId, actor.organizationId);
    if (!session) {
      throw new ValidationError(`Reconciliation session not found: ${sessionId}`);
    }
    if (session.status !== 'SUBMITTED') {
      throw new ValidationError(`Session is not in SUBMITTED status (currently ${session.status}).`);
    }

    const now = new Date();

    if (action === 'REJECT') {
      const rejected = await this.reconciliationRepo.updateSessionStatus(sessionId, actor.organizationId, 'REJECTED', {
        reviewedBy: actor.id,
        reviewedAt: now,
        reviewNotes: reviewNotes || 'Rejected by Owner'
      });

      await this.auditService.logEvent({
        actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
        action: AuditAction.RECONCILIATION_REJECTED,
        resource: 'stock_reconciliation_session',
        result: AuditResult.SUCCESS,
        metadata: {
          sessionId: session.id,
          sessionNumber: session.sessionNumber,
          reviewNotes
        }
      });

      return rejected;
    }

    // ACTION: APPROVE & POST COMPENSATING LEDGER MOVEMENTS
    this.assertPermission(actor, PermissionCode.RECONCILIATION_POST);

    for (const item of session.items) {
      const liveBatch = await this.batchRepo.findById(item.batchId, actor.organizationId);
      if (!liveBatch) {
        throw new BatchNotFoundError(item.batchId);
      }

      const liveStock = liveBatch.currentStockQuantity;
      const delta = item.varianceQuantity; // physical - system_at_count_time

      // Concurrent stock adjustment calculation:
      // If liveStock changed since count time, target = liveStock + delta
      const targetBalance = liveStock + delta;
      if (targetBalance < 0) {
        throw new NegativeStockError(
          `Cannot approve reconciliation: Concurrent sales reduced batch ${liveBatch.batchNumber} stock below variance threshold (Live: ${liveStock}, Variance: ${delta}, Target: ${targetBalance}). Please recount.`
        );
      }

      // Update live batch quantity in atomic transaction
      await this.batchRepo.updateQuantity(item.batchId, actor.organizationId, targetBalance);

      // Determine movement type
      let movementType: StockMovementType = 'ADJUSTMENT_IN';
      if (delta < 0) {
        if (item.varianceReason === 'DAMAGE') {
          movementType = 'DAMAGED_WRITE_OFF';
        } else if (item.varianceReason === 'EXPIRY_DISPOSAL') {
          movementType = 'EXPIRED_DISCARD';
        } else {
          movementType = 'ADJUSTMENT_OUT';
        }
      }

      // Create compensating StockMovement record
      if (delta !== 0) {
        await this.movementRepo.create({
          organizationId: actor.organizationId,
          productId: item.productId,
          batchId: item.batchId,
          movementType,
          quantityChange: delta,
          balanceAfter: targetBalance,
          referenceType: 'STOCK_RECONCILIATION',
          referenceId: session.id,
          notes: `Reconciliation [${session.sessionNumber}]: ${item.varianceReason}${item.notes ? ` - ${item.notes}` : ''}`,
          createdBy: actor.id
        });
      }
    }

    const posted = await this.reconciliationRepo.updateSessionStatus(sessionId, actor.organizationId, 'POSTED', {
      reviewedBy: actor.id,
      reviewedAt: now,
      reviewNotes,
      postedAt: now
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.RECONCILIATION_POSTED,
      resource: 'stock_reconciliation_session',
      result: AuditResult.SUCCESS,
      metadata: {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        itemsAdjusted: session.items.length,
        reviewNotes
      }
    });

    return posted;
  }

  /**
   * 7. Get a specific reconciliation session with items.
   */
  async getSessionById(sessionId: string, actor: SessionUser): Promise<StockReconciliationSession | null> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_READ);
    return this.reconciliationRepo.findSessionById(sessionId, actor.organizationId);
  }

  /**
   * 8. List reconciliation history for the clinic.
   */
  async listSessions(actor: SessionUser, limit = 50): Promise<StockReconciliationSession[]> {
    this.assertPermission(actor, PermissionCode.RECONCILIATION_READ);
    return this.reconciliationRepo.listSessions(actor.organizationId, limit);
  }
}
