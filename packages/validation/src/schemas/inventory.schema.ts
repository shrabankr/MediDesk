import { z } from 'zod';

export const createInventoryBatchSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  batchNumber: z.string().min(1, 'Batch number is required').max(100),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
  purchasePricePerUnit: z.number().min(0, 'Purchase price must be positive'),
  mrpPerUnit: z.number().min(0, 'MRP must be positive'),
  salePricePerUnit: z.number().min(0, 'Sale price must be positive'),
  initialStockQuantity: z.number().int().min(0, 'Initial stock quantity cannot be negative'),
  supplierId: z.string().min(1).optional(),
  purchaseItemId: z.string().min(1).optional()
});

export const stockAdjustmentSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  productId: z.string().min(1).optional(),
  batchId: z.string().min(1, 'Batch ID is required'),
  adjustedQuantity: z.number().int(),
  isDelta: z.boolean().optional().default(false),
  reason: z.string().min(3, 'Adjustment reason is required').max(500),
  movementType: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED_DISCARD', 'DAMAGED_WRITE_OFF']).optional(),
  adjustedBy: z.string().min(1).optional()
});

export const fefoAllocationSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  requestedQuantity: z.number().int().positive('Requested quantity must be at least 1')
});
