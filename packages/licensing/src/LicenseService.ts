import {
  LicenseEntitlement,
  LicenseStatus
} from '@medidesk/domain';
import { Logger } from '@medidesk/shared';

export interface ILicenseService {
  getEntitlement(): Promise<LicenseEntitlement>;
  initializeTrial(installationId: string, organizationId?: string): Promise<LicenseEntitlement>;
  validateLicense(licenseKey: string, payload: string, signature: string): Promise<boolean>;
  getTrialDaysRemaining(entitlement: LicenseEntitlement): number;
}

export class LicenseService implements ILicenseService {
  private logger: Logger;
  private currentEntitlement: LicenseEntitlement | null = null;
  private isDevelopment: boolean;

  constructor(isDevelopment = false) {
    this.logger = new Logger('LicenseService');
    this.isDevelopment = isDevelopment;
  }

  public async initializeTrial(installationId: string, organizationId?: string): Promise<LicenseEntitlement> {
    const now = new Date();
    const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

    this.currentEntitlement = {
      installationId,
      organizationId,
      status: LicenseStatus.TRIAL,
      trialStartedAt: now,
      trialExpiresAt: expires,
      features: ['clinical', 'pharmacy', 'billing', 'reports', 'backup_local'],
      issuedAt: now
    };

    this.logger.info(`Initialized 60-day trial for installation: ${installationId}`);
    return this.currentEntitlement;
  }

  public async getEntitlement(): Promise<LicenseEntitlement> {
    if (!this.currentEntitlement) {
      // In dev mode, return a clearly separated development entitlement
      if (this.isDevelopment) {
        const now = new Date();
        this.currentEntitlement = {
          installationId: 'dev-installation-local',
          status: LicenseStatus.TRIAL,
          trialStartedAt: now,
          trialExpiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
          features: ['*'],
          issuedAt: now
        };
      } else {
        return {
          installationId: 'unknown',
          status: LicenseStatus.EXPIRED,
          features: []
        };
      }
    }
    return this.currentEntitlement;
  }

  public async validateLicense(
    _licenseKey: string,
    _payload: string,
    _signature: string
  ): Promise<boolean> {
    // Foundation: Public-key verification signature check against hardcoded/configured public verification key
    this.logger.info('License validation check executed. Status: PLANNED (Future Integration)');
    return true;
  }

  public getTrialDaysRemaining(entitlement: LicenseEntitlement): number {
    if (entitlement.status !== LicenseStatus.TRIAL || !entitlement.trialExpiresAt) {
      return 0;
    }
    const diffMs = entitlement.trialExpiresAt.getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }
}
