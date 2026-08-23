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

export type SafeUser = Omit<User, 'passwordHash'>;

export interface SessionUser extends SafeUser {
  permissions: string[];
  organizationName?: string;
}

export interface AuthSession {
  sessionId: string;
  user: SessionUser;
  createdAt: Date;
  expiresAt: Date;
}

