import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UserManagementService,
  ScryptPasswordHasher
} from '@medidesk/application';
import {
  IUserRepository,
  IOrganizationRepository,
  IRoleRepository,
  IApplicationStateRepository,
  ApplicationStateKeys,
  RoleName,
  AuthorizationError,
  SessionUser,
  Organization,
  Role,
  AuditEvent,
  LastActiveOwnerProtectionError,
  User
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';

describe('UserManagementService Unit Tests', () => {
  let userService: UserManagementService;
  let userRepoMock: IUserRepository;
  let orgRepoMock: IOrganizationRepository;
  let roleRepoMock: IRoleRepository;
  let stateRepoMock: IApplicationStateRepository;
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
    permissions: ['org.manage', 'user.create', 'user.read', 'user.update', 'user.disable'],
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

  let activeOwnerUser: User;
  let secondOwnerUser: User;
  let doctorUser: User;

  beforeEach(() => {
    passwordHasher = new ScryptPasswordHasher();
    rbacEngine = new RBACEngine();

    activeOwnerUser = {
      id: 'owner-1',
      organizationId: 'org-1',
      username: 'clinic_owner',
      email: 'owner@metro.local',
      fullName: 'Owner Name',
      passwordHash: 'hash',
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      roles: [RoleName.OWNER],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    secondOwnerUser = {
      id: 'owner-2',
      organizationId: 'org-1',
      username: 'second_owner',
      email: 'second@metro.local',
      fullName: 'Second Owner',
      passwordHash: 'hash',
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      roles: [RoleName.OWNER],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    doctorUser = {
      id: 'doctor-1',
      organizationId: 'org-1',
      username: 'doctor_smith',
      email: 'doc@metro.local',
      fullName: 'Dr. Smith',
      passwordHash: 'hash',
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      roles: [RoleName.DOCTOR],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    userRepoMock = {
      findById: vi.fn(async (id) => {
        if (id === 'owner-1') return activeOwnerUser;
        if (id === 'owner-2') return secondOwnerUser;
        if (id === 'doctor-1') return doctorUser;
        return null;
      }),
      findByUsername: vi.fn(async () => null),
      findByEmail: vi.fn(async () => null),
      listByOrganization: vi.fn(async () => [activeOwnerUser, doctorUser]),
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
      update: vi.fn(async (id, partial) => {
        const target = id === 'owner-1' ? activeOwnerUser : id === 'owner-2' ? secondOwnerUser : doctorUser;
        if (partial.isActive !== undefined) target.isActive = partial.isActive;
        if (partial.roles !== undefined) target.roles = partial.roles;
        if (partial.fullName !== undefined) target.fullName = partial.fullName;
        if (partial.email !== undefined) target.email = partial.email;
        return target;
      }),
      updatePassword: vi.fn(),
      updateLastLogin: vi.fn(),
      recordFailedLogin: vi.fn(),
      resetFailedLogins: vi.fn(),
      countActiveOwners: vi.fn(async () => 1),
      count: vi.fn(async () => 2)
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

    stateRepoMock = {
      get: vi.fn(async (key: string) => {
        if (key === ApplicationStateKeys.EMERGENCY_RECOVERY_KEY_HASH) {
          return await passwordHasher.hash('emergency-recovery-key-2026');
        }
        return null;
      }),
      set: vi.fn(),
      isInitialized: vi.fn(async () => true),
      setInitialized: vi.fn()
    };

    auditServiceMock = {
      logEvent: vi.fn(async () => ({ id: 'evt-1' } as unknown as AuditEvent))
    } as unknown as AuditService;

    rbacEngine = new RBACEngine();

    userService = new UserManagementService(
      userRepoMock,
      orgRepoMock,
      roleRepoMock,
      stateRepoMock,
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
        userId: 'doctor-1',
        newPassword: 'NewPassword999!'
      },
      ownerActor
    );

    expect(userRepoMock.updatePassword).toHaveBeenCalled();
    expect(userRepoMock.resetFailedLogins).toHaveBeenCalledWith('doctor-1');
  });

  it('should allow Owner to toggle regular doctor active status', async () => {
    const updated = await userService.toggleUserStatus(
      {
        userId: 'doctor-1',
        isActive: false
      },
      ownerActor
    );

    expect(updated.isActive).toBe(false);
    expect(userRepoMock.update).toHaveBeenCalledWith('doctor-1', {
      isActive: false,
      isLocked: false
    });
  });

  describe('Last Active Owner Protection Invariant', () => {
    it('should DENY deactivating the only active Owner', async () => {
      userRepoMock.countActiveOwners = vi.fn(async () => 1);

      await expect(
        userService.toggleUserStatus(
          {
            userId: 'owner-1',
            isActive: false
          },
          ownerActor
        )
      ).rejects.toThrow(LastActiveOwnerProtectionError);
    });

    it('should DENY removing OWNER role from the only active Owner', async () => {
      userRepoMock.countActiveOwners = vi.fn(async () => 1);

      await expect(
        userService.updateUser(
          {
            userId: 'owner-1',
            roles: [RoleName.STAFF]
          },
          ownerActor
        )
      ).rejects.toThrow(LastActiveOwnerProtectionError);
    });

    it('should ALLOW deactivating an Owner when another active Owner remains', async () => {
      userRepoMock.countActiveOwners = vi.fn(async () => 2);

      const updated = await userService.toggleUserStatus(
        {
          userId: 'owner-2',
          isActive: false
        },
        ownerActor
      );

      expect(updated.isActive).toBe(false);
      expect(userRepoMock.update).toHaveBeenCalled();
    });

    it('should ALLOW removing OWNER role from an Owner when another active Owner remains', async () => {
      userRepoMock.countActiveOwners = vi.fn(async () => 2);

      const updated = await userService.updateUser(
        {
          userId: 'owner-2',
          roles: [RoleName.DOCTOR]
        },
        ownerActor
      );

      expect(updated.roles).toEqual([RoleName.DOCTOR]);
      expect(userRepoMock.update).toHaveBeenCalled();
    });

    it('should create a secondary Owner through authorized emergency recovery workflow', async () => {
      const newOwner = await userService.createSecondaryOwnerViaRecovery({
        organizationId: 'org-1',
        username: 'emergency_owner',
        email: 'emergency@metro.local',
        fullName: 'Dr. Emergency Owner',
        password: 'Password123!',
        recoveryToken: 'emergency-recovery-key-2026'
      });

      expect(newOwner.username).toBe('emergency_owner');
      expect(newOwner.roles).toContain(RoleName.OWNER);
      expect(userRepoMock.create).toHaveBeenCalled();
    });
  });
});
