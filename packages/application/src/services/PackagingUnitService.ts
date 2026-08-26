import {
  IPackagingUnitRepository,
  IMedicineProductRepository,
  ProductPackagingUnit,
  CreateProductPackagingUnitDTO,
  UpdateProductPackagingUnitDTO,
  UnitConversionResult,
  AuditAction,
  AuditResult
} from '@medidesk/domain';
import { IAuditService } from '@medidesk/audit';
import { CreatePackagingUnitSchema, UpdatePackagingUnitSchema } from '@medidesk/validation';

export class PackagingUnitService {
  constructor(
    private packagingUnitRepo: IPackagingUnitRepository,
    private productRepo: IMedicineProductRepository,
    private auditService: IAuditService
  ) {}

  async createPackagingUnit(
    dto: CreateProductPackagingUnitDTO,
    actorId: string
  ): Promise<ProductPackagingUnit> {
    const validated = CreatePackagingUnitSchema.parse(dto);

    // Verify product exists
    const product = await this.productRepo.findById(validated.productId, validated.organizationId);
    if (!product) {
      throw new Error(`Product ${validated.productId} not found in organization`);
    }

    // Check for duplicate unit name for the same product
    const existing = await this.packagingUnitRepo.findByUnitName(
      validated.productId,
      validated.unitName
    );
    if (existing) {
      throw new Error(
        `Packaging unit '${validated.unitName}' already exists for product '${product.brandName}'`
      );
    }

    // Validate conversion factor (must be integer >= 1)
    if (validated.conversionFactor < 1 || !Number.isInteger(validated.conversionFactor)) {
      throw new Error('Conversion factor must be an integer >= 1');
    }

    const created = await this.packagingUnitRepo.create({
      ...validated,
      organizationId: validated.organizationId
    });

    await this.auditService.logEvent({
      action: AuditAction.PACKAGING_UNIT_CREATED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: created.id,
      metadata: {
        productId: created.productId,
        unitName: created.unitName,
        conversionFactor: created.conversionFactor,
        salePricePaise: created.salePricePaise,
        mrpPaise: created.mrpPaise
      }
    });

    return created;
  }

  async getPackagingUnitsByProduct(productId: string): Promise<ProductPackagingUnit[]> {
    return this.packagingUnitRepo.findByProduct(productId);
  }

  async updatePackagingUnit(
    id: string,
    dto: UpdateProductPackagingUnitDTO,
    actorId: string,
    organizationId: string
  ): Promise<ProductPackagingUnit> {
    const validated = UpdatePackagingUnitSchema.parse(dto);
    const existing = await this.packagingUnitRepo.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error(`Packaging unit ${id} not found`);
    }

    if (validated.conversionFactor !== undefined) {
      if (validated.conversionFactor < 1 || !Number.isInteger(validated.conversionFactor)) {
        throw new Error('Conversion factor must be an integer >= 1');
      }
    }

    const updated = await this.packagingUnitRepo.update(id, validated);

    await this.auditService.logEvent({
      action: AuditAction.PACKAGING_UNIT_UPDATED,
      actor: { id: actorId, username: actorId },
      result: AuditResult.SUCCESS,
      resource: updated.id,
      metadata: {
        productId: updated.productId,
        unitName: updated.unitName,
        conversionFactor: updated.conversionFactor,
        salePricePaise: updated.salePricePaise
      }
    });

    return updated;
  }

  async deletePackagingUnit(
    id: string,
    actorId: string,
    organizationId: string
  ): Promise<boolean> {
    const existing = await this.packagingUnitRepo.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error(`Packaging unit ${id} not found`);
    }

    const deleted = await this.packagingUnitRepo.delete(id);

    if (deleted) {
      await this.auditService.logEvent({
        action: AuditAction.PACKAGING_UNIT_DELETED,
        actor: { id: actorId, username: actorId },
        result: AuditResult.SUCCESS,
        resource: id,
        metadata: {
          productId: existing.productId,
          unitName: existing.unitName
        }
      });
    }

    return deleted;
  }

  /**
   * Converts package quantity to base units with deterministic integer arithmetic.
   * e.g., 3 Boxes (100 base units/box) -> 300 base units.
   */
  async convertPackageToBaseUnits(
    productId: string,
    unitName: string,
    packageQuantity: number,
    organizationId?: string
  ): Promise<UnitConversionResult> {
    if (packageQuantity <= 0 || !Number.isInteger(packageQuantity)) {
      throw new Error('Package quantity must be a positive integer');
    }

    const units = await this.packagingUnitRepo.findByProduct(productId);
    const matched = units.find(
      (u) => u.unitName.toUpperCase() === unitName.trim().toUpperCase()
    );

    if (!matched) {
      // Fallback: If unitName is the base unit itself (factor = 1)
      const product = organizationId
        ? await this.productRepo.findById(productId, organizationId)
        : null;
      if (
        product &&
        (unitName.toUpperCase() === 'BASE' ||
          unitName.toUpperCase() === product.unitOfMeasure.toUpperCase())
      ) {
        return {
          productId,
          unitName: product.unitOfMeasure,
          packageQuantity,
          totalBaseUnits: packageQuantity,
          calculatedPricePaise: 0,
          calculatedMrpPaise: 0
        };
      }
      throw new Error(
        `Packaging unit '${unitName}' not found for product ${productId}`
      );
    }

    const totalBaseUnits = packageQuantity * matched.conversionFactor;
    const calculatedPricePaise = packageQuantity * matched.salePricePaise;
    const calculatedMrpPaise = packageQuantity * matched.mrpPaise;

    return {
      productId,
      unitName: matched.unitName,
      packageQuantity,
      totalBaseUnits,
      calculatedPricePaise,
      calculatedMrpPaise
    };
  }

  /**
   * Deterministically calculates base unit price from package price with Half-Up rounding.
   */
  calculateBaseUnitPricePaise(
    packagePricePaise: number,
    conversionFactor: number
  ): number {
    if (conversionFactor <= 0) throw new Error('Conversion factor must be >= 1');
    // Half-Up rounding: Math.floor((price + (factor / 2)) / factor)
    return Math.floor((packagePricePaise + Math.floor(conversionFactor / 2)) / conversionFactor);
  }
}
