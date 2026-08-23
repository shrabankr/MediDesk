import {
  IUserRepository,
  IOrganizationRepository,
  IRoleRepository,
  IPasswordHasher,
  SafeUser,
  SessionUser,
  RoleName,
  AuditAction,
  AuditResult,
  AuthorizationError,
  ValidationError,
  EntityNotFoundError,
  PermissionCode
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import {
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
  ToggleUserStatusInput,
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  ToggleUserStatusSchema,
  validateSchema
} from '@medidesk/validation';

export class UserManagementService {
  private userRepo: IUserRepository;
  private orgRepo: IOrganizationRepository;
  private roleRepo: IRoleRepository;
  private passwordHasher: IPasswordHasher;
  private auditService: AuditService;
  private rbacEngine: RBACEngine;
  private logger: Logger;

  constructor(
    userRepo: IUserRepository,
    orgRepo: IOrganizationRepository,
    roleRepo: IRoleRepository,
    passwordHasher: IPasswordHasher,
    auditService: AuditService,
    rbacEngine: RBACEngine
  ) {
    this.userRepo = userRepo;
    this.orgRepo = orgRepo;
    this.roleRepo = roleRepo;
    this.passwordHasher = passwordHasher;
    this.auditService = auditService;
    this.rbacEngine = rbacEngine;
    this.logger = new Logger('UserManagementService');
  }

  private toSafeUser(user: {
    id: string;
    organizationId: string;
    username: string;
    email: string;
    fullName: string;
    isActive: boolean;
    isLocked: boolean;
    failedLoginAttempts: number;
    roles: RoleName[];
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      isLocked: user.isLocked,
      failedLoginAttempts: user.failedLoginAttempts,
      roles: user.roles,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    const hasPermission = this.rbacEngine.evaluatePermission(actor.roles, permission);
    if (!hasPermission) {
      this.logger.warn(`Permission denied: actor '${actor.username}' lacks '${permission}'`);
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  public async listUsers(organizationId: string, actor: SessionUser): Promise<SafeUser[]> {
    this.assertPermission(actor, PermissionCode.USER_READ);

    const users = await this.userRepo.listByOrganization(organizationId);
    return users.map((u) => this.toSafeUser(u));
  }

  public async createUser(input: CreateUserInput, actor: SessionUser): Promise<SafeUser> {
    this.assertPermission(actor, PermissionCode.USER_CREATE);

    const validated = validateSchema(CreateUserSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for creating user', validated.errors);
    }

    const { organizationId, username, email, fullName, password, roles } = validated.data;

    // Check organization existence
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new EntityNotFoundError('Organization', organizationId);
    }

    // Check username and email uniqueness
    const existingUsername = await this.userRepo.findByUsername(username);
    if (existingUsername) {
      throw new ValidationError('Username is already taken', { username: ['Username is already in use'] });
    }

    const existingEmail = await this.userRepo.findByEmail(email);
    if (existingEmail) {
      throw new ValidationError('Email is already registered', { email: ['Email address is already in use'] });
    }

    // Hash password with secure abstraction
    const passwordHash = await this.passwordHasher.hash(password);

    const created = await this.userRepo.create({
      organizationId,
      username,
      email,
      fullName,
      passwordHash,
      roles
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.USER_CREATED,
      resource: `user/${created.id}`,
      result: AuditResult.SUCCESS,
      metadata: {
        createdUserId: created.id,
        createdUsername: created.username,
        roles: created.roles
      }
    });

    this.logger.info(`User created: ${created.username} by ${actor.username}`);
    return this.toSafeUser(created);
  }

  public async updateUser(input: UpdateUserInput, actor: SessionUser): Promise<SafeUser> {
    this.assertPermission(actor, PermissionCode.USER_UPDATE);

    const validated = validateSchema(UpdateUserSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for updating user', validated.errors);
    }

    const { userId, fullName, email, roles } = validated.data;
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }

    // Check email uniqueness if modified
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = await this.userRepo.findByEmail(email);
      if (existingEmail && existingEmail.id !== userId) {
        throw new ValidationError('Email is already in use by another user', { email: ['Email already taken'] });
      }
    }

    const updated = await this.userRepo.update(userId, {
      fullName,
      email,
      roles
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.USER_UPDATED,
      resource: `user/${userId}`,
      result: AuditResult.SUCCESS,
      metadata: { targetUserId: userId, modifiedFields: { fullName, email, roles } }
    });

    this.logger.info(`User updated: ${user.username} by ${actor.username}`);
    return this.toSafeUser(updated);
  }

  public async resetPassword(input: ResetPasswordInput, actor: SessionUser): Promise<void> {
    this.assertPermission(actor, PermissionCode.USER_UPDATE);

    const validated = validateSchema(ResetPasswordSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for password reset', validated.errors);
    }

    const { userId, newPassword } = validated.data;
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepo.updatePassword(userId, passwordHash);
    await this.userRepo.resetFailedLogins(userId);

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: AuditAction.USER_UPDATED,
      resource: `user/${userId}`,
      result: AuditResult.SUCCESS,
      metadata: { targetUserId: userId, action: 'password_reset' }
    });

    this.logger.info(`Password reset for user: ${user.username} by ${actor.username}`);
  }

  public async toggleUserStatus(input: ToggleUserStatusInput, actor: SessionUser): Promise<SafeUser> {
    this.assertPermission(actor, PermissionCode.USER_DISABLE);

    const validated = validateSchema(ToggleUserStatusSchema, input);
    if (!validated.success) {
      throw new ValidationError('Validation failed for status change', validated.errors);
    }

    const { userId, isActive } = validated.data;
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }

    // Safety check: Cannot deactivate oneself if current user is an Owner
    if (userId === actor.id && !isActive) {
      throw new ValidationError('Cannot deactivate your own active session account', {
        userId: ['Self-deactivation is prohibited']
      });
    }

    const updated = await this.userRepo.update(userId, {
      isActive,
      isLocked: isActive ? false : user.isLocked
    });

    await this.auditService.logEvent({
      actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
      action: isActive ? AuditAction.USER_UPDATED : AuditAction.USER_DISABLED,
      resource: `user/${userId}`,
      result: AuditResult.SUCCESS,
      metadata: { targetUserId: userId, newActiveState: isActive }
    });

    this.logger.info(`User status toggled for: ${user.username} -> active=${isActive} by ${actor.username}`);
    return this.toSafeUser(updated);
  }

  public async getUserPermissions(userId: string, actor: SessionUser) {
    this.assertPermission(actor, PermissionCode.USER_READ);

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }

    const permissions = this.rbacEngine.getPermissionsForRoles(user.roles);
    return {
      userId: user.id,
      username: user.username,
      roles: user.roles,
      permissions,
      isOwner: user.roles.includes(RoleName.OWNER),
      isDeveloper: user.roles.includes(RoleName.DEVELOPER)
    };
  }
}
