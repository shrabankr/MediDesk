import { z } from 'zod';

export const AlertCategoryEnum = z.enum(['INVENTORY', 'SALES', 'CLINICAL', 'SYSTEM']);
export const AlertSeverityEnum = z.enum(['INFO', 'WARNING', 'CRITICAL', 'MANDATORY_SAFETY']);
export const AlertStatusEnum = z.enum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']);
export const AlertEntityTypeEnum = z.enum(['PRODUCT', 'BATCH', 'VISIT', 'BACKUP', 'LICENSE', 'TRANSACTION', 'HARDWARE']);

export const CreateAlertSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().min(1),
  alertType: z.string().min(1).max(100),
  category: AlertCategoryEnum,
  severity: AlertSeverityEnum,
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  entityType: AlertEntityTypeEnum.optional(),
  entityId: z.string().optional(),
  dedupKey: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional()
});

export const AcknowledgeAlertSchema = z.object({
  id: z.string().uuid('Invalid alert ID'),
  snoozeHours: z.number().int().min(1).max(720).default(24)
});

export const UpdateAlertConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  thresholdValueInteger: z.number().int().min(0).optional(),
  warningLevel: AlertSeverityEnum.optional(),
  targetRoles: z.array(z.string().min(1)).min(1, 'At least one target role is required').optional()
});
