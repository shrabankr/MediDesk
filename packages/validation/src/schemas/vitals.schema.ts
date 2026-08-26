import { z } from 'zod';

export const RecordVitalsSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  clinicalVisitId: z.string().optional(),
  temperature: z.number().min(50).max(120).optional(),
  temperatureUnit: z.enum(['CELSIUS', 'FAHRENHEIT']).default('FAHRENHEIT'),
  pulseRate: z.number().int().min(20).max(300).optional(),
  respiratoryRate: z.number().int().min(4).max(100).optional(),
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  oxygenSaturationSpo2: z.number().min(0).max(100).optional(),
  weightKg: z.number().min(0.5).max(500).optional(),
  heightCm: z.number().min(10).max(300).optional(),
  bmi: z.number().min(1).max(100).optional(),
  notes: z.string().max(1000).optional()
});

export type RecordVitalsInput = z.infer<typeof RecordVitalsSchema>;
