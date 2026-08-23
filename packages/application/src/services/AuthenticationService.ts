import crypto from 'crypto';
import {
  IUserRepository,
  IOrganizationRepository,
  IPasswordHasher,
  SessionUser,
  AuthSession,
  AuditAction,
  AuditResult,
  AuthenticationError,
  AccountLockedError,
  AccountDisabledError,
  ValidationError
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import { LoginRequestInput, validateSchema, LoginRequestSchema } from '@medidesk/validation';

export class AuthenticationService {
  private userRepo: IUserRepository;
  private orgRepo: IOrganizationRepository;
  private passwordHasher: IPasswordHasher;
  private auditService: AuditService;
  private rbacEngine: RBACEngine;
  private logger: Logger;
  private sessions: Map<string, AuthSession> = new Map();

  constructor(
    userRepo: IUserRepository,
    orgRepo: IOrganizationRepository,
    passwordHasher: IPasswordHasher,
    auditService: AuditService,
    rbacEngine: RBACEngine
  ) {
    this.userRepo = userRepo;
    this.orgRepo = orgRepo;
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
