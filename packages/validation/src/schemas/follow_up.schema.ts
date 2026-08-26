import { z } from 'zod';

export const ScheduleFollowUpSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  clinicalVisitId: z.string().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Follow-up date must be YYYY-MM-DD'),
  instructions: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional()
});

export const UpdateFollowUpStatusSchema = z.object({
  followUpId: z.string().min(1, 'Follow-up ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED'])
});

export type ScheduleFollowUpInput = z.infer<typeof ScheduleFollowUpSchema>;
export type UpdateFollowUpStatusInput = z.infer<typeof UpdateFollowUpStatusSchema>;
