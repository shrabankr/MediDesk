/**
 * Audit actions tracked in MediDesk.
 */
export const AuditAction = {
  SYSTEM_INITIALIZED: 'SYSTEM_INITIALIZED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DISABLED: 'USER_DISABLED',
  ROLE_ASSIGNED: 'ROLE_ASSIGNED',
  DATABASE_MIGRATED: 'DATABASE_MIGRATED',
  BACKUP_CREATED: 'BACKUP_CREATED',
  BACKUP_RESTORED: 'BACKUP_RESTORED',
  LICENSE_VERIFIED: 'LICENSE_VERIFIED',
  DIAGNOSTICS_EXECUTED: 'DIAGNOSTICS_EXECUTED'
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditResult = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  DENIED: 'DENIED'
} as const;

export type AuditResult = (typeof AuditResult)[keyof typeof AuditResult];
