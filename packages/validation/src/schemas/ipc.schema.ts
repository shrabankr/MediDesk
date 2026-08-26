import { z } from 'zod';
import { CreateOrganizationSchema } from './organization.schema.js';
import { CreateAuditEventSchema } from './audit.schema.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  ToggleUserStatusSchema,
  LoginRequestSchema,
  RecoverOwnerSchema,
  CreateOwnerViaRecoverySchema
} from './user.schema.js';
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  SearchPatientSchema,
  CheckDuplicatesSchema
} from './patient.schema.js';
import {
  CreateDoctorSchema,
  UpdateDoctorSchema,
  SetDoctorSchedulesSchema
} from './doctor.schema.js';
import {
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  ChangeAppointmentStatusSchema,
  ListAppointmentsSchema,
  GetWaitingQueueSchema
} from './appointment.schema.js';

export const InitializeSystemRequestSchema = z.object({
  organization: CreateOrganizationSchema,
  initialOwner: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    fullName: z.string().min(2).max(100),
    password: z.string().min(8).max(128)
  }),
  developerToken: z.string().min(8, 'Developer token required for initialization authorization')
});

export type InitializeSystemRequestInput = z.infer<typeof InitializeSystemRequestSchema>;

export const LoginIPCRequestSchema = LoginRequestSchema;
export type LoginIPCRequestInput = z.infer<typeof LoginIPCRequestSchema>;

export const CreateUserIPCRequestSchema = CreateUserSchema;
export type CreateUserIPCRequestInput = z.infer<typeof CreateUserIPCRequestSchema>;

export const UpdateUserIPCRequestSchema = UpdateUserSchema;
export type UpdateUserIPCRequestInput = z.infer<typeof UpdateUserIPCRequestSchema>;

export const ResetPasswordIPCRequestSchema = ResetPasswordSchema;
export type ResetPasswordIPCRequestInput = z.infer<typeof ResetPasswordIPCRequestSchema>;

export const ToggleUserStatusIPCRequestSchema = ToggleUserStatusSchema;
export type ToggleUserStatusIPCRequestInput = z.infer<typeof ToggleUserStatusIPCRequestSchema>;

export const RecoverOwnerIPCRequestSchema = RecoverOwnerSchema;
export type RecoverOwnerIPCRequestInput = z.infer<typeof RecoverOwnerIPCRequestSchema>;

export const CreateOwnerViaRecoveryIPCRequestSchema = CreateOwnerViaRecoverySchema;
export type CreateOwnerViaRecoveryIPCRequestInput = z.infer<typeof CreateOwnerViaRecoveryIPCRequestSchema>;

export const LogAuditEventRequestSchema = CreateAuditEventSchema;
export type LogAuditEventRequestInput = z.infer<typeof LogAuditEventRequestSchema>;

export const GetAuditEventsRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50)
});
export type GetAuditEventsRequestInput = z.infer<typeof GetAuditEventsRequestSchema>;

// Patient IPC Schemas
export const CreatePatientIPCRequestSchema = CreatePatientSchema;
export const UpdatePatientIPCRequestSchema = UpdatePatientSchema;
export const SearchPatientIPCRequestSchema = SearchPatientSchema;
export const CheckDuplicatesIPCRequestSchema = CheckDuplicatesSchema;

// Doctor IPC Schemas
export const CreateDoctorIPCRequestSchema = CreateDoctorSchema;
export const UpdateDoctorIPCRequestSchema = UpdateDoctorSchema;
export const SetDoctorSchedulesIPCRequestSchema = SetDoctorSchedulesSchema;

// Appointment IPC Schemas
export const CreateAppointmentIPCRequestSchema = CreateAppointmentSchema;
export const UpdateAppointmentIPCRequestSchema = UpdateAppointmentSchema;
export const ChangeAppointmentStatusIPCRequestSchema = ChangeAppointmentStatusSchema;
export const ListAppointmentsIPCRequestSchema = ListAppointmentsSchema;
export const GetWaitingQueueIPCRequestSchema = GetWaitingQueueSchema;
