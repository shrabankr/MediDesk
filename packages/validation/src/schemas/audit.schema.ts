import { z } from 'zod';
import { AuditAction, AuditResult } from '@medidesk/domain';

export const AuditActorSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  role: z.string().optional(),
  ipAddress: z.string().optional()
});

export const CreateAuditEventSchema = z.object({
  action: z.nativeEnum(AuditAction),
  actor: AuditActorSchema,
  target: z.string().optional(),
  result: z.nativeEnum(AuditResult),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export type CreateAuditEventInput = z.infer<typeof CreateAuditEventSchema>;
