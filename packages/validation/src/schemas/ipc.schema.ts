import { z } from 'zod';
import { CreateOrganizationSchema } from './organization.schema.js';
import { CreateAuditEventSchema } from './audit.schema.js';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  ToggleUserStatusSchema,
  LoginRequestSchema
} from './user.schema.js';

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

export const LogAuditEventRequestSchema = CreateAuditEventSchema;
export type LogAuditEventRequestInput = z.infer<typeof LogAuditEventRequestSchema>;

export const GetAuditEventsRequestSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50)
});
export type GetAuditEventsRequestInput = z.infer<typeof GetAuditEventsRequestSchema>;
