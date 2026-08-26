import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  createSuccessResult,
  createErrorResult,
  Logger
} from '@medidesk/shared';
import {
  PharmacyBillingService,
  AuthenticationService
} from '@medidesk/application';

const logger = new Logger('POSIPC');

export function registerPosIpcHandlers(
  billingService: PharmacyBillingService,
  authService: AuthenticationService
): void {
  const authenticate = (sessionToken: string) => {
    const user = authService.getSessionUser(sessionToken);
    if (!user) {
      throw new Error('Authentication required. Session is invalid or expired.');
    }
    return user;
  };

  // 1. Create Sale (POS Checkout)
  ipcMain.handle(
    IPC_CHANNELS.SALE_CREATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const sale = await billingService.createSale(input, actor);
        return createSuccessResult(sale);
      } catch (error) {
        logger.warn(`Sale checkout failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'SALE_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  // 2. Get Sale by ID
  ipcMain.handle(
    IPC_CHANNELS.SALE_GET_BY_ID,
    async (_event, id: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const sale = await billingService.getSaleById(id, actor);
        return createSuccessResult(sale);
      } catch (error) {
        return createErrorResult('SALE_GET_ERROR', (error as Error).message);
      }
    }
  );

  // 3. Get Sale by Bill Number
  ipcMain.handle(
    IPC_CHANNELS.SALE_GET_BY_BILL,
    async (_event, billNumber: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const sale = await billingService.getSaleByBillNumber(billNumber, actor);
        return createSuccessResult(sale);
      } catch (error) {
        return createErrorResult('SALE_GET_ERROR', (error as Error).message);
      }
    }
  );

  // 4. List Sales
  ipcMain.handle(
    IPC_CHANNELS.SALE_LIST,
    async (_event, sessionToken: string, limit?: number, offset?: number): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await billingService.listSales(actor, limit, offset);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('SALE_LIST_ERROR', (error as Error).message);
      }
    }
  );

  // 5. List Sales by Patient
  ipcMain.handle(
    IPC_CHANNELS.SALE_LIST_BY_PATIENT,
    async (_event, patientId: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await billingService.getSalesByPatient(patientId, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('SALE_LIST_PATIENT_ERROR', (error as Error).message);
      }
    }
  );

  // 6. Cancel Sale (Void)
  ipcMain.handle(
    IPC_CHANNELS.SALE_CANCEL,
    async (_event, id: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const sale = await billingService.cancelSale(id, actor);
        return createSuccessResult(sale);
      } catch (error) {
        return createErrorResult('SALE_CANCEL_ERROR', (error as Error).message);
      }
    }
  );

  // 7. Customer Return
  ipcMain.handle(
    IPC_CHANNELS.SALE_RETURN,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const ret = await billingService.createSaleReturn(input, actor);
        return createSuccessResult(ret);
      } catch (error) {
        logger.warn(`Sale return failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'SALE_RETURN_ERROR', (error as Error).message);
      }
    }
  );

  // 8. Match Prescription to Pharmacy Products
  ipcMain.handle(
    IPC_CHANNELS.SALE_MATCH_PRESCRIPTION,
    async (_event, prescriptionId: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const matches = await billingService.matchPrescriptionItems(prescriptionId, actor);
        return createSuccessResult(matches);
      } catch (error) {
        return createErrorResult('PRESCRIPTION_MATCH_ERROR', (error as Error).message);
      }
    }
  );

  // 9. Daily Sales Report
  ipcMain.handle(
    IPC_CHANNELS.REPORT_DAILY_SALES,
    async (_event, dateStr: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const report = await billingService.getDailySalesReport(dateStr, actor);
        return createSuccessResult(report);
      } catch (error) {
        return createErrorResult('DAILY_REPORT_ERROR', (error as Error).message);
      }
    }
  );
}
