import { z } from 'zod';
import { RoleName } from '@medidesk/domain';

export const RoleNameSchema = z.nativeEnum(RoleName);

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const CreateUserSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, dots, hyphens, and underscores'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  password: PasswordSchema,
  roles: z.array(RoleNameSchema).min(1, 'User must have at least one role')
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  roles: z.array(RoleNameSchema).min(1, 'User must have at least one role').optional()
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  newPassword: PasswordSchema
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const ToggleUserStatusSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  isActive: z.boolean()
});

export type ToggleUserStatusInput = z.infer<typeof ToggleUserStatusSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

export type LoginRequestInput = z.infer<typeof LoginRequestSchema>;

export const RecoverOwnerSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  recoveryToken: z.string().min(8, 'Recovery token must be at least 8 characters'),
  newPassword: PasswordSchema.optional()
});

export type RecoverOwnerInput = z.infer<typeof RecoverOwnerSchema>;

export const CreateOwnerViaRecoverySchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, dots, hyphens, and underscores'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  password: PasswordSchema,
  recoveryToken: z.string().min(8, 'Recovery token is required')
});

export type CreateOwnerViaRecoveryInput = z.infer<typeof CreateOwnerViaRecoverySchema>;
