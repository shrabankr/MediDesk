import { describe, it, expect } from 'vitest';
import { RBACEngine, RESTRICTED_DEVELOPER_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@medidesk/authorization';
import { RoleName, PermissionCode, SessionUser } from '@medidesk/domain';

describe('Phase 8 Security: Developer Role Isolation & RBAC Invariants', () => {
  const rbacEngine = new RBACEngine();

  const developerUser: SessionUser = {
    id: 'user-dev-99',
    username: 'developer',
    email: 'dev@medidesk.internal',
    fullName: 'System Developer',
    organizationId: 'org-test',
    organizationName: 'MediDesk Test Org',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    roles: [RoleName.DEVELOPER],
    permissions: DEFAULT_ROLE_PERMISSIONS[RoleName.DEVELOPER],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const ownerUser: SessionUser = {
    id: 'user-owner-1',
    username: 'owner',
    email: 'owner@medidesk.internal',
    fullName: 'Clinic Owner',
    organizationId: 'org-test',
    organizationName: 'MediDesk Test Org',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    roles: [RoleName.OWNER],
    permissions: DEFAULT_ROLE_PERMISSIONS[RoleName.OWNER],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('strictly forbids Developer role from possessing PACKAGING_MANAGE permission', () => {
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.PACKAGING_MANAGE);
    const hasPerm = rbacEngine.hasPermission({ userId: developerUser.id, roles: developerUser.roles }, PermissionCode.PACKAGING_MANAGE);
    expect(hasPerm).toBe(false);
  });

  it('strictly forbids Developer role from possessing BACKUP_SCHEDULE permission', () => {
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.BACKUP_SCHEDULE);
    const hasPerm = rbacEngine.hasPermission({ userId: developerUser.id, roles: developerUser.roles }, PermissionCode.BACKUP_SCHEDULE);
    expect(hasPerm).toBe(false);
  });

  it('strictly forbids Developer role from possessing DOCUMENT_DISPATCH permission', () => {
    expect(RESTRICTED_DEVELOPER_PERMISSIONS).toContain(PermissionCode.DOCUMENT_DISPATCH);
    const hasPerm = rbacEngine.hasPermission({ userId: developerUser.id, roles: developerUser.roles }, PermissionCode.DOCUMENT_DISPATCH);
    expect(hasPerm).toBe(false);
  });

  it('allows Owner full management of Phase 8 permissions', () => {
    const ownerCtx = { userId: ownerUser.id, roles: ownerUser.roles };
    expect(rbacEngine.hasPermission(ownerCtx, PermissionCode.PACKAGING_MANAGE)).toBe(true);
    expect(rbacEngine.hasPermission(ownerCtx, PermissionCode.BACKUP_SCHEDULE)).toBe(true);
    expect(rbacEngine.hasPermission(ownerCtx, PermissionCode.DOCUMENT_DISPATCH)).toBe(true);
    expect(rbacEngine.hasPermission(ownerCtx, PermissionCode.ALERT_READ)).toBe(true);
    expect(rbacEngine.hasPermission(ownerCtx, PermissionCode.ALERT_MANAGE)).toBe(true);
  });
});
