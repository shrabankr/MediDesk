import { z } from 'zod';

export const RecordAllergySchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  status: z.enum(['KNOWN', 'DENIED', 'UNKNOWN']),
  allergenName: z.string().max(200).optional(),
  category: z.enum(['DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER']).default('DRUG'),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']).default('MODERATE'),
  reaction: z.string().max(500).optional(),
  notes: z.string().max(1000).optional()
});

export const UpdateAllergySchema = z.object({
  allergyId: z.string().min(1, 'Allergy ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  status: z.enum(['KNOWN', 'DENIED', 'UNKNOWN']).optional(),
  allergenName: z.string().max(200).optional(),
  category: z.enum(['DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER']).optional(),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']).optional(),
  reaction: z.string().max(500).optional(),
  notes: z.string().max(1000).optional()
});

export type RecordAllergyInput = z.infer<typeof RecordAllergySchema>;
export type UpdateAllergyInput = z.infer<typeof UpdateAllergySchema>;
