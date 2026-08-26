import { z } from 'zod';

export const DoctorStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const DoctorScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6, 'Day must be 0 (Sunday) to 6 (Saturday)'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:MM format (24h)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must be HH:MM format (24h)'),
  slotDurationMinutes: z.number().int().min(5).max(120).optional(),
  isActive: z.boolean().optional()
}).refine((data) => data.startTime < data.endTime, {
  message: 'Start time must be before end time',
  path: ['endTime']
});

export type DoctorScheduleItemInput = z.input<typeof DoctorScheduleItemSchema>;

export const CreateDoctorSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  userId: z.string().optional(),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  qualification: z.string().min(2, 'Qualification is required').max(100),
  specialization: z.string().min(2, 'Specialization is required').max(100),
  registrationNumber: z.string().max(50).optional().or(z.literal('')),
  mobile: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid mobile number format').optional().or(z.literal('')),
  consultationFee: z.number().min(0, 'Consultation fee cannot be negative').optional(),
  schedules: z.array(DoctorScheduleItemSchema).optional()
});

export type CreateDoctorInput = z.input<typeof CreateDoctorSchema>;

export const UpdateDoctorSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100).optional(),
  qualification: z.string().min(2, 'Qualification is required').max(100).optional(),
  specialization: z.string().min(2, 'Specialization is required').max(100).optional(),
  registrationNumber: z.string().max(50).optional().or(z.literal('')),
  mobile: z.string().regex(/^[0-9+ -]{7,15}$/, 'Invalid mobile number format').optional().or(z.literal('')),
  consultationFee: z.number().min(0, 'Consultation fee cannot be negative').optional(),
  status: DoctorStatusSchema.optional(),
  userId: z.string().optional()
});

export type UpdateDoctorInput = z.input<typeof UpdateDoctorSchema>;

export const SetDoctorSchedulesSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  schedules: z.array(DoctorScheduleItemSchema)
});

export type SetDoctorSchedulesInput = z.input<typeof SetDoctorSchedulesSchema>;
