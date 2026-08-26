import { ipcMain } from 'electron';
import {
  IPC_CHANNELS,
  IPCResponse,
  createSuccessResult,
  createErrorResult,
  Logger
} from '@medidesk/shared';
import {
  MedicineMasterService,
  SupplierPurchaseService,
  InventoryService,
  AuthenticationService
} from '@medidesk/application';

const logger = new Logger('PharmacyIPC');

export function registerPharmacyIpcHandlers(
  medicineService: MedicineMasterService,
  supplierPurchaseService: SupplierPurchaseService,
  inventoryService: InventoryService,
  authService: AuthenticationService
): void {
  const authenticate = (sessionToken: string) => {
    const user = authService.getSessionUser(sessionToken);
    if (!user) {
      throw new Error('Authentication required. Session is invalid or expired.');
    }
    return user;
  };

  // 1. Medicine Master
  ipcMain.handle(
    IPC_CHANNELS.MEDICINE_CREATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const med = await medicineService.createMedicine(input, actor);
        return createSuccessResult(med);
      } catch (error) {
        logger.warn(`Medicine create failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'MEDICINE_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MEDICINE_UPDATE,
    async (_event, id: string, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const med = await medicineService.updateMedicine(id, input, actor);
        return createSuccessResult(med);
      } catch (error) {
        logger.warn(`Medicine update failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'MEDICINE_UPDATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MEDICINE_SEARCH,
    async (_event, query: string, sessionToken: string, limit?: number): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicineService.searchMedicines(query, actor, limit);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('MEDICINE_SEARCH_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MEDICINE_GET_BY_ID,
    async (_event, id: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const med = await medicineService.getMedicineById(id, actor);
        return createSuccessResult(med);
      } catch (error) {
        return createErrorResult('MEDICINE_GET_ERROR', (error as Error).message);
      }
    }
  );

  // 2. Manufacturers
  ipcMain.handle(
    IPC_CHANNELS.MANUFACTURER_CREATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const mfg = await medicineService.createManufacturer(input, actor);
        return createSuccessResult(mfg);
      } catch (error) {
        return createErrorResult('MANUFACTURER_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MANUFACTURER_LIST,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicineService.listManufacturers(actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('MANUFACTURER_LIST_ERROR', (error as Error).message);
      }
    }
  );

  // 3. Medicine Product Variants (SKUs)
  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_CREATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const prod = await medicineService.createProduct(input, actor);
        return createSuccessResult(prod);
      } catch (error) {
        return createErrorResult('PRODUCT_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_UPDATE,
    async (_event, id: string, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const prod = await medicineService.updateProduct(id, input, actor);
        return createSuccessResult(prod);
      } catch (error) {
        return createErrorResult('PRODUCT_UPDATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_SEARCH,
    async (_event, query: string, sessionToken: string, limit?: number): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await medicineService.searchProducts(query, actor, limit);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('PRODUCT_SEARCH_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_GET_BY_BARCODE,
    async (_event, barcode: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const prod = await medicineService.getProductByBarcode(barcode, actor);
        return createSuccessResult(prod);
      } catch (error) {
        return createErrorResult('PRODUCT_GET_BARCODE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PRODUCT_GET_BY_ID,
    async (_event, id: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const prod = await medicineService.getProductById(id, actor);
        return createSuccessResult(prod);
      } catch (error) {
        return createErrorResult('PRODUCT_GET_ERROR', (error as Error).message);
      }
    }
  );

  // 4. Suppliers
  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_CREATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const sup = await supplierPurchaseService.createSupplier(input, actor);
        return createSuccessResult(sup);
      } catch (error) {
        return createErrorResult('SUPPLIER_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_UPDATE,
    async (_event, id: string, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const sup = await supplierPurchaseService.updateSupplier(id, input, actor);
        return createSuccessResult(sup);
      } catch (error) {
        return createErrorResult('SUPPLIER_UPDATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_SEARCH,
    async (_event, query: string, sessionToken: string, limit?: number): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await supplierPurchaseService.searchSuppliers(query, actor, limit);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('SUPPLIER_SEARCH_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SUPPLIER_LIST,
    async (_event, sessionToken: string, limit?: number, offset?: number): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await supplierPurchaseService.searchSuppliers('', actor, limit ?? 50);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('SUPPLIER_LIST_ERROR', (error as Error).message);
      }
    }
  );

  // 5. Purchases
  ipcMain.handle(
    IPC_CHANNELS.PURCHASE_CREATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const pur = await supplierPurchaseService.createPurchaseInvoice(input, actor);
        return createSuccessResult(pur);
      } catch (error) {
        logger.warn(`Purchase invoice create failed: ${(error as Error).message}`);
        return createErrorResult((error as Error).name || 'PURCHASE_CREATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PURCHASE_GET_BY_ID,
    async (_event, id: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const pur = await supplierPurchaseService.getPurchaseById(id, actor);
        return createSuccessResult(pur);
      } catch (error) {
        return createErrorResult('PURCHASE_GET_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PURCHASE_LIST,
    async (_event, sessionToken: string, limit?: number, offset?: number): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await supplierPurchaseService.listPurchases(actor, limit, offset);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('PURCHASE_LIST_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PURCHASE_CANCEL,
    async (_event, id: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const pur = await supplierPurchaseService.cancelPurchase(id, actor);
        return createSuccessResult(pur);
      } catch (error) {
        return createErrorResult('PURCHASE_CANCEL_ERROR', (error as Error).message);
      }
    }
  );

  // 6. Inventory & Batches
  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_GET_BATCHES,
    async (_event, productId: string, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const batches = await inventoryService.getBatchesByProduct(productId, actor);
        return createSuccessResult(batches);
      } catch (error) {
        return createErrorResult('INVENTORY_GET_BATCHES_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_FEFO_ALLOCATE,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const allocation = await inventoryService.allocateFefoStock(input, actor);
        return createSuccessResult(allocation);
      } catch (error) {
        return createErrorResult('FEFO_ALLOCATE_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_ADJUST_STOCK,
    async (_event, input: unknown, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const batch = await inventoryService.adjustStock(input, actor);
        return createSuccessResult(batch);
      } catch (error) {
        return createErrorResult((error as Error).name || 'STOCK_ADJUST_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_GET_EXPIRING_SOON,
    async (_event, withinDays: number, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await inventoryService.getExpiringSoon(withinDays, actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('EXPIRING_SOON_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_GET_EXPIRED,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await inventoryService.getExpired(actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('EXPIRED_LIST_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_GET_LOW_STOCK,
    async (_event, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        const list = await inventoryService.getLowStock(actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('LOW_STOCK_ERROR', (error as Error).message);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_GET_MOVEMENTS,
    async (_event, productId: string | undefined, sessionToken: string): Promise<IPCResponse<any>> => {
      try {
        const actor = authenticate(sessionToken);
        if (productId) {
          const list = await inventoryService.getStockMovementsByProduct(productId, actor);
          return createSuccessResult(list);
        }
        const list = await inventoryService.getRecentStockMovements(actor);
        return createSuccessResult(list);
      } catch (error) {
        return createErrorResult('MOVEMENTS_GET_ERROR', (error as Error).message);
      }
    }
  );
}
