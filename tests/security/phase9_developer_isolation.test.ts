import { describe, it, expect } from 'vitest';
import { RBACEngine, RESTRICTED_DEVELOPER_PERMISSIONS } from '@medidesk/authorization';
import { RoleName, PermissionCode } from '@medidesk/domain';

describe('Phase 9A Security: Developer Isolation from Inventory Reconciliation', () => {
  const rbac = new RBACEngine();

  it('ensures DEVELOPER role has 0 permissions for stock reconciliation', () => {
    const devRoles = [RoleName.DEVELOPER];

    expect(rbac.evaluatePermission(devRoles, PermissionCode.RECONCILIATION_READ)).toBe(false);
    expect(rbac.evaluatePermission(devRoles, PermissionCode.RECONCILIATION_CREATE)).toBe(false);
    expect(rbac.evaluatePermission(devRoles, PermissionCode.RECONCILIATION_SUBMIT)).toBe(false);
    expect(rbac.evaluatePermission(devRoles, PermissionCode.RECONCILIATION_APPROVE)).toBe(false);
    expect(rbac.evaluatePermission(devRoles, PermissionCode.RECONCILIATION_REJECT)).toBe(false);
    expect(rbac.evaluatePermission(devRoles, PermissionCode.RECONCILIATION_POST)).toBe(false);
  });

  it('ensures RESTRICTED_DEVELOPER_PERMISSIONS includes all Phase 9A reconciliation permissions', () => {
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.RECONCILIATION_READ);
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.RECONCILIATION_CREATE);
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.RECONCILIATION_SUBMIT);
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.RECONCILIATION_APPROVE);
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.RECONCILIATION_REJECT);
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.RECONCILIATION_POST);
  });

  it('ensures STAFF role cannot approve or post reconciliations', () => {
    const staffRoles = [RoleName.STAFF];

    expect(rbac.evaluatePermission(staffRoles, PermissionCode.RECONCILIATION_READ)).toBe(true);
    expect(rbac.evaluatePermission(staffRoles, PermissionCode.RECONCILIATION_CREATE)).toBe(true);
    expect(rbac.evaluatePermission(staffRoles, PermissionCode.RECONCILIATION_SUBMIT)).toBe(true);

    expect(rbac.evaluatePermission(staffRoles, PermissionCode.RECONCILIATION_APPROVE)).toBe(false);
    expect(rbac.evaluatePermission(staffRoles, PermissionCode.RECONCILIATION_REJECT)).toBe(false);
    expect(rbac.evaluatePermission(staffRoles, PermissionCode.RECONCILIATION_POST)).toBe(false);
  });

  it('ensures OWNER role has complete authority over reconciliation', () => {
    const ownerRoles = [RoleName.OWNER];

    expect(rbac.evaluatePermission(ownerRoles, PermissionCode.RECONCILIATION_READ)).toBe(true);
    expect(rbac.evaluatePermission(ownerRoles, PermissionCode.RECONCILIATION_CREATE)).toBe(true);
    expect(rbac.evaluatePermission(ownerRoles, PermissionCode.RECONCILIATION_SUBMIT)).toBe(true);
    expect(rbac.evaluatePermission(ownerRoles, PermissionCode.RECONCILIATION_APPROVE)).toBe(true);
    expect(rbac.evaluatePermission(ownerRoles, PermissionCode.RECONCILIATION_REJECT)).toBe(true);
    expect(rbac.evaluatePermission(ownerRoles, PermissionCode.RECONCILIATION_POST)).toBe(true);
  });
});
