import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  code: z
    .string()
    .min(2, 'Organization code must be at least 2 characters')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Code must contain only uppercase letters, numbers, underscores, or hyphens'),
  address: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email address').optional(),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO code').default('INR'),
  timezone: z.string().min(1, 'Timezone is required').default('Asia/Kolkata')
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
