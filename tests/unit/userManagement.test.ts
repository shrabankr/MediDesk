import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UserManagementService,
  ScryptPasswordHasher
} from '@medidesk/application';
import {
  IUserRepository,
  IOrganizationRepository,
  IRoleRepository,
  RoleName,
  AuthorizationError,
  ValidationError,
  SessionUser,
  Organization,
  Role,
  AuditEvent
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';

describe('UserManagementService Unit Tests', () => {
  let userService: UserManagementService;
  let userRepoMock: IUserRepository;
  let orgRepoMock: IOrganizationRepository;
  let roleRepoMock: IRoleRepository;
  let passwordHasher: ScryptPasswordHasher;
  let auditServiceMock: AuditService;
  let rbacEngine: RBACEngine;

  const mockOrg: Organization = {
    id: 'org-1',
    name: 'Metro City Clinic',
    code: 'METRO01',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const ownerActor: SessionUser = {
    id: 'owner-1',
    organizationId: 'org-1',
    username: 'clinic_owner',
    email: 'owner@metro.local',
    fullName: 'Owner Name',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    roles: [RoleName.OWNER],
    permissions: ['org.manage', 'auth.user.manage', 'patient.read', 'patient.write'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const staffActor: SessionUser = {
    id: 'staff-1',
    organizationId: 'org-1',
    username: 'staff_user',
    email: 'staff@metro.local',
    fullName: 'Staff Name',
    isActive: true,
    isLocked: false,
    failedLoginAttempts: 0,
    roles: [RoleName.STAFF],
    permissions: ['patient.read', 'sale.create'],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    passwordHasher = new ScryptPasswordHasher();
    rbacEngine = new RBACEngine();

    userRepoMock = {
      findById: vi.fn(async (id) => ({
        id,
        organizationId: 'org-1',
        username: 'existing_user',
        email: 'user@metro.local',
        fullName: 'Existing User',
        passwordHash: 'hash',
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        roles: [RoleName.DOCTOR],
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      findByUsername: vi.fn(async () => null),
      findByEmail: vi.fn(async () => null),
      listByOrganization: vi.fn(async () => []),
      create: vi.fn(async (dto) => ({
        id: 'new-user-123',
        organizationId: dto.organizationId,
        username: dto.username,
        email: dto.email,
        fullName: dto.fullName,
        passwordHash: dto.passwordHash,
        isActive: true,
        isLocked: false,
        failedLoginAttempts: 0,
        roles: dto.roles,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      update: vi.fn(async (id, partial) => ({
        id,
        organizationId: 'org-1',
        username: 'existing_user',
        email: partial.email || 'user@metro.local',
        fullName: partial.fullName || 'Existing User',
        passwordHash: 'hash',
        isActive: partial.isActive !== undefined ? partial.isActive : true,
        isLocked: false,
        failedLoginAttempts: 0,
        roles: partial.roles || [RoleName.DOCTOR],
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      updatePassword: vi.fn(),
      updateLastLogin: vi.fn(),
      recordFailedLogin: vi.fn(),
      resetFailedLogins: vi.fn(),
      count: vi.fn(async () => 1)
    };

    orgRepoMock = {
      findById: vi.fn(async () => mockOrg),
      findByCode: vi.fn(async () => mockOrg),
      getFirst: vi.fn(async () => mockOrg),
      create: vi.fn(),
      update: vi.fn()
    };

    roleRepoMock = {
      findByName: vi.fn(async (name) => ({ id: 'role-1', name, description: '' } as Role)),
      listAll: vi.fn(async () => []),
      getUserRoles: vi.fn(async () => [RoleName.DOCTOR]),
      assignRoleToUser: vi.fn(),
      removeRoleFromUser: vi.fn(),
      getPermissionsForRole: vi.fn(async () => []),
      getPermissionsForUser: vi.fn(async () => [])
    };

    auditServiceMock = {
      logEvent: vi.fn(async () => ({ id: 'evt-1' } as unknown as AuditEvent))
    } as unknown as AuditService;

    userService = new UserManagementService(
      userRepoMock,
      orgRepoMock,
      roleRepoMock,
      passwordHasher,
      auditServiceMock,
      rbacEngine
    );
  });

  it('should allow Owner to create a new Doctor with securely hashed password', async () => {
    const user = await userService.createUser(
      {
        organizationId: 'org-1',
        username: 'dr_new',
        email: 'dr.new@metro.local',
        fullName: 'Dr. New Clinician',
        password: 'Password123!',
        roles: [RoleName.DOCTOR]
      },
      ownerActor
    );

    expect(user.username).toBe('dr_new');
    expect(user.roles).toContain(RoleName.DOCTOR);
    expect(userRepoMock.create).toHaveBeenCalled();
    expect(auditServiceMock.logEvent).toHaveBeenCalled();
  });

  it('should prevent non-privileged user (STAFF) from creating users', async () => {
    await expect(
      userService.createUser(
        {
          organizationId: 'org-1',
          username: 'dr_unauth',
          email: 'dr.unauth@metro.local',
          fullName: 'Dr. Unauth',
          password: 'Password123!',
          roles: [RoleName.DOCTOR]
        },
        staffActor
      )
    ).rejects.toThrow(AuthorizationError);
  });

  it('should allow Owner to reset user password', async () => {
    await userService.resetPassword(
      {
        userId: 'target-user-1',
        newPassword: 'NewPassword999!'
      },
      ownerActor
    );

    expect(userRepoMock.updatePassword).toHaveBeenCalled();
    expect(userRepoMock.resetFailedLogins).toHaveBeenCalledWith('target-user-1');
  });

  it('should allow Owner to toggle user active status', async () => {
    const updated = await userService.toggleUserStatus(
      {
        userId: 'target-user-1',
        isActive: false
      },
      ownerActor
    );

    expect(updated.isActive).toBe(false);
    expect(userRepoMock.update).toHaveBeenCalledWith('target-user-1', {
      isActive: false,
      isLocked: false
    });
  });

  it('should prevent Owner from deactivating their own active account', async () => {
    await expect(
      userService.toggleUserStatus(
        {
          userId: ownerActor.id,
          isActive: false
        },
        ownerActor
      )
    ).rejects.toThrow(ValidationError);
  });
});
