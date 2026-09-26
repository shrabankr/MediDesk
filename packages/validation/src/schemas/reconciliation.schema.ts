import { z } from 'zod';

export const createReconciliationSessionSchema = z.object({
  notes: z.string().max(500).optional()
});

export const addReconciliationItemSchema = z.object({
  sessionId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().min(1),
  physicalStockQuantity: z.number().int().min(0),
  varianceReason: z
    .enum(['DAMAGE', 'EXPIRY_DISPOSAL', 'SHRINKAGE', 'AUDIT_CORRECTION', 'OTHER'])
    .default('AUDIT_CORRECTION'),
  notes: z.string().max(500).optional(),
  packagingUnitName: z.string().max(50).optional(),
  packagingUnitQuantity: z.number().int().min(0).optional()
});

export const updateReconciliationItemSchema = z.object({
  itemId: z.string().min(1),
  physicalStockQuantity: z.number().int().min(0),
  varianceReason: z.enum(['DAMAGE', 'EXPIRY_DISPOSAL', 'SHRINKAGE', 'AUDIT_CORRECTION', 'OTHER']),
  notes: z.string().max(500).optional(),
  packagingUnitName: z.string().max(50).optional(),
  packagingUnitQuantity: z.number().int().min(0).optional()
});

export const submitReconciliationSchema = z.object({
  sessionId: z.string().min(1)
});

export const reviewReconciliationSchema = z.object({
  sessionId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  reviewNotes: z.string().max(500).optional()
});
