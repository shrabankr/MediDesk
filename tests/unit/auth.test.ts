import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AuthenticationService,
  ScryptPasswordHasher
} from '@medidesk/application';
import {
  IUserRepository,
  IOrganizationRepository,
  RoleName,
  AuthenticationError,
  AccountLockedError,
  AccountDisabledError,
  User,
  Organization,
  AuditEvent
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';

describe('AuthenticationService Unit Tests', () => {
  let authService: AuthenticationService;
  let userRepoMock: IUserRepository;
  let orgRepoMock: IOrganizationRepository;
  let passwordHasher: ScryptPasswordHasher;
  let auditServiceMock: AuditService;
  let rbacEngine: RBACEngine;

  const mockOrg: Organization = {
    id: 'org-1',
    name: 'City Care Hospital',
    code: 'CCH',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  let mockUser: User;

  beforeEach(async () => {
    passwordHasher = new ScryptPasswordHasher();
    const hashedPassword = await passwordHasher.hash('ValidPass123!');

    mockUser = {
      id: 'user-1',
      organizationId: 'org-1',
      username: 'doctor_smith',
      email: 'doctor@care.local',
      fullName: 'Dr. John Smith',
      passwordHash: hashedPassword,
      isActive: true,
      isLocked: false,
      failedLoginAttempts: 0,
      roles: [RoleName.DOCTOR],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    userRepoMock = {
      findById: vi.fn(async (id: string) => (id === mockUser.id ? mockUser : null)),
      findByUsername: vi.fn(async (username: string) =>
        username.toLowerCase() === mockUser.username.toLowerCase() ? mockUser : null
      ),
      findByEmail: vi.fn(async () => null),
      listByOrganization: vi.fn(async () => [mockUser]),
      create: vi.fn(),
      update: vi.fn(),
      updatePassword: vi.fn(),
      updateLastLogin: vi.fn(),
      recordFailedLogin: vi.fn(async () => {
        mockUser.failedLoginAttempts += 1;
        if (mockUser.failedLoginAttempts >= 5) {
          mockUser.isLocked = true;
        }
        return mockUser.failedLoginAttempts;
      }),
      resetFailedLogins: vi.fn(async () => {
        mockUser.failedLoginAttempts = 0;
        mockUser.isLocked = false;
      }),
      countActiveOwners: vi.fn(async () => 1),
      count: vi.fn(async () => 1)
    };

    orgRepoMock = {
      findById: vi.fn(async () => mockOrg),
      findByCode: vi.fn(async () => mockOrg),
      getFirst: vi.fn(async () => mockOrg),
      create: vi.fn(),
      update: vi.fn()
    };

    auditServiceMock = {
      logEvent: vi.fn(async () => ({ id: 'evt-1' } as unknown as AuditEvent))
    } as unknown as AuditService;

    rbacEngine = new RBACEngine();

    authService = new AuthenticationService(
      userRepoMock,
      orgRepoMock,
      passwordHasher,
      auditServiceMock,
      rbacEngine
    );
  });

  it('should authenticate user with valid credentials and return session token', async () => {
    const result = await authService.login({
      username: 'doctor_smith',
      password: 'ValidPass123!'
    });

    expect(result.user.username).toBe('doctor_smith');
    expect(result.user.roles).toContain(RoleName.DOCTOR);
    expect(result.user.organizationName).toBe('City Care Hospital');
    expect(result.sessionToken).toBeDefined();
    expect(result.sessionToken.length).toBe(64); // 32 bytes in hex

    // Verify session lookup
    const sessionUser = authService.getSessionUser(result.sessionToken);
    expect(sessionUser?.id).toBe('user-1');
  });

  it('should reject non-existent user with AuthenticationError and log audit event', async () => {
    await expect(
      authService.login({
        username: 'unknown_user',
        password: 'Password123!'
      })
    ).rejects.toThrow(AuthenticationError);

    expect(auditServiceMock.logEvent).toHaveBeenCalled();
  });

  it('should reject invalid password and increment failed attempts counter', async () => {
    await expect(
      authService.login({
        username: 'doctor_smith',
        password: 'WrongPassword!'
      })
    ).rejects.toThrow(AuthenticationError);

    expect(userRepoMock.recordFailedLogin).toHaveBeenCalledWith('user-1');
    expect(mockUser.failedLoginAttempts).toBe(1);
  });

  it('should lock user account after 5 failed login attempts and reject subsequent logins', async () => {
    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await expect(
        authService.login({
          username: 'doctor_smith',
          password: 'WrongPassword!'
        })
      ).rejects.toThrow(AuthenticationError);
    }

    expect(mockUser.failedLoginAttempts).toBe(4);
    expect(mockUser.isLocked).toBe(false);

    // 5th failed attempt -> locks account
    await expect(
      authService.login({
        username: 'doctor_smith',
        password: 'WrongPassword!'
      })
    ).rejects.toThrow(AccountLockedError);

    expect(mockUser.isLocked).toBe(true);

    // Next attempt even with correct password is locked
    await expect(
      authService.login({
        username: 'doctor_smith',
        password: 'ValidPass123!'
      })
    ).rejects.toThrow(AccountLockedError);
  });

  it('should reject login for deactivated user', async () => {
    mockUser.isActive = false;

    await expect(
      authService.login({
        username: 'doctor_smith',
        password: 'ValidPass123!'
      })
    ).rejects.toThrow(AccountDisabledError);
  });

  it('should destroy session upon logout', async () => {
    const { sessionToken } = await authService.login({
      username: 'doctor_smith',
      password: 'ValidPass123!'
    });

    expect(authService.getSessionUser(sessionToken)).not.toBeNull();

    await authService.logout(sessionToken);
    expect(authService.getSessionUser(sessionToken)).toBeNull();
  });
});
