import {
  Medicine,
  MedicineProduct,
  Manufacturer,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  IMedicineRepository,
  IMedicineProductRepository,
  MedicineNotFoundError,
  AuthorizationError,
  ValidationError
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';
import {
  createMedicineSchema,
  updateMedicineSchema,
  createManufacturerSchema,
  createMedicineProductSchema,
  updateMedicineProductSchema,
  validateSchema
} from '@medidesk/validation';

export class MedicineMasterService {
  private medRepo: IMedicineRepository;
  private productRepo: IMedicineProductRepository;
  private auditService: AuditService;
  private rbac: RBACEngine;

  constructor(
    medRepo: IMedicineRepository,
    productRepo: IMedicineProductRepository,
    auditService: AuditService,
    rbac: RBACEngine
  ) {
    this.medRepo = medRepo;
    this.productRepo = productRepo;
    this.auditService = auditService;
    this.rbac = rbac;
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (!this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  // 1. Generic Medicines
  public async createMedicine(
    input: unknown,
    actor: SessionUser
  ): Promise<Medicine> {
    this.assertPermission(actor, PermissionCode.MEDICINE_CREATE);
    const validated = validateSchema(createMedicineSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for generic medicine creation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const created = await this.medRepo.create({
      ...dto,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.MEDICINE_CREATED,
      resource: 'medicine',
      result: AuditResult.SUCCESS,
      metadata: {
        medicineId: created.id,
        genericName: created.genericName
      }
    });

    return created;
  }

  public async updateMedicine(
    id: string,
    input: unknown,
    actor: SessionUser
  ): Promise<Medicine> {
    this.assertPermission(actor, PermissionCode.MEDICINE_UPDATE);
    const validated = validateSchema(updateMedicineSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for generic medicine update', validated.errors);
    }
    const dto = validated.data;

    const updated = await this.medRepo.update(id, actor.organizationId, dto);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.MEDICINE_UPDATED,
      resource: 'medicine',
      result: AuditResult.SUCCESS,
      metadata: {
        medicineId: updated.id,
        genericName: updated.genericName
      }
    });

    return updated;
  }

  public async getMedicineById(id: string, actor: SessionUser): Promise<Medicine | null> {
    this.assertPermission(actor, PermissionCode.MEDICINE_READ);
    return this.medRepo.findById(id, actor.organizationId);
  }

  public async searchMedicines(query: string, actor: SessionUser, limit = 20): Promise<Medicine[]> {
    this.assertPermission(actor, PermissionCode.MEDICINE_READ);
    if (!query || query.trim().length === 0) {
      return this.medRepo.list(actor.organizationId, limit);
    }
    return this.medRepo.search(actor.organizationId, query, limit);
  }

  // 2. Manufacturers
  public async createManufacturer(input: unknown, actor: SessionUser): Promise<Manufacturer> {
    this.assertPermission(actor, PermissionCode.MEDICINE_CREATE);
    const validated = validateSchema(createManufacturerSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for manufacturer creation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    return this.medRepo.createManufacturer({
      ...dto,
      createdBy: actor.id
    });
  }

  public async listManufacturers(actor: SessionUser): Promise<Manufacturer[]> {
    this.assertPermission(actor, PermissionCode.MEDICINE_READ);
    return this.medRepo.listManufacturers(actor.organizationId);
  }

  // 3. Medicine Product Variants (SKUs)
  public async createProduct(
    input: unknown,
    actor: SessionUser
  ): Promise<MedicineProduct> {
    this.assertPermission(actor, PermissionCode.MEDICINE_CREATE);
    const validated = validateSchema(createMedicineProductSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for product variant creation', validated.errors);
    }
    const dto = validated.data;

    if (dto.organizationId !== actor.organizationId) {
      throw new AuthorizationError('Organization boundary violation.');
    }

    const genericMed = await this.medRepo.findById(dto.medicineId, actor.organizationId);
    if (!genericMed) {
      throw new MedicineNotFoundError(dto.medicineId);
    }

    const created = await this.productRepo.create({
      ...dto,
      createdBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.MEDICINE_CREATED,
      resource: 'medicine_product',
      result: AuditResult.SUCCESS,
      metadata: {
        productId: created.id,
        brandName: created.brandName,
        barcode: created.barcode
      }
    });

    return created;
  }

  public async updateProduct(
    id: string,
    input: unknown,
    actor: SessionUser
  ): Promise<MedicineProduct> {
    this.assertPermission(actor, PermissionCode.MEDICINE_UPDATE);
    const validated = validateSchema(updateMedicineProductSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for product variant update', validated.errors);
    }
    const dto = validated.data;

    const updated = await this.productRepo.update(id, actor.organizationId, {
      ...dto,
      updatedBy: actor.id
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.MEDICINE_UPDATED,
      resource: 'medicine_product',
      result: AuditResult.SUCCESS,
      metadata: {
        productId: updated.id,
        brandName: updated.brandName
      }
    });

    return updated;
  }

  public async getProductById(id: string, actor: SessionUser): Promise<MedicineProduct | null> {
    this.assertPermission(actor, PermissionCode.MEDICINE_READ);
    return this.productRepo.findById(id, actor.organizationId);
  }

  public async getProductByBarcode(barcode: string, actor: SessionUser): Promise<MedicineProduct | null> {
    this.assertPermission(actor, PermissionCode.MEDICINE_READ);
    return this.productRepo.findByBarcode(barcode, actor.organizationId);
  }

  public async searchProducts(query: string, actor: SessionUser, limit = 20): Promise<MedicineProduct[]> {
    this.assertPermission(actor, PermissionCode.MEDICINE_READ);
    if (!query || query.trim().length === 0) {
      return this.productRepo.list(actor.organizationId, limit);
    }
    return this.productRepo.search(actor.organizationId, query, limit);
  }
}
