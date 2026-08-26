import { z } from 'zod';

export const createManufacturerSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  name: z.string().min(1, 'Manufacturer name is required').max(200),
  code: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  createdBy: z.string().min(1).optional()
});

export const createMedicineSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  genericName: z.string().min(1, 'Generic medicine name is required').max(255),
  therapeuticClass: z.string().max(255).optional(),
  isPrescriptionRequired: z.boolean().optional().default(false),
  scheduleCategory: z.enum(['GENERAL', 'H', 'H1', 'X']).optional().default('GENERAL'),
  storageInstructions: z.string().max(255).optional(),
  createdBy: z.string().min(1).optional()
});

export const updateMedicineSchema = z.object({
  genericName: z.string().min(1).max(255).optional(),
  therapeuticClass: z.string().max(255).optional(),
  isPrescriptionRequired: z.boolean().optional(),
  scheduleCategory: z.enum(['GENERAL', 'H', 'H1', 'X']).optional(),
  storageInstructions: z.string().max(255).optional(),
  isActive: z.boolean().optional()
});

export const createMedicineProductSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  medicineId: z.string().min(1, 'Medicine ID is required'),
  manufacturerId: z.string().min(1).optional(),
  brandName: z.string().min(1, 'Brand name is required').max(255),
  productCode: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  strength: z.string().min(1, 'Strength is required').max(100),
  dosageForm: z.enum(['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'OINTMENT', 'INHALER', 'OTHER']),
  packSize: z.string().min(1, 'Pack size is required').max(100),
  packQuantity: z.number().int().positive('Pack quantity must be at least 1').default(1),
  unitOfMeasure: z.string().max(50).optional().default('PIECE'),
  hsnCode: z.string().max(20).optional(),
  taxRatePercent: z.number().min(0).max(100).optional().default(0.0),
  minStockLevel: z.number().int().min(0).optional().default(10),
  maxStockLevel: z.number().int().min(0).optional().default(1000),
  reorderQuantity: z.number().int().min(0).optional().default(50),
  createdBy: z.string().min(1).optional()
});

export const updateMedicineProductSchema = z.object({
  manufacturerId: z.string().min(1).optional(),
  brandName: z.string().min(1).max(255).optional(),
  productCode: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  strength: z.string().min(1).max(100).optional(),
  dosageForm: z.enum(['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'OINTMENT', 'INHALER', 'OTHER']).optional(),
  packSize: z.string().min(1).max(100).optional(),
  packQuantity: z.number().int().positive().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  hsnCode: z.string().max(20).optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  minStockLevel: z.number().int().min(0).optional(),
  maxStockLevel: z.number().int().min(0).optional(),
  reorderQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  updatedBy: z.string().min(1).optional()
});
