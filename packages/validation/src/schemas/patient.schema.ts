import { z } from 'zod';

export const SexSchema = z.enum(['MALE', 'FEMALE', 'OTHER']);

export const PatientStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'MERGED']);

export const CreatePatientSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional().or(z.literal('')),
  age: z.number().int().min(0).max(130).optional(),
  sex: SexSchema,
  mobile: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid mobile number format').optional().or(z.literal('')),
  alternateMobile: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid alternate mobile number format').optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z.string().max(20).optional().or(z.literal(''))
});

export type CreatePatientInput = z.input<typeof CreatePatientSchema>;

export const UpdatePatientSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional().or(z.literal('')),
  age: z.number().int().min(0).max(130).optional(),
  sex: SexSchema.optional(),
  mobile: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid mobile number format').optional().or(z.literal('')),
  alternateMobile: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid alternate mobile number format').optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  emergencyContactName: z.string().max(100).optional().or(z.literal('')),
  emergencyContactPhone: z.string().max(20).optional().or(z.literal('')),
  status: PatientStatusSchema.optional()
});

export type UpdatePatientInput = z.input<typeof UpdatePatientSchema>;

export const SearchPatientSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  query: z.string().optional(),
  status: PatientStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

export type SearchPatientInput = z.input<typeof SearchPatientSchema>;

export const CheckDuplicatesSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  mobile: z.string().optional(),
  dateOfBirth: z.string().optional(),
  sex: SexSchema.optional(),
  excludePatientId: z.string().optional()
});

export type CheckDuplicatesInput = z.input<typeof CheckDuplicatesSchema>;
