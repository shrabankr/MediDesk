import { z } from 'zod';

export const BackupFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY']);

export const UpdateBackupScheduleSchema = z.object({
  isEnabled: z.boolean().optional(),
  frequency: BackupFrequencyEnum.optional(),
  backupTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Backup time must be in HH:MM format (24-hour)')
    .optional(),
  localBackupEnabled: z.boolean().optional(),
  cloudBackupEnabled: z.boolean().optional(),
  retentionDaysLocal: z.number().int().min(1).max(365).optional(),
  retentionDaysCloud: z.number().int().min(1).max(3650).optional()
});
