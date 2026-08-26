import crypto from 'crypto';
import os from 'os';
import { Logger } from '@medidesk/shared';
import {
  LicenseEntitlement,
  LicenseStatus,
  ILicenseRepository,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  AuthorizationError,
  InvalidLicenseSignatureError,
  LicenseExpiredError
} from '@medidesk/domain';
import { AuditService } from '@medidesk/audit';
import { RBACEngine } from '@medidesk/authorization';

// Standard 2048-bit RSA Public Key for Offline License Token Verification
export const MEDIDESK_PUBLIC_VERIFICATION_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyY0s/d6V5bJ6K1qP2L7B
Z9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5
T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK
1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9Z
qRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7b
U4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP2L7BZ9ZqRzZqZ5T7bU4xP9yK1qP
2wIDAQAB
-----END PUBLIC KEY-----`;

export interface LicenseTokenPayload {
  installationId: string;
  organizationId: string;
  organizationName: string;
  tier: string;
  features: string[];
  validFrom: string;
  validTo: string;
  maxDoctors: number;
  maxStaff: number;
  issuedAt: string;
}

export interface ILicenseService {
  getEntitlement(organizationId?: string): Promise<LicenseEntitlement>;
  initializeTrial(organizationId: string, customInstallationId?: string): Promise<LicenseEntitlement>;
  activateLicenseToken(licenseToken: string, actor: SessionUser): Promise<LicenseEntitlement>;
  validateLicense(licenseKey: string, payloadStr: string, signatureBase64: string): Promise<boolean>;
  getTrialDaysRemaining(entitlement: LicenseEntitlement): number;
  getMachineFingerprint(): string;
  assertWritePermitted(organizationId?: string): Promise<void>;
}

export class LicenseService implements ILicenseService {
  private logger: Logger;
  private licenseRepo?: ILicenseRepository;
  private auditService?: AuditService;
  private rbac?: RBACEngine;
  private publicKey: string;
  private isDevelopment: boolean;
  private cachedEntitlement: LicenseEntitlement | null = null;

  constructor(
    licenseRepo?: ILicenseRepository,
    auditService?: AuditService,
    rbac?: RBACEngine,
    publicKey = MEDIDESK_PUBLIC_VERIFICATION_KEY,
    isDevelopment = false
  ) {
    this.licenseRepo = licenseRepo;
    this.auditService = auditService;
    this.rbac = rbac;
    this.publicKey = publicKey;
    this.isDevelopment = isDevelopment;
    this.logger = new Logger('LicenseService');
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (this.rbac && !this.rbac.evaluatePermission(actor.roles, permission)) {
      throw new AuthorizationError(`Access denied. Missing permission: ${permission}`);
    }
  }

  public getMachineFingerprint(): string {
    const rawData = [
      os.hostname(),
      os.platform(),
      os.arch(),
      os.cpus().map(c => c.model).join(','),
      os.totalmem()
    ].join('|');

    return crypto.createHash('sha256').update(rawData).digest('hex');
  }

  public async initializeTrial(organizationId: string, customInstallationId?: string): Promise<LicenseEntitlement> {
    const installationId = customInstallationId || `INST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const machineFingerprint = this.getMachineFingerprint();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 Days Trial

    const features = ['clinical', 'pharmacy', 'billing', 'reports', 'backup_local'];

    if (this.licenseRepo) {
      await this.licenseRepo.saveInstallation({
        installationId,
        organizationId,
        machineFingerprint,
        status: LicenseStatus.TRIAL,
        trialStartedAt: now,
        trialExpiresAt: expiresAt,
        tier: 'CLINIC_STANDARD',
        features,
        maxDoctors: 5,
        maxStaff: 10
      });
    }

    this.cachedEntitlement = {
      installationId,
      organizationId,
      status: LicenseStatus.TRIAL,
      trialStartedAt: now,
      trialExpiresAt: expiresAt,
      features,
      maxDoctors: 5,
      maxStaff: 10,
      issuedAt: now
    };

    this.logger.info(`Initialized 60-day trial for organization: ${organizationId} (Installation: ${installationId})`);
    return this.cachedEntitlement;
  }

  public async getEntitlement(organizationId?: string): Promise<LicenseEntitlement> {
    if (this.licenseRepo && organizationId) {
      const record = await this.licenseRepo.findByOrg(organizationId);
      if (record) {
        let status = record.status;
        const now = new Date();

        if (status === LicenseStatus.TRIAL && record.trialExpiresAt && record.trialExpiresAt < now) {
          status = LicenseStatus.EXPIRED;
        } else if (status === LicenseStatus.ACTIVE && record.validTo && record.validTo < now) {
          status = LicenseStatus.EXPIRED;
        }

        this.cachedEntitlement = {
          installationId: record.installationId,
          organizationId: record.organizationId,
          licenseKey: record.licenseKey,
          status,
          trialStartedAt: record.trialStartedAt,
          trialExpiresAt: record.trialExpiresAt,
          activeUntil: record.validTo,
          maxDoctors: record.maxDoctors,
          maxStaff: record.maxStaff,
          features: record.features,
          issuedAt: record.createdAt,
          signature: record.licenseSignature
        };

        return this.cachedEntitlement;
      }
    }

    if (this.cachedEntitlement) {
      return this.cachedEntitlement;
    }

    if (this.isDevelopment) {
      const now = new Date();
      return {
        installationId: 'DEV-MACHINE-001',
        organizationId: organizationId || 'org-dev-local',
        status: LicenseStatus.TRIAL,
        trialStartedAt: now,
        trialExpiresAt: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        features: ['*'],
        maxDoctors: 99,
        maxStaff: 99,
        issuedAt: now
      };
    }

    return {
      installationId: 'UNKNOWN_INSTALLATION',
      organizationId,
      status: LicenseStatus.EXPIRED,
      features: []
    };
  }

  public async activateLicenseToken(licenseToken: string, actor: SessionUser): Promise<LicenseEntitlement> {
    this.assertPermission(actor, PermissionCode.SYSTEM_LICENSE_ACTIVATE);

    const parts = licenseToken.trim().split('.');
    if (parts.length !== 2) {
      throw new InvalidLicenseSignatureError('Invalid license token format. Expected BASE64(PAYLOAD).BASE64(SIGNATURE)');
    }

    const [payloadB64, signatureB64] = parts;
    let payloadJson: string;
    let payload: LicenseTokenPayload;

    try {
      payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
      payload = JSON.parse(payloadJson);
    } catch {
      throw new InvalidLicenseSignatureError('License token payload is malformed or invalid JSON.');
    }

    // Verify digital signature against public key
    const isValidSignature = this.verifySignature(payloadJson, signatureB64, this.publicKey);
    if (!isValidSignature) {
      this.logger.error(`Cryptographic signature check failed for license token!`);
      throw new InvalidLicenseSignatureError('License signature verification failed. Token is forged or corrupted.');
    }

    // Check validity window
    const now = new Date();
    const validFrom = new Date(payload.validFrom);
    const validTo = new Date(payload.validTo);

    if (now < validFrom || now > validTo) {
      throw new InvalidLicenseSignatureError(`License is outside its validity window (${payload.validFrom} to ${payload.validTo}).`);
    }

    // Save to repository
    if (this.licenseRepo) {
      await this.licenseRepo.applyLicenseKey(payload.installationId, {
        licenseKey: licenseToken,
        signature: signatureB64,
        status: LicenseStatus.ACTIVE,
        features: payload.features,
        activeUntil: validTo
      });
    }

    this.cachedEntitlement = {
      installationId: payload.installationId,
      organizationId: payload.organizationId || actor.organizationId,
      licenseKey: licenseToken,
      status: LicenseStatus.ACTIVE,
      activeUntil: validTo,
      features: payload.features,
      maxDoctors: payload.maxDoctors,
      maxStaff: payload.maxStaff,
      issuedAt: new Date(payload.issuedAt),
      signature: signatureB64
    };

    if (this.auditService) {
      await this.auditService.logEvent({
        action: AuditAction.LICENSE_ACTIVATED,
        actor: {
          id: actor.id,
          username: actor.fullName,
          role: actor.roles[0]
        },
        resource: payload.installationId,
        result: AuditResult.SUCCESS,
        metadata: { tier: payload.tier, validTo: payload.validTo, features: payload.features }
      });
    }

    this.logger.info(`Successfully activated commercial license for organization ${actor.organizationId} (Tier: ${payload.tier})`);
    return this.cachedEntitlement;
  }

  public async validateLicense(
    _licenseKey: string,
    payloadStr: string,
    signatureBase64: string
  ): Promise<boolean> {
    return this.verifySignature(payloadStr, signatureBase64, this.publicKey);
  }

  public getTrialDaysRemaining(entitlement: LicenseEntitlement): number {
    if (entitlement.status !== LicenseStatus.TRIAL || !entitlement.trialExpiresAt) {
      return 0;
    }
    const diffMs = entitlement.trialExpiresAt.getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }

  public async assertWritePermitted(organizationId?: string): Promise<void> {
    const entitlement = await this.getEntitlement(organizationId);
    if (entitlement.status === LicenseStatus.EXPIRED || entitlement.status === LicenseStatus.REVOKED) {
      throw new LicenseExpiredError(
        'License expired: You may view and export historical records, but creating new patients, visits, prescriptions, or sales is restricted.'
      );
    }
  }

  private verifySignature(data: string, signatureBase64: string, publicKeyPem: string): boolean {
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      verifier.end();
      return verifier.verify(publicKeyPem, signatureBase64, 'base64');
    } catch (err) {
      this.logger.warn(`Signature verification exception: ${String(err)}`);
      return false;
    }
  }
}
