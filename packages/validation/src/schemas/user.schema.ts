import { z } from 'zod';
import { RoleName } from '@medidesk/domain';

export const RoleNameSchema = z.nativeEnum(RoleName);

export const CreateUserSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, dots, hyphens, and underscores'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  roles: z.array(RoleNameSchema).min(1, 'User must have at least one role')
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

export type LoginRequestInput = z.infer<typeof LoginRequestSchema>;
