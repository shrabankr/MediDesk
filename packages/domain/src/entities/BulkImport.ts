/**
 * Bulk Data Import domain types, policies, and contracts.
 */

export type ImportType =
  | 'PATIENTS'
  | 'DOCTORS'
  | 'USERS'
  | 'MEDICINES'
  | 'PACKAGING'
  | 'SUPPLIERS'
  | 'OPENING_STOCK'
  | 'BARCODES'
  | 'APPOINTMENTS'
  | 'DEPARTMENTS'
  | 'PRICE_LISTS';

export type ImportPolicy =
  | 'REJECT_ALL_ON_ERROR'
  | 'IMPORT_VALID_ONLY'
  | 'SKIP_DUPLICATES'
  | 'UPSERT_EXISTING';

export type ImportRowStatus = 'VALID' | 'WARNING' | 'ERROR' | 'SKIPPED';

export interface ImportRowProblem {
  field: string;
  severity: 'ERROR' | 'WARNING';
  message: string;
  suggestedFix?: string;
}

export interface ImportRowValidation {
  rowNumber: number;
  status: ImportRowStatus;
  rawData: Record<string, string>;
  normalizedData?: Record<string, unknown>;
  problems: ImportRowProblem[];
}

export interface ImportValidationResult {
  importType: ImportType;
  fileName: string;
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: ImportRowValidation[];
  isSupported: boolean;
  unsupportedReason?: string;
  canProceed: boolean;
}

export interface ImportExecutionResult {
  importType: ImportType;
  fileName: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  executionTimeMs: number;
  errors: Array<{ rowNumber: number; error: string }>;
  auditEventId: string;
}

export interface ImportColumnDefinition {
  name: string;
  required: boolean;
  description: string;
  example: string;
  allowedValues?: string[];
}

export interface ImportTemplateDefinition {
  importType: ImportType;
  displayName: string;
  description: string;
  fileName: string;
  isSupported: boolean;
  unsupportedReason?: string;
  requiredPermission: string;
  columns: ImportColumnDefinition[];
}
