import { z } from 'zod';

export const createPurchaseItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  batchNumber: z.string().min(1, 'Batch number is required').max(100),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
  packQuantity: z.number().int().positive('Pack quantity must be at least 1'),
  freePackQuantity: z.number().int().min(0).optional().default(0),
  packSizeMultiplier: z.number().int().positive('Pack size multiplier must be at least 1').default(1),
  purchaseRatePerPack: z.number().min(0, 'Purchase rate must be positive'),
  mrpPerUnit: z.number().min(0, 'MRP must be positive'),
  salePricePerUnit: z.number().min(0).optional(),
  taxRatePercent: z.number().min(0).max(100).optional().default(0.0)
});

export const createPurchaseInvoiceSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').max(100),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date must be in YYYY-MM-DD format'),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  discountAmount: z.number().min(0).optional().default(0.0),
  paymentStatus: z.enum(['PAID', 'PENDING', 'PARTIAL']).optional().default('PAID'),
  notes: z.string().max(500).optional(),
  items: z.array(createPurchaseItemSchema).min(1, 'Purchase invoice must have at least one line item'),
  createdBy: z.string().min(1).optional()
});
