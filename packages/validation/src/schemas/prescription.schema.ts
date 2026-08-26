import { z } from 'zod';

export const PrescriptionItemInputSchema = z.object({
  medicineName: z.string().min(1, 'Medicine name is required').max(200),
  genericName: z.string().max(200).optional(),
  strength: z.string().max(100).optional(),
  dosageForm: z.enum(['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'OINTMENT', 'INHALER', 'OTHER']).default('TABLET'),
  route: z.enum(['ORAL', 'TOPICAL', 'INTRAVENOUS', 'INTRAMUSCULAR', 'INHALATION', 'OPHTHALMIC', 'SUBLINGUAL', 'OTHER']).default('ORAL'),
  frequency: z.string().min(1, 'Frequency is required').max(100),
  durationValue: z.number().int().min(1).max(365).optional(),
  durationUnit: z.enum(['DAYS', 'WEEKS', 'MONTHS']).default('DAYS'),
  instructions: z.string().max(500).optional(),
  quantity: z.number().int().min(1).max(10000).optional(),
  isSubstitutionAllowed: z.boolean().default(true)
});

export const CreatePrescriptionSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  clinicalVisitId: z.string().optional(),
  items: z.array(PrescriptionItemInputSchema).min(1, 'At least one medication item is required'),
  notes: z.string().max(2000).optional()
});

export const RevisePrescriptionSchema = z.object({
  prescriptionId: z.string().min(1, 'Prescription ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  reasonForChange: z.string().min(3, 'A clear reason for change is required').max(1000),
  items: z.array(PrescriptionItemInputSchema).min(1, 'At least one medication item is required'),
  notes: z.string().max(2000).optional()
});

export const SignPrescriptionSchema = z.object({
  prescriptionId: z.string().min(1, 'Prescription ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required')
});

export const CancelPrescriptionSchema = z.object({
  prescriptionId: z.string().min(1, 'Prescription ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  reason: z.string().max(1000).optional()
});

export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;
export type RevisePrescriptionInput = z.infer<typeof RevisePrescriptionSchema>;
export type SignPrescriptionInput = z.infer<typeof SignPrescriptionSchema>;
export type CancelPrescriptionInput = z.infer<typeof CancelPrescriptionSchema>;
