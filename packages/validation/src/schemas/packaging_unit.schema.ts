import { z } from 'zod';

export const CreatePackagingUnitSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  unitName: z
    .string()
    .min(1, 'Unit name is required')
    .max(50, 'Unit name cannot exceed 50 characters')
    .transform((val) => val.trim().toUpperCase()),
  conversionFactor: z
    .number()
    .int('Conversion factor must be an integer')
    .min(1, 'Conversion factor must be at least 1 base unit'),
  salePricePaise: z
    .number()
    .int('Sale price must be in integer paise')
    .min(0, 'Sale price cannot be negative'),
  mrpPaise: z
    .number()
    .int('MRP must be in integer paise')
    .min(0, 'MRP cannot be negative'),
  barcode: z.string().max(100).optional(),
  isDefaultSaleUnit: z.boolean().optional()
});

export const UpdatePackagingUnitSchema = z.object({
  unitName: z
    .string()
    .min(1)
    .max(50)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  conversionFactor: z
    .number()
    .int('Conversion factor must be an integer')
    .min(1, 'Conversion factor must be at least 1 base unit')
    .optional(),
  salePricePaise: z
    .number()
    .int('Sale price must be in integer paise')
    .min(0, 'Sale price cannot be negative')
    .optional(),
  mrpPaise: z
    .number()
    .int('MRP must be in integer paise')
    .min(0, 'MRP cannot be negative')
    .optional(),
  barcode: z.string().max(100).optional(),
  isDefaultSaleUnit: z.boolean().optional()
});

export const ConvertQuantitySchema = z.object({
  productId: z.string().min(1),
  unitName: z.string().min(1),
  packageQuantity: z.number().int().min(1)
});
