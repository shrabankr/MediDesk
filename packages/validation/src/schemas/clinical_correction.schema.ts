import { z } from 'zod';

export const RequestClinicalCorrectionSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  resourceType: z.enum(['CLINICAL_VISIT', 'PRESCRIPTION']),
  resourceId: z.string().min(1, 'Resource ID is required'),
  correctedPayload: z.record(z.unknown()),
  reason: z.string().min(5, 'A clear reason for correction is required').max(1000)
});

export type RequestClinicalCorrectionInput = z.infer<typeof RequestClinicalCorrectionSchema>;
