import { describe, it, expect } from 'vitest';
import { RoleName, PermissionCode, AuthorizationError } from '@medidesk/domain';
import { RBACEngine, RESTRICTED_DEVELOPER_PERMISSIONS } from '@medidesk/authorization';

describe('RBACEngine & Owner / Developer Separation', () => {
  const rbac = new RBACEngine();

  it('should allow OWNER full business and clinical management permissions', () => {
    const ownerContext = {
      userId: 'owner-1',
      roles: [RoleName.OWNER]
    };

    expect(rbac.hasPermission(ownerContext, PermissionCode.ORG_MANAGE)).toBe(true);
    expect(rbac.hasPermission(ownerContext, PermissionCode.USER_CREATE)).toBe(true);
    expect(rbac.hasPermission(ownerContext, PermissionCode.PATIENT_READ)).toBe(true);
    expect(rbac.hasPermission(ownerContext, PermissionCode.PRESCRIPTION_CREATE)).toBe(true);
    expect(rbac.hasPermission(ownerContext, PermissionCode.SALE_CREATE)).toBe(true);
  });

  it('should grant DOCTOR clinical permissions but not org management', () => {
    const docContext = {
      userId: 'doc-1',
      roles: [RoleName.DOCTOR]
    };

    expect(rbac.hasPermission(docContext, PermissionCode.PATIENT_READ)).toBe(true);
    expect(rbac.hasPermission(docContext, PermissionCode.PRESCRIPTION_CREATE)).toBe(true);
    expect(rbac.hasPermission(docContext, PermissionCode.ORG_MANAGE)).toBe(false);
    expect(rbac.hasPermission(docContext, PermissionCode.USER_CREATE)).toBe(false);
  });

  it('should strictly limit DEVELOPER to technical permissions and deny clinical/financial access', () => {
    const devContext = {
      userId: 'dev-1',
      roles: [RoleName.DEVELOPER]
    };

    // Allowed technical operations
    expect(rbac.hasPermission(devContext, PermissionCode.SYSTEM_DIAGNOSTICS)).toBe(true);
    expect(rbac.hasPermission(devContext, PermissionCode.SYSTEM_CONFIG_READ)).toBe(true);
    expect(rbac.hasPermission(devContext, PermissionCode.SYSTEM_MIGRATE)).toBe(true);
    expect(rbac.hasPermission(devContext, PermissionCode.SYSTEM_BACKUP_LOCAL)).toBe(true);

    // Strictly blocked clinical, pharmacy, and business operations
    for (const restrictedPerm of RESTRICTED_DEVELOPER_PERMISSIONS) {
      expect(rbac.hasPermission(devContext, restrictedPerm)).toBe(false);
    }
  });

  it('should throw AuthorizationError when assertPermission fails', () => {
    const devContext = {
      userId: 'dev-1',
      roles: [RoleName.DEVELOPER]
    };

    expect(() => {
      rbac.assertPermission(devContext, PermissionCode.PATIENT_READ, 'Patient Record');
    }).toThrow(AuthorizationError);
  });
});
