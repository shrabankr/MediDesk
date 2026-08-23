import { RoleName } from '../values/RoleName.js';
import { PermissionCode } from '../values/PermissionCode.js';

export interface Role {
  id: string;
  name: RoleName;
  description: string;
  isSystem: boolean;
  permissions?: PermissionCode[];
  createdAt: Date;
  updatedAt: Date;
}
