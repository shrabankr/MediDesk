/**
 * Audit actions tracked in MediDesk.
 */
export declare const AuditAction: {
    readonly SYSTEM_INITIALIZED: "SYSTEM_INITIALIZED";
    readonly USER_LOGIN: "USER_LOGIN";
    readonly USER_LOGOUT: "USER_LOGOUT";
    readonly USER_LOGIN_FAILED: "USER_LOGIN_FAILED";
    readonly USER_CREATED: "USER_CREATED";
    readonly USER_UPDATED: "USER_UPDATED";
    readonly USER_DISABLED: "USER_DISABLED";
    readonly ROLE_ASSIGNED: "ROLE_ASSIGNED";
    readonly DATABASE_MIGRATED: "DATABASE_MIGRATED";
    readonly BACKUP_CREATED: "BACKUP_CREATED";
    readonly BACKUP_RESTORED: "BACKUP_RESTORED";
    readonly LICENSE_VERIFIED: "LICENSE_VERIFIED";
    readonly DIAGNOSTICS_EXECUTED: "DIAGNOSTICS_EXECUTED";
};
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
export declare const AuditResult: {
    readonly SUCCESS: "SUCCESS";
    readonly FAILURE: "FAILURE";
    readonly DENIED: "DENIED";
};
export type AuditResult = (typeof AuditResult)[keyof typeof AuditResult];
//# sourceMappingURL=AuditAction.d.ts.map