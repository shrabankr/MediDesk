import { z } from 'zod';

export const AppointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CHECKED_IN',
  'WAITING',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
]);

export const CreateAppointmentSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:MM format (24h)'),
  durationMinutes: z.number().int().min(5).max(180).optional(),
  visitPurpose: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')) // Strictly non-clinical notes
});

export type CreateAppointmentInput = z.input<typeof CreateAppointmentSchema>;

export const UpdateAppointmentSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment ID is required'),
  doctorId: z.string().optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must be HH:MM format (24h)').optional(),
  durationMinutes: z.number().int().min(5).max(180).optional(),
  visitPurpose: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal(''))
});

export type UpdateAppointmentInput = z.input<typeof UpdateAppointmentSchema>;

export const ChangeAppointmentStatusSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment ID is required'),
  status: AppointmentStatusSchema
});

export type ChangeAppointmentStatusInput = z.input<typeof ChangeAppointmentStatusSchema>;

export const ListAppointmentsSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  doctorId: z.string().optional(),
  patientId: z.string().optional(),
  status: AppointmentStatusSchema.optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional()
});

export type ListAppointmentsInput = z.input<typeof ListAppointmentsSchema>;

export const GetWaitingQueueSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctorId: z.string().optional()
});

export type GetWaitingQueueInput = z.input<typeof GetWaitingQueueSchema>;
