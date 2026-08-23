/**
 * Granular permission codes for the MediDesk RBAC system.
 */
export const PermissionCode = {
  // System & Diagnostics (Technical / Developer)
  SYSTEM_DIAGNOSTICS: 'system.diagnostics',
  SYSTEM_CONFIG_READ: 'system.config.read',
  SYSTEM_CONFIG_UPDATE: 'system.config.update',
  SYSTEM_MIGRATE: 'system.migrate',
  SYSTEM_BACKUP_LOCAL: 'system.backup.local',

  // Administration (Owner)
  ORG_MANAGE: 'org.manage',
  USER_CREATE: 'user.create',
  USER_READ: 'user.read',
  USER_UPDATE: 'user.update',
  USER_DISABLE: 'user.disable',
  ROLE_ASSIGN: 'role.assign',
  AUDIT_READ: 'audit.read',

  // Clinical (Doctor)
  PATIENT_READ: 'patient.read',
  PATIENT_CREATE: 'patient.create',
  PATIENT_UPDATE: 'patient.update',
  PRESCRIPTION_READ: 'prescription.read',
  PRESCRIPTION_CREATE: 'prescription.create',
  PRESCRIPTION_PRINT: 'prescription.print',

  // Pharmacy & Operations (Staff / Pharmacy)
  INVENTORY_READ: 'inventory.read',
  INVENTORY_ADJUST: 'inventory.adjust',
  SALE_CREATE: 'sale.create',
  REPORT_READ: 'report.read'
} as const;

export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];
