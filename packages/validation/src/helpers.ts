import { z } from 'zod';
import { ValidationError } from '@medidesk/domain';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string[]> };

/**
 * Validates data against a Zod schema and returns typed result.
 */
export function validateSchema<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return { success: false, errors };
}

/**
 * Validates data against a schema, throwing a Domain ValidationError on failure.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, contextName = 'Input'): T {
  const result = validateSchema(schema, data);
  if (!result.success) {
    throw new ValidationError(`Validation failed for ${contextName}`, result.errors);
  }
  return result.data;
}
