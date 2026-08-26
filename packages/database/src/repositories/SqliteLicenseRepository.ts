import crypto from 'crypto';
import { SqliteDatabase } from '../SqliteDatabase.js';
import { ILicenseRepository, LicenseInstallationRecord, LicenseEntitlement, LicenseStatus } from '@medidesk/domain';

export class SqliteLicenseRepository implements ILicenseRepository {
  private db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  public async findByInstallationId(installationId: string): Promise<LicenseInstallationRecord | null> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM license_installations WHERE installation_id = ?
    `).get(installationId) as any;

    if (!row) return null;
    return this.mapRow(row);
  }

  public async findByOrg(organizationId: string): Promise<LicenseInstallationRecord | null> {
    const row = this.db.getRawDb().prepare(`
      SELECT * FROM license_installations WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(organizationId) as any;

    if (!row) return null;
    return this.mapRow(row);
  }

  public async saveInstallation(record: Partial<LicenseInstallationRecord> & { installationId: string; organizationId: string; machineFingerprint: string }): Promise<LicenseInstallationRecord> {
    const existing = await this.findByInstallationId(record.installationId);
    const now = new Date().toISOString();

    if (existing) {
      this.db.getRawDb().prepare(`
        UPDATE license_installations SET
          status = COALESCE(?, status),
          tier = COALESCE(?, tier),
          features_json = COALESCE(?, features_json),
          valid_from = COALESCE(?, valid_from),
          valid_to = COALESCE(?, valid_to),
          license_key = COALESCE(?, license_key),
          license_signature = COALESCE(?, license_signature),
          last_verified_at = ?,
          updated_at = ?
        WHERE installation_id = ?
      `).run(
        record.status ?? null,
        record.tier ?? null,
        record.features ? JSON.stringify(record.features) : null,
        record.validFrom ? record.validFrom.toISOString() : null,
        record.validTo ? record.validTo.toISOString() : null,
        record.licenseKey ?? null,
        record.licenseSignature ?? null,
        now,
        now,
        record.installationId
      );

      return (await this.findByInstallationId(record.installationId))!;
    }

    const id = record.id || crypto.randomUUID();
    const trialStartedAt = (record.trialStartedAt || new Date()).toISOString();
    const trialExpiresAt = (record.trialExpiresAt || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)).toISOString();
    const features = record.features ? JSON.stringify(record.features) : '["clinical","pharmacy","billing","reports","backup_local"]';

    this.db.getRawDb().prepare(`
      INSERT INTO license_installations (
        id, organization_id, installation_id, machine_fingerprint,
        status, trial_started_at, trial_expires_at, tier, features_json,
        max_doctors, max_staff, last_verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      record.organizationId,
      record.installationId,
      record.machineFingerprint,
      record.status || 'TRIAL',
      trialStartedAt,
      trialExpiresAt,
      record.tier || 'CLINIC_STANDARD',
      features,
      record.maxDoctors ?? 5,
      record.maxStaff ?? 10,
      now,
      now,
      now
    );

    return (await this.findByInstallationId(record.installationId))!;
  }

  public async updateStatus(installationId: string, status: LicenseStatus): Promise<void> {
    const now = new Date().toISOString();
    this.db.getRawDb().prepare(`
      UPDATE license_installations SET status = ?, updated_at = ? WHERE installation_id = ?
    `).run(status, now, installationId);
  }

  public async applyLicenseKey(installationId: string, entitlement: Partial<LicenseEntitlement>): Promise<void> {
    const now = new Date().toISOString();
    const features = entitlement.features ? JSON.stringify(entitlement.features) : undefined;

    this.db.getRawDb().prepare(`
      UPDATE license_installations SET
        status = ?,
        license_key = ?,
        license_signature = ?,
        features_json = COALESCE(?, features_json),
        valid_to = ?,
        last_verified_at = ?,
        updated_at = ?
      WHERE installation_id = ?
    `).run(
      entitlement.status || 'ACTIVE',
      entitlement.licenseKey || null,
      entitlement.signature || null,
      features || null,
      entitlement.activeUntil ? entitlement.activeUntil.toISOString() : null,
      now,
      now,
      installationId
    );
  }

  private mapRow(row: any): LicenseInstallationRecord {
    let features: string[];
    try {
      features = JSON.parse(row.features_json);
    } catch {
      features = ['clinical', 'pharmacy', 'billing', 'reports', 'backup_local'];
    }

    return {
      id: row.id,
      organizationId: row.organization_id,
      installationId: row.installation_id,
      machineFingerprint: row.machine_fingerprint,
      status: row.status as LicenseStatus,
      trialStartedAt: new Date(row.trial_started_at),
      trialExpiresAt: new Date(row.trial_expires_at),
      licenseKey: row.license_key || undefined,
      licenseSignature: row.license_signature || undefined,
      tier: row.tier,
      features,
      validFrom: row.valid_from ? new Date(row.valid_from) : undefined,
      validTo: row.valid_to ? new Date(row.valid_to) : undefined,
      maxDoctors: row.max_doctors,
      maxStaff: row.max_staff,
      lastVerifiedAt: new Date(row.last_verified_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
