import { DosageForm } from './Prescription.js';

export type ScheduleCategory = 'GENERAL' | 'H' | 'H1' | 'X';

export interface Manufacturer {
  id: string;
  organizationId: string;
  name: string;
  code?: string;
  country: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateManufacturerDTO {
  id?: string;
  organizationId: string;
  name: string;
  code?: string;
  country?: string;
  createdBy?: string;
}

export interface Medicine {
  id: string;
  organizationId: string;
  genericName: string;
  therapeuticClass?: string;
  isPrescriptionRequired: boolean;
  scheduleCategory: ScheduleCategory;
  storageInstructions?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateMedicineDTO {
  id?: string;
  organizationId: string;
  genericName: string;
  therapeuticClass?: string;
  isPrescriptionRequired?: boolean;
  scheduleCategory?: ScheduleCategory;
  storageInstructions?: string;
  createdBy?: string;
}

export interface UpdateMedicineDTO {
  genericName?: string;
  therapeuticClass?: string;
  isPrescriptionRequired?: boolean;
  scheduleCategory?: ScheduleCategory;
  storageInstructions?: string;
  isActive?: boolean;
}

export interface MedicineProduct {
  id: string;
  organizationId: string;
  medicineId: string;
  medicine?: Medicine;
  manufacturerId?: string;
  manufacturer?: Manufacturer;
  brandName: string;
  productCode?: string;
  barcode?: string;
  strength: string;
  dosageForm: DosageForm;
  packSize: string; // e.g. '10 Tablets / Strip'
  packQuantity: number; // Base units per pack, e.g. 10
  unitOfMeasure: string; // PIECE, STRIP, BOTTLE, VIAL
  hsnCode?: string;
  taxRatePercent: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderQuantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateMedicineProductDTO {
  id?: string;
  organizationId: string;
  medicineId: string;
  manufacturerId?: string;
  brandName: string;
  productCode?: string;
  barcode?: string;
  strength: string;
  dosageForm: DosageForm;
  packSize: string;
  packQuantity: number;
  unitOfMeasure?: string;
  hsnCode?: string;
  taxRatePercent?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderQuantity?: number;
  createdBy?: string;
}

export interface UpdateMedicineProductDTO {
  manufacturerId?: string;
  brandName?: string;
  productCode?: string;
  barcode?: string;
  strength?: string;
  dosageForm?: DosageForm;
  packSize?: string;
  packQuantity?: number;
  unitOfMeasure?: string;
  hsnCode?: string;
  taxRatePercent?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderQuantity?: number;
  isActive?: boolean;
  updatedBy?: string;
}
