import { z } from 'zod';

export const RecordMedicalHistorySchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  category: z.enum(['PAST_MEDICAL', 'PAST_SURGICAL', 'FAMILY', 'SOCIAL', 'MEDICATION_HISTORY']),
  description: z.string().min(1, 'Description is required').max(1000),
  diagnosedDate: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).optional()
});

export const UpdateMedicalHistorySchema = z.object({
  historyId: z.string().min(1, 'History ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  category: z.enum(['PAST_MEDICAL', 'PAST_SURGICAL', 'FAMILY', 'SOCIAL', 'MEDICATION_HISTORY']).optional(),
  description: z.string().min(1).max(1000).optional(),
  diagnosedDate: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional()
});

export type RecordMedicalHistoryInput = z.infer<typeof RecordMedicalHistorySchema>;
export type UpdateMedicalHistoryInput = z.infer<typeof UpdateMedicalHistorySchema>;
