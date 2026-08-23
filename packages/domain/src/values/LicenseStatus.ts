/**
 * License lifecycle states defined by MediDesk architecture.
 */
export const LicenseStatus = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  GRACE_PERIOD: 'GRACE_PERIOD',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  REVOKED: 'REVOKED'
} as const;

export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];
