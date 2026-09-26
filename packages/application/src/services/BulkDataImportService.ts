import {
  ImportType,
  ImportValidationResult,
  ImportRowValidation,
  ImportRowProblem,
  ImportExecutionResult,
  ImportTemplateDefinition,
  SessionUser,
  PermissionCode,
  AuditAction,
  AuditResult,
  AuthorizationError,
  IPatientRepository,
  IDoctorRepository,
  IUserRepository,
  IMedicineRepository,
  IMedicineProductRepository,
  IPackagingUnitRepository,
  ISupplierRepository,
  IInventoryBatchRepository,
  IStockMovementRepository,
  IPasswordHasher
} from '@medidesk/domain';
import { RBACEngine } from '@medidesk/authorization';
import { AuditService } from '@medidesk/audit';
import { Logger } from '@medidesk/shared';
import {
  ValidateImportFileInput,
  ExecuteImportInput,
  ValidateImportFileSchema,
  ExecuteImportSchema,
  PatientImportRowSchema,
  DoctorImportRowSchema,
  UserImportRowSchema,
  MedicineImportRowSchema,
  PackagingImportRowSchema,
  SupplierImportRowSchema,
  OpeningStockImportRowSchema,
  BarcodeImportRowSchema,
  validateSchema
} from '@medidesk/validation';
import { CsvParser } from '../utils/CsvParser.js';

export interface SqliteTransactionRunner {
  transaction<T>(fn: () => T): T;
}

export class BulkDataImportService {
  private logger: Logger;

  constructor(
    private db: SqliteTransactionRunner,
    private patientRepo: IPatientRepository,
    private doctorRepo: IDoctorRepository,
    private userRepo: IUserRepository,
    private medicineRepo: IMedicineRepository,
    private productRepo: IMedicineProductRepository,
    private packagingUnitRepo: IPackagingUnitRepository,
    private supplierRepo: ISupplierRepository,
    private batchRepo: IInventoryBatchRepository,
    private movementRepo: IStockMovementRepository,
    private passwordHasher: IPasswordHasher,
    private auditService: AuditService,
    private rbacEngine: RBACEngine
  ) {
    this.logger = new Logger('BulkDataImportService');
  }

  private assertPermission(actor: SessionUser, permission: string): void {
    if (!this.rbacEngine.evaluatePermission(actor.roles, permission)) {
      this.logger.warn(`Access Denied: Actor '${actor.username}' lacks permission '${permission}'`);
      throw new AuthorizationError(`Access Denied: Missing '${permission}' permission.`);
    }
  }

  public getRequiredPermission(importType: ImportType): string {
    switch (importType) {
      case 'PATIENTS':
        return PermissionCode.PATIENT_CREATE;
      case 'DOCTORS':
        return PermissionCode.DOCTOR_CREATE;
      case 'USERS':
        return PermissionCode.USER_CREATE;
      case 'MEDICINES':
        return PermissionCode.MEDICINE_CREATE;
      case 'PACKAGING':
        return PermissionCode.PACKAGING_MANAGE;
      case 'SUPPLIERS':
        return PermissionCode.SUPPLIER_CREATE;
      case 'OPENING_STOCK':
        return PermissionCode.INVENTORY_ADJUST;
      case 'BARCODES':
        return PermissionCode.MEDICINE_UPDATE;
      case 'APPOINTMENTS':
        return PermissionCode.APPOINTMENT_CREATE;
      case 'DEPARTMENTS':
      case 'PRICE_LISTS':
        return PermissionCode.ORG_MANAGE;
    }
  }

  public getTemplates(): ImportTemplateDefinition[] {
    return [
      {
        importType: 'PATIENTS',
        displayName: 'Patients',
        description: 'Onboard clinical patients with contact information and demographic details.',
        fileName: 'patients_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.PATIENT_CREATE,
        columns: [
          { name: 'first_name', required: true, description: 'Patient first name', example: 'Rahul' },
          { name: 'middle_name', required: false, description: 'Middle name', example: 'Kumar' },
          { name: 'last_name', required: false, description: 'Last name', example: 'Sharma' },
          { name: 'gender', required: true, description: 'MALE, FEMALE, or OTHER', example: 'MALE', allowedValues: ['MALE', 'FEMALE', 'OTHER'] },
          { name: 'date_of_birth', required: false, description: 'Date of birth (YYYY-MM-DD)', example: '1990-05-15' },
          { name: 'age', required: false, description: 'Age in years if DOB unknown', example: '34' },
          { name: 'phone', required: false, description: 'Primary 10-digit mobile number', example: '9876543210' },
          { name: 'email', required: false, description: 'Email address', example: 'rahul.sharma@example.com' },
          { name: 'address', required: false, description: 'Residential street address', example: '123 MG Road' },
          { name: 'city', required: false, description: 'City name', example: 'Bengaluru' },
          { name: 'state', required: false, description: 'State name', example: 'Karnataka' },
          { name: 'pincode', required: false, description: '6-digit PIN code', example: '560001' },
          { name: 'blood_group', required: false, description: 'Blood group', example: 'O+' },
          { name: 'allergies', required: false, description: 'Known drug or food allergies', example: 'Penicillin, Peanuts' }
        ]
      },
      {
        importType: 'DOCTORS',
        displayName: 'Doctors',
        description: 'Import consulting doctors, specializations, and medical registration credentials.',
        fileName: 'doctors_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.DOCTOR_CREATE,
        columns: [
          { name: 'name', required: true, description: 'Doctor full name (with Dr. prefix)', example: 'Dr. Ananya Roy' },
          { name: 'registration_number', required: false, description: 'State medical council registration number', example: 'KMC-54321' },
          { name: 'specialization', required: false, description: 'Clinical specialty', example: 'General Medicine' },
          { name: 'phone', required: false, description: 'Contact phone number', example: '9845012345' },
          { name: 'email', required: false, description: 'Official email address', example: 'dr.ananya@clinic.com' },
          { name: 'consultation_fee', required: false, description: 'Default consultation fee in Rupees', example: '500' },
          { name: 'status', required: false, description: 'Status (ACTIVE or INACTIVE)', example: 'ACTIVE', allowedValues: ['ACTIVE', 'INACTIVE'] }
        ]
      },
      {
        importType: 'USERS',
        displayName: 'Staff & Users',
        description: 'Onboard receptionists, pharmacy staff, and clinical assistants.',
        fileName: 'users_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.USER_CREATE,
        columns: [
          { name: 'username', required: true, description: 'Unique login handle (alphanumeric)', example: 'reception_priya' },
          { name: 'full_name', required: true, description: 'Staff full name', example: 'Priya Nair' },
          { name: 'email', required: true, description: 'Staff email address', example: 'priya@clinic.com' },
          { name: 'role', required: true, description: 'Assigned role: DOCTOR or STAFF', example: 'STAFF', allowedValues: ['DOCTOR', 'STAFF'] },
          { name: 'phone', required: false, description: 'Contact phone', example: '9876543211' }
        ]
      },
      {
        importType: 'MEDICINES',
        displayName: 'Medicines & Products',
        description: 'Upload medicine master catalog with generic formulations, brand products, HSN, and GST.',
        fileName: 'medicines_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.MEDICINE_CREATE,
        columns: [
          { name: 'generic_name', required: true, description: 'Generic salt / molecular formulation', example: 'Paracetamol' },
          { name: 'brand_name', required: true, description: 'Trade / Brand name', example: 'Dolo 650mg Tablet' },
          { name: 'strength', required: false, description: 'Dosage strength', example: '650mg' },
          { name: 'dosage_form', required: true, description: 'Formulation form', example: 'TABLET', allowedValues: ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'OINTMENT', 'CREAM', 'GEL', 'INHALER', 'POWDER', 'LOTION', 'OTHER'] },
          { name: 'manufacturer', required: false, description: 'Pharmaceutical manufacturer name', example: 'Micro Labs Ltd' },
          { name: 'category', required: false, description: 'Schedule category', example: 'GENERAL', allowedValues: ['GENERAL', 'H', 'H1', 'X'] },
          { name: 'barcode', required: false, description: 'Product barcode / EAN', example: '8901234567890' },
          { name: 'hsn_code', required: false, description: 'HSN tax classification code', example: '30049099' },
          { name: 'gst_rate', required: false, description: 'GST percentage rate (e.g. 12 for 12%)', example: '12' },
          { name: 'mrp', required: true, description: 'Maximum Retail Price per pack in Rupees', example: '30.50' },
          { name: 'selling_price', required: false, description: 'Discounted selling price per pack in Rupees', example: '28.00' },
          { name: 'reorder_level', required: false, description: 'Minimum stock reorder alert threshold', example: '20' },
          { name: 'pack_size', required: false, description: 'Packaging description', example: '15 Tablets / Strip' },
          { name: 'pack_quantity', required: false, description: 'Base units contained per pack', example: '15' }
        ]
      },
      {
        importType: 'PACKAGING',
        displayName: 'Medicine Packaging Units',
        description: 'Configure multi-tier packaging units and conversion multipliers (e.g. Box -> Strip -> Tablet).',
        fileName: 'packaging_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.PACKAGING_MANAGE,
        columns: [
          { name: 'medicine_name', required: true, description: 'Brand name of existing medicine product', example: 'Dolo 650mg Tablet' },
          { name: 'unit_name', required: true, description: 'Packaging unit name (e.g. Strip, Box, Carton)', example: 'Strip' },
          { name: 'conversion_factor', required: true, description: 'Multiplier: base units contained in this package', example: '15' },
          { name: 'sale_price', required: false, description: 'Package sale price in Rupees', example: '28.00' },
          { name: 'mrp', required: false, description: 'Package MRP in Rupees', example: '30.50' },
          { name: 'barcode', required: false, description: 'Unit barcode', example: '8901234567891' }
        ]
      },
      {
        importType: 'SUPPLIERS',
        displayName: 'Suppliers & Vendors',
        description: 'Import pharmaceutical distributors, GSTIN numbers, and vendor contact info.',
        fileName: 'suppliers_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.SUPPLIER_CREATE,
        columns: [
          { name: 'supplier_name', required: true, description: 'Distributor or company name', example: 'Evergreen Pharma Distributors' },
          { name: 'gstin', required: false, description: '15-character GSTIN tax number', example: '29ABCDE1234F1Z5' },
          { name: 'phone', required: false, description: 'Primary telephone number', example: '080-23456789' },
          { name: 'email', required: false, description: 'Billing / ordering email address', example: 'orders@evergreenpharma.in' },
          { name: 'address', required: false, description: 'Warehouse / office address', example: 'Plot 42, Industrial Area' },
          { name: 'city', required: false, description: 'City', example: 'Bengaluru' },
          { name: 'state', required: false, description: 'State', example: 'Karnataka' },
          { name: 'pincode', required: false, description: '6-digit PIN code', example: '560058' }
        ]
      },
      {
        importType: 'OPENING_STOCK',
        displayName: 'Opening Stock (High Risk)',
        description: 'Inward opening inventory balances with batch numbers, future expiries, and purchase costs.',
        fileName: 'opening_stock_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.INVENTORY_ADJUST,
        columns: [
          { name: 'medicine_name', required: true, description: 'Brand name of existing medicine product', example: 'Dolo 650mg Tablet' },
          { name: 'batch_number', required: true, description: 'Manufacturer batch or lot number', example: 'DL65-2026' },
          { name: 'expiry_date', required: true, description: 'Batch expiry date in YYYY-MM-DD (must be future)', example: '2028-12-31' },
          { name: 'quantity', required: true, description: 'Opening stock count in base units (e.g. tablets)', example: '300' },
          { name: 'purchase_price', required: true, description: 'Purchase rate per base unit in Rupees', example: '1.50' },
          { name: 'mrp', required: true, description: 'MRP per base unit in Rupees', example: '2.03' },
          { name: 'sale_price', required: false, description: 'Sale price per base unit in Rupees', example: '1.87' },
          { name: 'supplier_name', required: false, description: 'Name of supplier vendor', example: 'Evergreen Pharma Distributors' },
          { name: 'received_date', required: false, description: 'Date stock received (YYYY-MM-DD)', example: '2026-08-01' }
        ]
      },
      {
        importType: 'BARCODES',
        displayName: 'Barcodes',
        description: 'Assign or update EAN/UPC barcodes for products and packaging units.',
        fileName: 'barcodes_template.csv',
        isSupported: true,
        requiredPermission: PermissionCode.MEDICINE_UPDATE,
        columns: [
          { name: 'barcode', required: true, description: 'Unique barcode string', example: '8901234567890' },
          { name: 'target_type', required: true, description: 'Target: PRODUCT or PACKAGING', example: 'PRODUCT', allowedValues: ['PRODUCT', 'PACKAGING'] },
          { name: 'medicine_name', required: true, description: 'Brand name of medicine product', example: 'Dolo 650mg Tablet' },
          { name: 'packaging_unit_name', required: false, description: 'Packaging unit name if target is PACKAGING', example: 'Strip' }
        ]
      },
      {
        importType: 'APPOINTMENTS',
        displayName: 'Historical Appointments',
        description: 'Historical appointment import is restricted to preserve clinical audit timeline integrity.',
        fileName: 'appointments_template.csv',
        isSupported: false,
        unsupportedReason: 'Historical appointment bulk import is disabled to preserve patient consultation timeline invariants and doctor schedule integrity. Please schedule upcoming visits directly in Appointments & Queue.',
        requiredPermission: PermissionCode.APPOINTMENT_CREATE,
        columns: []
      },
      {
        importType: 'DEPARTMENTS',
        displayName: 'Departments & Services',
        description: 'Master service catalogs are not defined in the current clinical schema.',
        fileName: 'departments_template.csv',
        isSupported: false,
        unsupportedReason: 'MediDesk Phase 8 manages clinical visits directly through doctor consultations. Standalone service master tables are not currently defined in the schema.',
        requiredPermission: PermissionCode.ORG_MANAGE,
        columns: []
      },
      {
        importType: 'PRICE_LISTS',
        displayName: 'Price Lists',
        description: 'MediDesk manages product and packaging prices directly on medicine master records.',
        fileName: 'pricelists_template.csv',
        isSupported: false,
        unsupportedReason: 'MediDesk manages pricing directly on Medicine Products and Packaging Units. Please update prices using the Medicines or Packaging import options.',
        requiredPermission: PermissionCode.ORG_MANAGE,
        columns: []
      }
    ];
  }

  public getTemplate(importType: ImportType): { filename: string; content: string; definition: ImportTemplateDefinition } {
    const templates = this.getTemplates();
    const def = templates.find((t) => t.importType === importType);
    if (!def) {
      throw new Error(`Unknown import type: ${importType}`);
    }

    if (!def.isSupported) {
      return {
        filename: def.fileName,
        content: `# NOT SUPPORTED: ${def.unsupportedReason}\r\n`,
        definition: def
      };
    }

    const headers = def.columns.map((c) => c.name);
    const exampleRow: Record<string, string> = {};
    for (const c of def.columns) {
      exampleRow[c.name] = c.example;
    }

    const csvContent = CsvParser.stringify(headers, [exampleRow]);
    return {
      filename: def.fileName,
      content: csvContent,
      definition: def
    };
  }

  public async parseAndValidate(
    input: ValidateImportFileInput,
    actor: SessionUser
  ): Promise<ImportValidationResult> {
    const validated = validateSchema(ValidateImportFileSchema, input);
    if (!validated.success) {
      throw new Error(`Invalid validation input: ${JSON.stringify(validated.errors)}`);
    }

    const { importType, fileName, fileContent, organizationId } = validated.data;
    const requiredPermission = this.getRequiredPermission(importType);
    this.assertPermission(actor, requiredPermission);

    const templateDef = this.getTemplates().find((t) => t.importType === importType);
    if (!templateDef || !templateDef.isSupported) {
      return {
        importType,
        fileName,
        totalRows: 0,
        validCount: 0,
        warningCount: 0,
        errorCount: 0,
        rows: [],
        isSupported: false,
        unsupportedReason: templateDef?.unsupportedReason ?? 'This import type is not supported.',
        canProceed: false
      };
    }

    const parsed = CsvParser.parse(fileContent);
    if (parsed.rows.length === 0) {
      return {
        importType,
        fileName,
        totalRows: 0,
        validCount: 0,
        warningCount: 0,
        errorCount: 1,
        rows: [
          {
            rowNumber: 1,
            status: 'ERROR',
            rawData: {},
            problems: [{ field: 'file', severity: 'ERROR', message: 'The uploaded file is empty or contains no data rows.', suggestedFix: 'Ensure file has headers and at least one data row.' }]
          }
        ],
        isSupported: true,
        canProceed: false
      };
    }

    const productCache = new Map<string, { id: string; brandName: string; barcode?: string }>();
    if (['PACKAGING', 'OPENING_STOCK', 'BARCODES'].includes(importType)) {
      const products = await this.productRepo.search(organizationId, '', 10000);
      for (const p of products) {
        productCache.set(p.brandName.toLowerCase().trim(), p);
        if (p.productCode) {
          productCache.set(p.productCode.toLowerCase().trim(), p);
        }
      }
    }

    const rows: ImportRowValidation[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    const seenKeys = new Set<string>();

    for (const parsedRow of parsed.rows) {
      const raw = parsedRow.data;
      const problems: ImportRowProblem[] = [];
      let normalizedData: Record<string, unknown> | undefined = undefined;

      switch (importType) {
        case 'PATIENTS': {
          const res = PatientImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: `Check ${err.path.join('.')} format.`
              });
            }
          } else {
            const data = res.data;
            const key = `${data.first_name.toLowerCase()}_${(data.last_name || '').toLowerCase()}_${data.phone || ''}`;
            if (seenKeys.has(key)) {
              problems.push({
                field: 'phone',
                severity: 'WARNING',
                message: 'Duplicate patient entry detected in this file.',
                suggestedFix: 'Review duplicate rows.'
              });
            } else {
              seenKeys.add(key);
            }
            normalizedData = data;
          }
          break;
        }

        case 'DOCTORS': {
          const res = DoctorImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: `Check doctor ${err.path.join('.')}.`
              });
            }
          } else {
            normalizedData = res.data;
          }
          break;
        }

        case 'USERS': {
          const res = UserImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: 'Provide valid username, email and role (DOCTOR or STAFF).'
              });
            }
          } else {
            normalizedData = res.data;
          }
          break;
        }

        case 'MEDICINES': {
          const res = MedicineImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: `Check ${err.path.join('.')} value.`
              });
            }
          } else {
            const data = res.data;
            const mrpPaise = Math.round(data.mrp * 100);
            const sellingPricePaise = data.selling_price !== undefined ? Math.round(data.selling_price * 100) : mrpPaise;

            if (sellingPricePaise > mrpPaise) {
              problems.push({
                field: 'selling_price',
                severity: 'WARNING',
                message: 'Selling price is higher than MRP.',
                suggestedFix: 'Ensure selling price is <= MRP.'
              });
            }

            normalizedData = {
              ...data,
              mrpPaise,
              sellingPricePaise
            };
          }
          break;
        }

        case 'PACKAGING': {
          const res = PackagingImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: `Check ${err.path.join('.')}.`
              });
            }
          } else {
            const data = res.data;
            const product = productCache.get(data.medicine_name.toLowerCase().trim());
            if (!product) {
              problems.push({
                field: 'medicine_name',
                severity: 'ERROR',
                message: `Medicine product '${data.medicine_name}' not found in database.`,
                suggestedFix: 'Import or create the medicine product first.'
              });
            } else {
              normalizedData = {
                ...data,
                productId: product.id,
                salePricePaise: data.sale_price !== undefined ? Math.round(data.sale_price * 100) : undefined,
                mrpPaise: data.mrp !== undefined ? Math.round(data.mrp * 100) : undefined
              };
            }
          }
          break;
        }

        case 'SUPPLIERS': {
          const res = SupplierImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: `Correct ${err.path.join('.')}.`
              });
            }
          } else {
            normalizedData = res.data;
          }
          break;
        }

        case 'OPENING_STOCK': {
          const res = OpeningStockImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: `Check ${err.path.join('.')}.`
              });
            }
          } else {
            const data = res.data;
            const product = productCache.get(data.medicine_name.toLowerCase().trim());
            if (!product) {
              problems.push({
                field: 'medicine_name',
                severity: 'ERROR',
                message: `Medicine product '${data.medicine_name}' does not exist.`,
                suggestedFix: 'Import or create the medicine master record first.'
              });
            }

            const expiryDate = new Date(data.expiry_date);
            const now = new Date();
            if (isNaN(expiryDate.getTime()) || expiryDate <= now) {
              problems.push({
                field: 'expiry_date',
                severity: 'ERROR',
                message: 'Expiry date must be in the future for opening stock.',
                suggestedFix: 'Provide a valid future expiry date (YYYY-MM-DD).'
              });
            }

            const purchasePricePaise = Math.round(data.purchase_price * 100);
            const mrpPaise = Math.round(data.mrp * 100);
            const salePricePaise = data.sale_price !== undefined ? Math.round(data.sale_price * 100) : mrpPaise;

            if (product && expiryDate > now) {
              normalizedData = {
                ...data,
                productId: product.id,
                purchasePricePaise,
                mrpPaise,
                salePricePaise
              };
            }
          }
          break;
        }

        case 'BARCODES': {
          const res = BarcodeImportRowSchema.safeParse(raw);
          if (!res.success) {
            for (const err of res.error.errors) {
              problems.push({
                field: err.path.join('.'),
                severity: 'ERROR',
                message: err.message,
                suggestedFix: 'Check barcode entry.'
              });
            }
          } else {
            const data = res.data;
            const product = productCache.get(data.medicine_name.toLowerCase().trim());
            if (!product) {
              problems.push({
                field: 'medicine_name',
                severity: 'ERROR',
                message: `Medicine product '${data.medicine_name}' not found.`,
                suggestedFix: 'Create medicine product before assigning barcodes.'
              });
            } else {
              normalizedData = {
                ...data,
                productId: product.id
              };
            }
          }
          break;
        }
      }

      const hasError = problems.some((p) => p.severity === 'ERROR');
      const hasWarning = problems.some((p) => p.severity === 'WARNING');

      let status: 'VALID' | 'WARNING' | 'ERROR';
      if (hasError) {
        status = 'ERROR';
        errorCount++;
      } else if (hasWarning) {
        status = 'WARNING';
        warningCount++;
      } else {
        status = 'VALID';
        validCount++;
      }

      rows.push({
        rowNumber: parsedRow.rowNumber,
        status,
        rawData: raw,
        normalizedData,
        problems
      });
    }

    const canProceed = errorCount === 0 || (validCount > 0 && input.importType !== 'OPENING_STOCK');

    return {
      importType,
      fileName,
      totalRows: parsed.rows.length,
      validCount,
      warningCount,
      errorCount,
      rows,
      isSupported: true,
      canProceed
    };
  }

  public async executeImport(
    input: ExecuteImportInput,
    actor: SessionUser
  ): Promise<ImportExecutionResult> {
    const validated = validateSchema(ExecuteImportSchema, input);
    if (!validated.success) {
      throw new Error(`Invalid execute import input: ${JSON.stringify(validated.errors)}`);
    }

    const { importType, fileName, policy, validRows, organizationId } = validated.data;
    const requiredPermission = this.getRequiredPermission(importType);
    this.assertPermission(actor, requiredPermission);

    const startTime = Date.now();
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let rejectedCount = 0;
    const errors: Array<{ rowNumber: number; error: string }> = [];

    try {
      let rowIdx = 1;

      for (const rawItem of validRows) {
        rowIdx++;
        try {
          switch (importType) {
            case 'PATIENTS': {
              const item = rawItem as any;
              if (policy === 'SKIP_DUPLICATES') {
                const duplicates = await this.patientRepo.findPotentialDuplicates(organizationId, {
                  fullName: `${item.first_name} ${item.last_name || ''}`.trim(),
                  mobile: item.phone,
                  dateOfBirth: item.date_of_birth,
                  sex: item.gender
                });
                if (duplicates && duplicates.length > 0) {
                  skippedCount++;
                  break;
                }
              }

              await this.patientRepo.create({
                organizationId,
                fullName: `${item.first_name} ${item.middle_name ? item.middle_name + ' ' : ''}${item.last_name || ''}`.trim(),
                sex: item.gender,
                dateOfBirth: item.date_of_birth || undefined,
                age: item.age || undefined,
                mobile: item.phone || undefined,
                alternateMobile: item.alternate_phone || undefined,
                address: item.address || undefined,
                createdBy: actor.id
              });
              createdCount++;
              break;
            }

            case 'DOCTORS': {
              const item = rawItem as any;
              await this.doctorRepo.create({
                organizationId,
                displayName: item.name,
                qualification: item.specialization || 'MBBS',
                specialization: item.specialization || 'General Medicine',
                registrationNumber: item.registration_number || undefined,
                mobile: item.phone || undefined,
                consultationFee: item.consultation_fee ? Math.round(item.consultation_fee * 100) : 0,
                createdBy: actor.id
              });
              createdCount++;
              break;
            }

            case 'USERS': {
              const item = rawItem as any;
              if (!actor.roles.includes('OWNER')) {
                throw new AuthorizationError('Only clinic Owners are permitted to import staff user accounts.');
              }
              const tempPassword = `TempPass${Math.floor(1000 + Math.random() * 9000)}!`;
              const passwordHash = await this.passwordHasher.hash(tempPassword);

              await this.userRepo.create({
                organizationId,
                username: item.username.toLowerCase(),
                passwordHash,
                fullName: item.full_name,
                email: item.email,
                roles: [item.role as any]
              });
              createdCount++;
              break;
            }

            case 'MEDICINES': {
              const item = rawItem as any;
              const generics = await this.medicineRepo.search(organizationId, item.generic_name, 10);
              let medicine = generics.find(
                (g) => g.genericName.toLowerCase().trim() === item.generic_name.toLowerCase().trim()
              );
              if (!medicine) {
                medicine = await this.medicineRepo.create({
                  organizationId,
                  genericName: item.generic_name,
                  scheduleCategory: item.category || 'GENERAL',
                  isPrescriptionRequired: item.category === 'H' || item.category === 'H1' || item.category === 'X',
                  createdBy: actor.id
                });
              }

              await this.productRepo.create({
                organizationId,
                medicineId: medicine.id,
                brandName: item.brand_name,
                strength: item.strength || '',
                dosageForm: item.dosage_form,
                packSize: item.pack_size || '1 Unit',
                packQuantity: item.pack_quantity || 1,
                barcode: item.barcode || undefined,
                hsnCode: item.hsn_code || undefined,
                taxRatePercent: item.gst_rate || 0,
                minStockLevel: item.reorder_level || 0,
                maxStockLevel: (item.reorder_level || 0) * 5,
                reorderQuantity: (item.reorder_level || 0) * 2,
                createdBy: actor.id
              });
              createdCount++;
              break;
            }

            case 'PACKAGING': {
              const item = rawItem as any;
              await this.packagingUnitRepo.create({
                organizationId,
                productId: item.productId,
                unitName: item.unit_name,
                conversionFactor: item.conversion_factor,
                salePricePaise: item.salePricePaise,
                mrpPaise: item.mrpPaise,
                barcode: item.barcode || undefined
              });
              createdCount++;
              break;
            }

            case 'SUPPLIERS': {
              const item = rawItem as any;
              await this.supplierRepo.create({
                organizationId,
                name: item.supplier_name,
                gstin: item.gstin || undefined,
                phone: item.phone || undefined,
                email: item.email || undefined,
                address: item.address || undefined,
                city: item.city || undefined,
                state: item.state || undefined,
                pincode: item.pincode || undefined,
                createdBy: actor.id
              });
              createdCount++;
              break;
            }

            case 'OPENING_STOCK': {
              const item = rawItem as any;
              const batch = await this.batchRepo.create({
                organizationId,
                productId: item.productId,
                batchNumber: item.batch_number,
                expiryDate: item.expiry_date,
                purchasePricePerUnit: item.purchasePricePaise,
                mrpPerUnit: item.mrpPaise,
                salePricePerUnit: item.salePricePaise,
                initialStockQuantity: item.quantity,
                supplierId: undefined
              });

              await this.movementRepo.create({
                organizationId,
                productId: item.productId,
                batchId: batch.id,
                movementType: 'ADJUSTMENT_IN',
                quantityChange: item.quantity,
                balanceAfter: item.quantity,
                referenceType: 'OPENING_STOCK_IMPORT',
                notes: `Opening stock bulk import from file: ${fileName}`,
                createdBy: actor.id
              });
              createdCount++;
              break;
            }

            case 'BARCODES': {
              const item = rawItem as any;
              if (item.target_type === 'PRODUCT') {
                await this.productRepo.update(item.productId, organizationId, {
                  barcode: item.barcode,
                  updatedBy: actor.id
                });
                updatedCount++;
              } else if (item.target_type === 'PACKAGING' && item.packaging_unit_name) {
                const units = await this.packagingUnitRepo.findByProduct(item.productId);
                const targetUnit = units.find(
                  (u: any) => u.unitName.toLowerCase() === item.packaging_unit_name.toLowerCase()
                );
                if (targetUnit) {
                  await this.packagingUnitRepo.update(targetUnit.id, {
                    barcode: item.barcode
                  });
                  updatedCount++;
                } else {
                  rejectedCount++;
                  errors.push({ rowNumber: rowIdx, error: `Packaging unit '${item.packaging_unit_name}' not found for product.` });
                }
              }
              break;
            }

            default:
              rejectedCount++;
              errors.push({ rowNumber: rowIdx, error: `Unsupported import type: ${importType}` });
          }
        } catch (rowErr) {
          rejectedCount++;
          errors.push({ rowNumber: rowIdx, error: (rowErr as Error).message });
          if (policy === 'REJECT_ALL_ON_ERROR') {
            throw rowErr;
          }
        }
      }

      const executionTimeMs = Date.now() - startTime;

      const auditEvent = await this.auditService.logEvent({
        actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
        action: AuditAction.DATA_IMPORTED,
        resource: `import_${importType.toLowerCase()}`,
        result: AuditResult.SUCCESS,
        metadata: {
          importType,
          fileName,
          totalRows: validRows.length,
          createdCount,
          updatedCount,
          skippedCount,
          rejectedCount,
          executionTimeMs
        }
      });

      return {
        importType,
        fileName,
        totalRows: validRows.length,
        createdCount,
        updatedCount,
        skippedCount,
        rejectedCount,
        executionTimeMs,
        errors,
        auditEventId: auditEvent.id
      };
    } catch (err) {
      this.logger.error(`Bulk import failed for type ${importType}:`, err);

      await this.auditService.logEvent({
        actor: { id: actor.id, username: actor.username, role: actor.roles[0], roles: actor.roles },
        action: AuditAction.DATA_IMPORT_FAILED,
        resource: `import_${importType.toLowerCase()}`,
        result: AuditResult.FAILURE,
        metadata: {
          importType,
          fileName,
          errorMessage: (err as Error).message
        }
      });

      throw new Error(`Bulk import failed: ${(err as Error).message}`, { cause: err });
    }
  }
}
