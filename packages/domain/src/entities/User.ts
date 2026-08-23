import { RoleName } from '../values/RoleName.js';

export interface User {
  id: string;
  organizationId: string;
  username: string;
  email: string;
  fullName: string;
  passwordHash: string;
  isActive: boolean;
  isLocked: boolean;
  failedLoginAttempts: number;
  roles: RoleName[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserDTO = {
  id?: string;
  organizationId: string;
  username: string;
  email: string;
  fullName: string;
  passwordHash: string;
  roles: RoleName[];
};
