/**
 * License lifecycle states defined by MediDesk architecture.
 */
export declare const LicenseStatus: {
    readonly TRIAL: "TRIAL";
    readonly ACTIVE: "ACTIVE";
    readonly GRACE_PERIOD: "GRACE_PERIOD";
    readonly EXPIRED: "EXPIRED";
    readonly SUSPENDED: "SUSPENDED";
    readonly CANCELLED: "CANCELLED";
    readonly REVOKED: "REVOKED";
};
export type LicenseStatus = (typeof LicenseStatus)[keyof typeof LicenseStatus];
//# sourceMappingURL=LicenseStatus.d.ts.map