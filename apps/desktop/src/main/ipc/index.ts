import { registerSystemIpc } from './system.ipc.js';
import { registerAuditIpc } from './audit.ipc.js';
import { registerConfigIpc } from './config.ipc.js';
import { StatusService, SystemInitializationService } from '@medidesk/application';
import { IAuditService } from '@medidesk/audit';
import { AppConfig } from '@medidesk/shared';

export interface RegisterIpcOptions {
  statusService: StatusService;
  initService: SystemInitializationService;
  auditService: IAuditService;
  config: AppConfig;
}

export function registerAllIpcHandlers(options: RegisterIpcOptions): void {
  registerSystemIpc(options.statusService, options.initService);
  registerAuditIpc(options.auditService);
  registerConfigIpc(options.config);
}
