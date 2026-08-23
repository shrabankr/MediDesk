import { Permission } from '../entities/Permission.js';
import { PermissionCode } from '../values/PermissionCode.js';
export interface IPermissionRepository {
    findByCode(code: PermissionCode): Promise<Permission | null>;
    listAll(): Promise<Permission[]>;
    assignPermissionToRole(roleId: string, permissionId: string): Promise<void>;
}
//# sourceMappingURL=IPermissionRepository.d.ts.map