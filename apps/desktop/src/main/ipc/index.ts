import { registerSystemIpc } from './system.ipc.js';
import { registerAuditIpc } from './audit.ipc.js';
import { registerConfigIpc } from './config.ipc.js';
import { registerAuthIpcHandlers } from './auth.ipc.js';
import { registerUserIpcHandlers } from './user.ipc.js';
import {
  StatusService,
  SystemInitializationService,
  AuthenticationService,
  UserManagementService
} from '@medidesk/application';
import { IAuditService } from '@medidesk/audit';
import { AppConfig } from '@medidesk/shared';

export interface RegisterIpcOptions {
  statusService: StatusService;
  initService: SystemInitializationService;
  authService: AuthenticationService;
  userService: UserManagementService;
  auditService: IAuditService;
  config: AppConfig;
}

export function registerAllIpcHandlers(options: RegisterIpcOptions): void {
  registerSystemIpc(options.statusService, options.initService);
  registerAuthIpcHandlers(options.authService);
  registerUserIpcHandlers(options.userService, options.authService);
  registerAuditIpc(options.auditService);
  registerConfigIpc(options.config);
}
