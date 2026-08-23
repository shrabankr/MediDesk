import crypto from 'crypto';
import {
  IUserRepository,
  IOrganizationRepository,
  IApplicationStateRepository,
  IPasswordHasher,
  ApplicationStateKeys,
  RoleName,
  SessionUser,
  AuthSession,
  AuditAction,
  AuditResult,
  AuthenticationError,
  AuthorizationError,
  AccountLockedError,
  AccountDisabledError,
  ValidationError,
  DomainError
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import {
  LoginRequestInput,
  RecoverOwnerInput,
  validateSchema,
  LoginRequestSchema,
  RecoverOwnerSchema
} from '@medidesk/validation';

export class AuthenticationService {
  private userRepo: IUserRepository;
  private orgRepo: IOrganizationRepository;
  private stateRepo: IApplicationStateRepository;
  private passwordHasher: IPasswordHasher;
  private auditService: AuditService;
  private rbacEngine: RBACEngine;
  private logger: Logger;
  private sessions: Map<string, AuthSession> = new Map();

  constructor(
    userRepo: IUserRepository,
    orgRepo: IOrganizationRepository,
    stateRepo: IApplicationStateRepository,
    passwordHasher: IPasswordHasher,
    auditService: AuditService,
    rbacEngine: RBACEngine
  ) {
    this.userRepo = userRepo;
    this.orgRepo = orgRepo;
    this.stateRepo = stateRepo;
    this.passwordHasher = passwordHasher;
    this.auditService = auditService;
    this.rbacEngine = rbacEngine;
    this.logger = new Logger('AuthenticationService');
  }

  public async login(input: LoginRequestInput): Promise<{ user: SessionUser; sessionToken: string }> {
    const validated = validateSchema(LoginRequestSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for login request', validated.errors);
    }

    const { username, password } = validated.data;
    const user = await this.userRepo.findByUsername(username);

    if (!user) {
      this.logger.warn(`Login failed: user '${username}' not found`);
      await this.auditService.logEvent({
        actor: { username, role: 'UNKNOWN', roles: [] },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/session',
        result: AuditResult.FAILURE,
        metadata: { reason: 'user_not_found', attemptedUsername: username }
      });
      throw new AuthenticationError('Invalid username or password.');
    }

    // Check account status
    if (!user.isActive) {
      this.logger.warn(`Login rejected: user '${username}' is deactivated`);
      await this.auditService.logEvent({
        actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/session',
        result: AuditResult.FAILURE,
        metadata: { reason: 'account_disabled' }
      });
      throw new AccountDisabledError();
    }

    if (user.isLocked) {
      this.logger.warn(`Login rejected: user '${username}' is locked out`);
      await this.auditService.logEvent({
        actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/session',
        result: AuditResult.FAILURE,
        metadata: { reason: 'account_locked', failedAttempts: user.failedLoginAttempts }
      });
      throw new AccountLockedError();
    }

    // Verify Password
    const passwordMatch = await this.passwordHasher.verify(password, user.passwordHash);

    if (!passwordMatch) {
      const attempts = await this.userRepo.recordFailedLogin(user.id);
      this.logger.warn(`Login failed: password mismatch for '${username}', failed attempts: ${attempts}`);

      await this.auditService.logEvent({
        actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/session',
        result: AuditResult.FAILURE,
        metadata: { reason: 'invalid_password', failedAttempts: attempts, isNowLocked: attempts >= 5 }
      });

      if (attempts >= 5) {
        throw new AccountLockedError();
      }

      throw new AuthenticationError('Invalid username or password.');
    }

    // Successful Login
    await this.userRepo.resetFailedLogins(user.id);
    await this.userRepo.updateLastLogin(user.id, new Date());

    const org = await this.orgRepo.findById(user.organizationId);
    const permissions = this.rbacEngine.getPermissionsForRoles(user.roles);

    const sessionUser: SessionUser = {
      id: user.id,
      organizationId: user.organizationId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      isLocked: false,
      failedLoginAttempts: 0,
      roles: user.roles,
      lastLoginAt: new Date(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      permissions,
      organizationName: org?.name ?? 'Clinic'
    };

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session: AuthSession = {
      sessionId: sessionToken,
      user: sessionUser,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24-hour session
    };

    this.sessions.set(sessionToken, session);

    await this.auditService.logEvent({
      actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
      action: AuditAction.USER_LOGIN,
      resource: 'auth/session',
      result: AuditResult.SUCCESS,
      metadata: { roles: user.roles, organizationId: user.organizationId }
    });

    this.logger.info(`User logged in successfully: ${user.username} (Roles: ${user.roles.join(', ')})`);

    return { user: sessionUser, sessionToken };
  }

  /**
   * Safe, auditable emergency recovery mechanism for locked Owner accounts.
   * Resolves circular single-owner lockout without creating a backdoor or SUPER_ADMIN.
   */
  public async recoverOwnerAccount(input: RecoverOwnerInput): Promise<{ success: boolean; message: string }> {
    const validated = validateSchema(RecoverOwnerSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for owner recovery', validated.errors);
    }

    const { username, recoveryToken, newPassword } = validated.data;
    const user = await this.userRepo.findByUsername(username);

    if (!user) {
      await this.auditService.logEvent({
        actor: { username, role: 'UNKNOWN', roles: [] },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/recovery',
        result: AuditResult.FAILURE,
        metadata: { reason: 'recovery_user_not_found', attemptedUsername: username }
      });
      throw new AuthenticationError('Invalid username or emergency recovery token.');
    }

    // Security check: Recovery is strictly limited to Owner accounts
    if (!user.roles.includes(RoleName.OWNER)) {
      await this.auditService.logEvent({
        actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/recovery',
        result: AuditResult.FAILURE,
        metadata: { reason: 'user_not_an_owner', attemptedUsername: username }
      });
      throw new AuthorizationError('Emergency recovery is strictly restricted to Owner accounts.');
    }

    // Verify recovery token against cryptographically hashed key in application_state
    const storedHash = await this.stateRepo.get(ApplicationStateKeys.EMERGENCY_RECOVERY_KEY_HASH);
    if (!storedHash) {
      throw new DomainError('Emergency recovery key is not configured.');
    }

    const isValidToken = await this.passwordHasher.verify(recoveryToken, storedHash);
    if (!isValidToken) {
      await this.auditService.logEvent({
        actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
        action: AuditAction.USER_LOGIN_FAILED,
        resource: 'auth/recovery',
        result: AuditResult.FAILURE,
        metadata: { reason: 'invalid_emergency_token', targetUserId: user.id }
      });
      throw new AuthenticationError('Invalid emergency recovery token.');
    }

    // Reset failed logins (unlocks account)
    await this.userRepo.resetFailedLogins(user.id);

    // Update password if new password was provided
    if (newPassword) {
      const newHash = await this.passwordHasher.hash(newPassword);
      await this.userRepo.updatePassword(user.id, newHash);
    }

    await this.auditService.logEvent({
      actor: { id: user.id, username: user.username, role: user.roles[0], roles: user.roles },
      action: AuditAction.USER_UPDATED,
      resource: 'auth/recovery',
      result: AuditResult.SUCCESS,
      metadata: {
        action: 'emergency_owner_recovery_unlock',
        targetUserId: user.id,
        passwordReset: Boolean(newPassword)
      }
    });

    this.logger.info(`Owner account '${user.username}' successfully unlocked via emergency recovery.`);
    return {
      success: true,
      message: `Owner account '${user.username}' has been unlocked and verified successfully.`
    };
  }

  public async logout(sessionToken: string): Promise<void> {
    const session = this.sessions.get(sessionToken);
    if (session) {
      this.sessions.delete(sessionToken);

      await this.auditService.logEvent({
        actor: { id: session.user.id, username: session.user.username, role: session.user.roles[0], roles: session.user.roles },
        action: AuditAction.USER_LOGOUT,
        resource: 'auth/session',
        result: AuditResult.SUCCESS
      });

      this.logger.info(`User logged out: ${session.user.username}`);
    }
  }

  public getSession(sessionToken: string): AuthSession | null {
    const session = this.sessions.get(sessionToken);
    if (!session) return null;

    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }

    return session;
  }

  public getSessionUser(sessionToken: string): SessionUser | null {
    const session = this.getSession(sessionToken);
    return session ? session.user : null;
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}
