import { z } from 'zod';

export const createTaxRuleSchema = z.object({
  id: z.string().min(1).optional(),
  organizationId: z.string().min(1, 'Organization ID is required'),
  taxName: z.string().min(1, 'Tax name is required').max(100),
  ratePercent: z.number().min(0).max(100),
  cgstPercent: z.number().min(0).max(100).optional(),
  sgstPercent: z.number().min(0).max(100).optional(),
  igstPercent: z.number().min(0).max(100).optional(),
  createdBy: z.string().min(1).optional()
});
