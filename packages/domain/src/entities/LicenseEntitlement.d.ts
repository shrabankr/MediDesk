import { LicenseStatus } from '../values/LicenseStatus.js';
export interface LicenseEntitlement {
    licenseKey?: string;
    status: LicenseStatus;
    organizationId?: string;
    installationId: string;
    trialStartedAt?: Date;
    trialExpiresAt?: Date;
    activeUntil?: Date;
    maxDoctors?: number;
    maxStaff?: number;
    features: string[];
    issuedAt?: Date;
    signature?: string;
}
//# sourceMappingURL=LicenseEntitlement.d.ts.map