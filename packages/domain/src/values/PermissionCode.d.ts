/**
 * Granular permission codes for the MediDesk RBAC system.
 */
export declare const PermissionCode: {
    readonly SYSTEM_DIAGNOSTICS: "system.diagnostics";
    readonly SYSTEM_CONFIG_READ: "system.config.read";
    readonly SYSTEM_CONFIG_UPDATE: "system.config.update";
    readonly SYSTEM_MIGRATE: "system.migrate";
    readonly SYSTEM_BACKUP_LOCAL: "system.backup.local";
    readonly ORG_MANAGE: "org.manage";
    readonly USER_CREATE: "user.create";
    readonly USER_READ: "user.read";
    readonly USER_UPDATE: "user.update";
    readonly USER_DISABLE: "user.disable";
    readonly ROLE_ASSIGN: "role.assign";
    readonly AUDIT_READ: "audit.read";
    readonly PATIENT_READ: "patient.read";
    readonly PATIENT_CREATE: "patient.create";
    readonly PATIENT_UPDATE: "patient.update";
    readonly PRESCRIPTION_READ: "prescription.read";
    readonly PRESCRIPTION_CREATE: "prescription.create";
    readonly PRESCRIPTION_PRINT: "prescription.print";
    readonly INVENTORY_READ: "inventory.read";
    readonly INVENTORY_ADJUST: "inventory.adjust";
    readonly SALE_CREATE: "sale.create";
    readonly REPORT_READ: "report.read";
};
export type PermissionCode = (typeof PermissionCode)[keyof typeof PermissionCode];
//# sourceMappingURL=PermissionCode.d.ts.map