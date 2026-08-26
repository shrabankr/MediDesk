import { ProductPackagingUnit, CreateProductPackagingUnitDTO, UpdateProductPackagingUnitDTO } from '../entities/PackagingUnit.js';

export interface IPackagingUnitRepository {
  create(dto: CreateProductPackagingUnitDTO): Promise<ProductPackagingUnit>;
  findById(id: string): Promise<ProductPackagingUnit | null>;
  findByProduct(productId: string): Promise<ProductPackagingUnit[]>;
  findByBarcode(organizationId: string, barcode: string): Promise<ProductPackagingUnit | null>;
  findByUnitName(productId: string, unitName: string): Promise<ProductPackagingUnit | null>;
  update(id: string, dto: UpdateProductPackagingUnitDTO): Promise<ProductPackagingUnit>;
  delete(id: string): Promise<boolean>;
}
