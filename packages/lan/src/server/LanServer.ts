import http from 'http';
import { Logger } from '@medidesk/shared';
import {
  ILanServerConfigRepository,
  ILanDeviceRepository,
  LanServerConfig,
  SessionUser,
  PermissionCode,
  AuthorizationError
} from '@medidesk/domain';
import { AuthenticationService } from '@medidesk/application';
import { PatientService, DoctorService, AppointmentService } from '@medidesk/application';
import { ClinicalVisitService, PrescriptionService, PatientMedicalRecordService } from '@medidesk/application';
import { MedicineMasterService, SupplierPurchaseService, InventoryService, PharmacyBillingService } from '@medidesk/application';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { LanSecurityManager } from '../security/LanSecurityManager.js';

export interface LanServerServices {
  authService: AuthenticationService;
  patientService?: PatientService;
  doctorService?: DoctorService;
  appointmentService?: AppointmentService;
  clinicalVisitService?: ClinicalVisitService;
  prescriptionService?: PrescriptionService;
  medicalRecordService?: PatientMedicalRecordService;
  medicineService?: MedicineMasterService;
  purchaseService?: SupplierPurchaseService;
  inventoryService?: InventoryService;
  billingService?: PharmacyBillingService;
  auditService?: AuditService;
  rbacEngine?: RBACEngine;
}

export class LanServer {
  private configRepo: ILanServerConfigRepository;
  private deviceRepo: ILanDeviceRepository;
  private securityManager: LanSecurityManager;
  private services: LanServerServices;
  private logger: Logger;
  private server: http.Server | null = null;
  private isRunning = false;
  private currentPort = 4848;
  private activeOrganizationId = 'default-org';
  private writeMutex: Promise<void> = Promise.resolve();

  constructor(
    configRepo: ILanServerConfigRepository,
    deviceRepo: ILanDeviceRepository,
    securityManager: LanSecurityManager,
    services: LanServerServices
  ) {
    this.configRepo = configRepo;
    this.deviceRepo = deviceRepo;
    this.securityManager = securityManager;
    this.services = services;
    this.logger = new Logger('LanServer');
  }

  public getSecurityManager(): LanSecurityManager {
    return this.securityManager;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getPort(): number {
    return this.currentPort;
  }

  /**
   * Starts the LAN Server on the configured port.
   */
  public async start(organizationId: string): Promise<LanServerConfig> {
    if (this.isRunning) {
      this.logger.info(`LAN Server is already running on port ${this.currentPort}`);
      return this.configRepo.getConfig(organizationId);
    }

    this.activeOrganizationId = organizationId;
    const config = await this.configRepo.getConfig(organizationId);
    this.currentPort = config.serverPort || 4848;

    // Ensure TLS / Fingerprint is generated
    await this.securityManager.getOrGenerateTlsCredentials(organizationId);

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));

      this.server.on('error', (err: any) => {
        this.logger.error(`LAN Server failed to start: ${err.message}`);
        this.isRunning = false;
        reject(err);
      });

      this.server.listen(this.currentPort, '0.0.0.0', async () => {
        this.isRunning = true;
        this.logger.info(`MediDesk LAN Server listening on 0.0.0.0:${this.currentPort} (Mode: ${config.operatingMode})`);
        resolve(await this.configRepo.getConfig(organizationId));
      });
    });
  }

  /**
   * Stops the LAN Server.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false;
        this.server = null;
        this.logger.info('MediDesk LAN Server stopped.');
        resolve();
      });
    });
  }

  /**
   * Main HTTP request router and dispatcher.
   */
  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Set CORS & Security Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Device-Signature, X-Request-Timestamp, X-Request-Nonce, X-Organization-Id');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const bodyStr = await this.readRequestBody(req);

    try {
      // 1. Health check (public)
      if (pathname === '/api/v1/health' && req.method === 'GET') {
        const approvedCount = await this.deviceRepo.countApproved(this.activeOrganizationId);
        const config = await this.configRepo.getConfig(this.activeOrganizationId);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          status: 'HEALTHY',
          serverTime: new Date().toISOString(),
          serverFingerprint: config.serverFingerprint,
          operatingMode: config.operatingMode,
          approvedDevices: approvedCount
        }));
        return;
      }

      // 2. Device Pairing Registration (requires valid pairing PIN)
      if (pathname === '/api/v1/devices/register' && req.method === 'POST') {
        const dto = JSON.parse(bodyStr || '{}');
        const regRes = await this.securityManager.registerDeviceWithPin(dto);
        res.writeHead(regRes.success ? 200 : 400);
        res.end(JSON.stringify(regRes));
        return;
      }

      // 3. Device Status Polling (for client awaiting approval)
      if (pathname === '/api/v1/devices/status' && req.method === 'GET') {
        const fingerprint = url.searchParams.get('fingerprint');
        const orgId = url.searchParams.get('organizationId') || this.activeOrganizationId;
        if (!fingerprint) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Missing fingerprint query parameter' }));
          return;
        }

        const dev = await this.deviceRepo.findByFingerprint(fingerprint, orgId);
        if (!dev) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, status: 'NOT_FOUND' }));
          return;
        }

        let deviceToken: string | undefined;
        if (dev.status === 'APPROVED') {
          deviceToken = dev.deviceTokenEnc || this.securityManager.createDeviceToken(dev.id, orgId);
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          status: dev.status,
          deviceId: dev.id,
          deviceName: dev.deviceName,
          deviceToken
        }));
        return;
      }

      // 4. Secure API Routes: Validate Device Signature
      const deviceId = req.headers['x-device-id'] as string;
      const deviceSig = req.headers['x-device-signature'] as string;
      const timestampStr = req.headers['x-request-timestamp'] as string;
      const nonce = req.headers['x-request-nonce'] as string;
      const orgId = (req.headers['x-organization-id'] as string) || this.activeOrganizationId;

      if (deviceId && deviceSig && timestampStr && nonce) {
        const valRes = await this.securityManager.validateRequest(
          deviceId,
          orgId,
          deviceSig,
          bodyStr,
          timestampStr,
          nonce
        );

        if (!valRes.isValid) {
          res.writeHead(403);
          res.end(JSON.stringify({
            success: false,
            error: {
              code: 'DEVICE_UNAUTHORIZED',
              message: valRes.error
            }
          }));
          return;
        }
      }

      // 5. Authenticate Session User
      const authHeader = req.headers['authorization'] || '';
      let sessionUser: SessionUser | undefined;
      if (authHeader.startsWith('Bearer ')) {
        const sessionToken = authHeader.substring(7);
        sessionUser = this.services.authService.getSessionUser(sessionToken) || undefined;
      }

      // Dispatch route
      const result = await this.dispatchRoute(req.method || 'GET', pathname, url, bodyStr, sessionUser, orgId);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: result }));
    } catch (err: any) {
      const statusCode = err instanceof AuthorizationError ? 403 : (err.statusCode || 500);
      this.logger.warn(`API Error on ${req.method} ${pathname}: ${err.message}`);
      res.writeHead(statusCode);
      res.end(JSON.stringify({
        success: false,
        error: {
          code: err.code || 'LAN_API_ERROR',
          message: err.message
        }
      }));
    }
  }

  /**
   * Dispatches incoming authenticated requests to corresponding Application Services.
   */
  private async dispatchRoute(
    method: string,
    pathname: string,
    url: URL,
    bodyStr: string,
    user?: SessionUser,
    orgId?: string
  ): Promise<any> {
    const effectiveOrgId = user?.organizationId || orgId || this.activeOrganizationId;
    const body = bodyStr ? JSON.parse(bodyStr) : {};

    // --- Authentication & Session Routes ---
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const loginRes = await this.services.authService.login({
        username: body.username,
        password: body.password
      });
      return loginRes;
    }

    if (pathname === '/api/v1/auth/logout' && method === 'POST') {
      if (body.sessionToken) {
        await this.services.authService.logout(body.sessionToken);
      }
      return { success: true };
    }

    if (pathname === '/api/v1/auth/me' && method === 'GET') {
      return user || null;
    }

    // Require valid login session for all business and clinical data routes
    if (!user) {
      throw new AuthorizationError('Authentication required. Session token is invalid or expired.');
    }

    // --- LAN Management Routes (Owner Only) ---
    if (pathname === '/api/v1/lan/pin' && method === 'POST') {
      this.assertPermission(user, PermissionCode.ORG_MANAGE);
      return this.securityManager.generatePairingPin(effectiveOrgId, user.id);
    }

    if (pathname === '/api/v1/lan/devices' && method === 'GET') {
      this.assertPermission(user, PermissionCode.ORG_MANAGE);
      return this.deviceRepo.listByOrg(effectiveOrgId);
    }

    if (pathname.startsWith('/api/v1/lan/devices/') && pathname.endsWith('/approve') && method === 'POST') {
      this.assertPermission(user, PermissionCode.ORG_MANAGE);
      const devId = pathname.split('/')[4];
      return this.securityManager.approveDevice(devId, effectiveOrgId, user.id);
    }

    if (pathname.startsWith('/api/v1/lan/devices/') && pathname.endsWith('/revoke') && method === 'POST') {
      this.assertPermission(user, PermissionCode.ORG_MANAGE);
      const devId = pathname.split('/')[4];
      await this.securityManager.revokeDevice(devId, effectiveOrgId);
      return { success: true };
    }

    // --- Patient Services ---
    if (pathname === '/api/v1/patients' && method === 'GET') {
      this.assertPermission(user, PermissionCode.PATIENT_READ);
      const query = url.searchParams.get('q') || '';
      return this.services.patientService?.searchPatients({ query, organizationId: effectiveOrgId }, user);
    }

    if (pathname === '/api/v1/patients' && method === 'POST') {
      this.assertPermission(user, PermissionCode.PATIENT_CREATE);
      return this.services.patientService?.registerPatient({
        ...body,
        organizationId: effectiveOrgId
      }, user);
    }

    // --- Doctor & Appointment Services ---
    if (pathname === '/api/v1/doctors' && method === 'GET') {
      this.assertPermission(user, PermissionCode.DOCTOR_READ);
      return this.services.doctorService?.listDoctors(effectiveOrgId, user);
    }

    if (pathname === '/api/v1/appointments' && method === 'GET') {
      this.assertPermission(user, PermissionCode.APPOINTMENT_READ);
      return this.services.appointmentService?.listAppointments({ organizationId: effectiveOrgId }, user);
    }

    if (pathname === '/api/v1/appointments' && method === 'POST') {
      this.assertPermission(user, PermissionCode.APPOINTMENT_CREATE);
      return this.services.appointmentService?.bookAppointment({
        ...body,
        organizationId: effectiveOrgId
      }, user);
    }

    // --- Prescriptions & Clinical ---
    if (pathname === '/api/v1/prescriptions' && method === 'POST') {
      this.assertPermission(user, PermissionCode.PRESCRIPTION_CREATE);
      return this.services.prescriptionService?.createPrescription(body, user);
    }

    // --- Pharmacy Inventory & FEFO Batches ---
    if (pathname === '/api/v1/inventory/batches' && method === 'GET') {
      this.assertPermission(user, PermissionCode.BATCH_READ);
      const productId = url.searchParams.get('productId');
      if (productId) {
        return this.services.inventoryService?.getBatchesByProduct(productId, user);
      }
      return this.services.inventoryService?.getLowStock(user);
    }

    if (pathname === '/api/v1/inventory/fefo' && method === 'GET') {
      this.assertPermission(user, PermissionCode.BATCH_READ);
      const productId = url.searchParams.get('productId');
      const qty = parseInt(url.searchParams.get('quantity') || '1', 10);
      if (!productId) throw new Error('Missing productId parameter');
      return this.services.inventoryService?.allocateFefoStock({
        productId,
        requestedQuantity: qty,
        organizationId: effectiveOrgId
      }, user);
    }

    // --- POS Billing (Serialized Mutex Transaction) ---
    if (pathname === '/api/v1/sales' && method === 'POST') {
      this.assertPermission(user, PermissionCode.SALE_CREATE);
      return this.executeWithMutex(async () => {
        return this.services.billingService?.createSale(body, user);
      });
    }

    throw new Error(`Route not found: ${method} ${pathname}`);
  }

  /**
   * Executes a write operation within a serialized in-memory mutex to ensure atomic concurrency.
   */
  private async executeWithMutex<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.writeMutex;
    let resolveNext: () => void;
    this.writeMutex = new Promise((resolve) => {
      resolveNext = resolve;
    });

    await prev;
    try {
      return await fn();
    } finally {
      resolveNext!();
    }
  }

  private assertPermission(user: SessionUser, permission: string): void {
    if (this.services.rbacEngine && !this.services.rbacEngine.evaluatePermission(user.roles, permission)) {
      throw new AuthorizationError(`Access denied: Missing permission '${permission}'.`);
    }
  }

  private async readRequestBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => { resolve(data); });
      req.on('error', (err) => { reject(err); });
    });
  }
}
