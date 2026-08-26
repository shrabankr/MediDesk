export interface ProductPackagingUnit {
  id: string;
  organizationId: string;
  productId: string;
  unitName: string; // e.g. 'BOX', 'STRIP', 'BOTTLE', 'PACK', 'VIAL', 'CASE'
  conversionFactor: number; // Number of atomic base units (integer >= 1)
  salePricePaise: number; // Package sale price in integer Paise
  mrpPaise: number; // Package MRP in integer Paise
  barcode?: string;
  isDefaultSaleUnit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductPackagingUnitDTO {
  id?: string;
  organizationId: string;
  productId: string;
  unitName: string;
  conversionFactor: number;
  salePricePaise: number;
  mrpPaise: number;
  barcode?: string;
  isDefaultSaleUnit?: boolean;
}

export interface UpdateProductPackagingUnitDTO {
  unitName?: string;
  conversionFactor?: number;
  salePricePaise?: number;
  mrpPaise?: number;
  barcode?: string;
  isDefaultSaleUnit?: boolean;
}

export interface UnitConversionResult {
  productId: string;
  unitName: string;
  packageQuantity: number;
  totalBaseUnits: number;
  calculatedPricePaise: number;
  calculatedMrpPaise: number;
}
