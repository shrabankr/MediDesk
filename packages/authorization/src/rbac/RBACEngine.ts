import {
  RoleName,
  PermissionCode,
  AuthorizationError,
  User
} from '@medidesk/domain';
import { DEFAULT_ROLE_PERMISSIONS } from './RoleDefinitions.js';

export interface AuthorizationContext {
  userId: string;
  roles: RoleName[];
  permissions?: PermissionCode[];
}

export class RBACEngine {
  /**
   * Returns all combined permissions granted for a list of roles.
   */
  public getPermissionsForRoles(roles: RoleName[]): string[] {
    const perms = new Set<string>();
    for (const role of roles) {
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
      for (const p of defaultPerms) {
        perms.add(p);
      }
    }
    return Array.from(perms);
  }

  /**
   * Evaluates if any of the roles grant the specified permission.
   */
  public evaluatePermission(roles: RoleName[], permission: string): boolean {
    const perms = this.getPermissionsForRoles(roles);
    return perms.includes(permission);
  }

  /**
   * Checks if an authorization context has a required permission.
   */
  public hasPermission(
    context: AuthorizationContext,
    requiredPermission: PermissionCode
  ): boolean {
    if (!context.roles || context.roles.length === 0) {
      return false;
    }

    // Collect all granted permissions
    const grantedPermissions = new Set<PermissionCode>(context.permissions ?? []);

    // Merge in default permissions for assigned roles
    for (const role of context.roles) {
      const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] ?? [];
      for (const p of defaultPerms) {
        grantedPermissions.add(p);
      }
    }

    return grantedPermissions.has(requiredPermission);
  }

  /**
   * Asserts that a context has a required permission, otherwise throwing AuthorizationError.
   */
  public assertPermission(
    context: AuthorizationContext,
    requiredPermission: PermissionCode,
    resourceDescription?: string
  ): void {
    if (!this.hasPermission(context, requiredPermission)) {
      const desc = resourceDescription ? ` on ${resourceDescription}` : '';
      throw new AuthorizationError(
        `Access denied: missing permission '${requiredPermission}'${desc}.`
      );
    }
  }

  /**
   * Builds an AuthorizationContext from a User entity.
   */
  public buildContext(user: User, customPermissions?: PermissionCode[]): AuthorizationContext {
    return {
      userId: user.id,
      roles: user.roles,
      permissions: customPermissions
    };
  }

  /**
   * Validates whether a developer role is attempting to access restricted clinical/financial areas.
   */
  public isDeveloperTechnicalOnly(roles: RoleName[]): boolean {
    return roles.includes(RoleName.DEVELOPER) && !roles.includes(RoleName.OWNER) && !roles.includes(RoleName.DOCTOR);
  }
}
