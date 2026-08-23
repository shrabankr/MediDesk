import { Role } from '../entities/Role.js';
import { RoleName } from '../values/RoleName.js';
import { PermissionCode } from '../values/PermissionCode.js';
export interface IRoleRepository {
    findByName(name: RoleName): Promise<Role | null>;
    listAll(): Promise<Role[]>;
    getUserRoles(userId: string): Promise<RoleName[]>;
    assignRoleToUser(userId: string, roleName: RoleName): Promise<void>;
    removeRoleFromUser(userId: string, roleName: RoleName): Promise<void>;
    getPermissionsForRole(roleName: RoleName): Promise<PermissionCode[]>;
    getPermissionsForUser(userId: string): Promise<PermissionCode[]>;
}
//# sourceMappingURL=IRoleRepository.d.ts.map