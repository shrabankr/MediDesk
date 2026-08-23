import { describe, it, expect } from 'vitest';
import {
  RoleName,
  PermissionCode,
  LicenseStatus,
  AuditAction,
  AuditResult,
  DomainError,
  EntityNotFoundError
} from '@medidesk/domain';

describe('Domain Models & Values', () => {
  it('should define distinct system roles without SUPER_ADMIN', () => {
    expect(RoleName.OWNER).toBe('OWNER');
    expect(RoleName.DEVELOPER).toBe('DEVELOPER');
    expect(RoleName.DOCTOR).toBe('DOCTOR');
    expect(RoleName.STAFF).toBe('STAFF');

    // Confirm no SUPER_ADMIN exists
    expect((RoleName as Record<string, string>)['SUPER_ADMIN']).toBeUndefined();
  });

  it('should define granular permissions across categories', () => {
    expect(PermissionCode.PATIENT_READ).toBe('patient.read');
    expect(PermissionCode.SYSTEM_MIGRATE).toBe('system.migrate');
    expect(PermissionCode.ORG_MANAGE).toBe('org.manage');
    expect(PermissionCode.SALE_CREATE).toBe('sale.create');
  });

  it('should define license statuses correctly', () => {
    expect(LicenseStatus.TRIAL).toBe('TRIAL');
    expect(LicenseStatus.ACTIVE).toBe('ACTIVE');
    expect(LicenseStatus.GRACE_PERIOD).toBe('GRACE_PERIOD');
    expect(LicenseStatus.EXPIRED).toBe('EXPIRED');
    expect(LicenseStatus.SUSPENDED).toBe('SUSPENDED');
    expect(LicenseStatus.CANCELLED).toBe('CANCELLED');
    expect(LicenseStatus.REVOKED).toBe('REVOKED');
  });

  it('should define audit actions and results', () => {
    expect(AuditAction.SYSTEM_INITIALIZED).toBe('SYSTEM_INITIALIZED');
    expect(AuditResult.SUCCESS).toBe('SUCCESS');
    expect(AuditResult.DENIED).toBe('DENIED');
  });

  it('should instantiate DomainError hierarchy', () => {
    const error = new EntityNotFoundError('User', 'usr-123');
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('EntityNotFoundError');
    expect(error.message).toContain('usr-123');
  });
});
