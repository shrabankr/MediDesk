import { AuditAction, AuditResult } from '../values/AuditAction.js';

export interface AuditActor {
  id: string;
  username: string;
  role?: string;
  ipAddress?: string;
}

export interface AuditEvent {
  id: string;
  action: AuditAction;
  actor: AuditActor;
  target?: string;
  result: AuditResult;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export type CreateAuditEventDTO = Omit<AuditEvent, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: Date;
};
