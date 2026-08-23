import { RoleName, PermissionCode } from '@medidesk/domain';

/**
 * Standard baseline permissions mapped to default roles.
 * Note: Role/permission matrix is loaded from and enforced by the database,
 * but this default matrix establishes default capabilities.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  [RoleName.OWNER]: [
    // Owner has business authority over org, users, clinical, pharmacy, audit
    PermissionCode.ORG_MANAGE,
    PermissionCode.USER_CREATE,
    PermissionCode.USER_READ,
    PermissionCode.USER_UPDATE,
    PermissionCode.USER_DISABLE,
    PermissionCode.ROLE_ASSIGN,
    PermissionCode.AUDIT_READ,
    PermissionCode.PATIENT_READ,
    PermissionCode.PATIENT_CREATE,
    PermissionCode.PATIENT_UPDATE,
    PermissionCode.PRESCRIPTION_READ,
    PermissionCode.PRESCRIPTION_CREATE,
    PermissionCode.PRESCRIPTION_PRINT,
    PermissionCode.INVENTORY_READ,
    PermissionCode.INVENTORY_ADJUST,
    PermissionCode.SALE_CREATE,
    PermissionCode.REPORT_READ,
    PermissionCode.SYSTEM_BACKUP_LOCAL
  ],
  [RoleName.DOCTOR]: [
    PermissionCode.USER_READ,
    PermissionCode.PATIENT_READ,
    PermissionCode.PATIENT_CREATE,
    PermissionCode.PATIENT_UPDATE,
    PermissionCode.PRESCRIPTION_READ,
    PermissionCode.PRESCRIPTION_CREATE,
    PermissionCode.PRESCRIPTION_PRINT,
    PermissionCode.INVENTORY_READ,
    PermissionCode.REPORT_READ
  ],
  [RoleName.STAFF]: [
    PermissionCode.USER_READ,
    PermissionCode.PATIENT_READ,
    PermissionCode.PATIENT_CREATE,
    PermissionCode.PATIENT_UPDATE,
    PermissionCode.PRESCRIPTION_READ,
    PermissionCode.PRESCRIPTION_PRINT,
    PermissionCode.INVENTORY_READ,
    PermissionCode.INVENTORY_ADJUST,
    PermissionCode.SALE_CREATE,
    PermissionCode.REPORT_READ
  ],
  [RoleName.DEVELOPER]: [
    // Developer has technical authority ONLY.
    // Explicitly NO clinical, patient, prescription, pharmacy or financial data permissions.
    PermissionCode.SYSTEM_DIAGNOSTICS,
    PermissionCode.SYSTEM_CONFIG_READ,
    PermissionCode.SYSTEM_CONFIG_UPDATE,
    PermissionCode.SYSTEM_MIGRATE,
    PermissionCode.SYSTEM_BACKUP_LOCAL
  ]
};

/**
 * Restricted clinical/financial permissions that the DEVELOPER role must never possess.
 */
export const RESTRICTED_DEVELOPER_PERMISSIONS: PermissionCode[] = [
  PermissionCode.PATIENT_READ,
  PermissionCode.PATIENT_CREATE,
  PermissionCode.PATIENT_UPDATE,
  PermissionCode.PRESCRIPTION_READ,
  PermissionCode.PRESCRIPTION_CREATE,
  PermissionCode.PRESCRIPTION_PRINT,
  PermissionCode.SALE_CREATE,
  PermissionCode.INVENTORY_ADJUST,
  PermissionCode.ORG_MANAGE,
  PermissionCode.ROLE_ASSIGN
];
