import { z } from 'zod';

export const createSaleItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  batchId: z.string().min(1, 'Batch ID is required'),
  quantity: z.number().int().positive('Sale quantity must be positive'),
  unitSalePrice: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional().default(0.0)
});

export const createSaleSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  customerType: z.enum(['WALK_IN', 'PATIENT']).default('WALK_IN'),
  patientId: z.string().min(1).optional(),
  customerName: z.string().min(1, 'Customer name is required').max(200),
  customerPhone: z.string().max(20).optional(),
  prescribingDoctorId: z.string().min(1).optional(),
  prescribingDoctorName: z.string().max(200).optional(),
  prescriptionId: z.string().min(1).optional(),
  discountAmount: z.number().min(0).optional().default(0.0),
  paymentMode: z.enum(['CASH', 'UPI', 'CARD', 'SPLIT', 'DUE']).default('CASH'),
  items: z.array(createSaleItemSchema).min(1, 'Sale must contain at least one item'),
  createdBy: z.string().min(1).optional()
});

export const createSaleReturnSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  saleId: z.string().min(1, 'Sale ID is required'),
  reason: z.string().min(3, 'Return reason is required').max(500),
  refundMode: z.string().max(50).optional().default('CASH'),
  items: z.array(
    z.object({
      saleItemId: z.string().min(1, 'Sale item ID is required'),
      quantity: z.number().int().positive('Return quantity must be positive')
    })
  ).min(1, 'Must return at least one item'),
  createdBy: z.string().min(1).optional()
});
