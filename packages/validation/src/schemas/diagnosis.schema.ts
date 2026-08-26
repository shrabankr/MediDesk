import { z } from 'zod';

export const RecordDiagnosisSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  clinicalVisitId: z.string().optional(),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  diagnosisText: z.string().min(1, 'Diagnosis text is required').max(1000),
  type: z.enum(['PRIMARY', 'SECONDARY', 'PROVISIONAL', 'DIFFERENTIAL']).default('PRIMARY'),
  status: z.enum(['ACTIVE', 'RESOLVED', 'RULED_OUT']).default('ACTIVE'),
  codeSystem: z.string().max(100).optional(),
  codeValue: z.string().max(100).optional(),
  notes: z.string().max(1000).optional()
});

export const UpdateDiagnosisSchema = z.object({
  diagnosisId: z.string().min(1, 'Diagnosis ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  diagnosisText: z.string().min(1).max(1000).optional(),
  type: z.enum(['PRIMARY', 'SECONDARY', 'PROVISIONAL', 'DIFFERENTIAL']).optional(),
  status: z.enum(['ACTIVE', 'RESOLVED', 'RULED_OUT']).optional(),
  notes: z.string().max(1000).optional()
});

export type RecordDiagnosisInput = z.infer<typeof RecordDiagnosisSchema>;
export type UpdateDiagnosisInput = z.infer<typeof UpdateDiagnosisSchema>;
