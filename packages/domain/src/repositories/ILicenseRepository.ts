import { LicenseEntitlement } from '../entities/LicenseEntitlement.js';
import { LicenseStatus } from '../values/LicenseStatus.js';

export interface LicenseInstallationRecord {
  id: string;
  organizationId: string;
  installationId: string;
  machineFingerprint: string;
  status: LicenseStatus;
  trialStartedAt: Date;
  trialExpiresAt: Date;
  licenseKey?: string;
  licenseSignature?: string;
  tier: string;
  features: string[];
  validFrom?: Date;
  validTo?: Date;
  maxDoctors: number;
  maxStaff: number;
  lastVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILicenseRepository {
  findByInstallationId(installationId: string): Promise<LicenseInstallationRecord | null>;
  findByOrg(organizationId: string): Promise<LicenseInstallationRecord | null>;
  saveInstallation(record: Partial<LicenseInstallationRecord> & { installationId: string; organizationId: string; machineFingerprint: string }): Promise<LicenseInstallationRecord>;
  updateStatus(installationId: string, status: LicenseStatus): Promise<void>;
  applyLicenseKey(installationId: string, entitlement: Partial<LicenseEntitlement>): Promise<void>;
}
