import { z } from 'zod';

export const CreateClinicalVisitSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  appointmentId: z.string().optional(),
  visitDateTime: z.string().optional(),
  chiefComplaint: z.string().max(2000).optional(),
  historyOfPresentIllness: z.string().max(5000).optional(),
  examinationNotes: z.string().max(5000).optional(),
  clinicalAssessment: z.string().max(5000).optional()
});

export const UpdateClinicalVisitSchema = z.object({
  visitId: z.string().min(1, 'Visit ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  chiefComplaint: z.string().max(2000).optional(),
  historyOfPresentIllness: z.string().max(5000).optional(),
  examinationNotes: z.string().max(5000).optional(),
  clinicalAssessment: z.string().max(5000).optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional()
});

export const CompleteClinicalVisitSchema = z.object({
  visitId: z.string().min(1, 'Visit ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required')
});

export const CancelClinicalVisitSchema = z.object({
  visitId: z.string().min(1, 'Visit ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required')
});

export type CreateClinicalVisitInput = z.infer<typeof CreateClinicalVisitSchema>;
export type UpdateClinicalVisitInput = z.infer<typeof UpdateClinicalVisitSchema>;
export type CompleteClinicalVisitInput = z.infer<typeof CompleteClinicalVisitSchema>;
export type CancelClinicalVisitInput = z.infer<typeof CancelClinicalVisitSchema>;
