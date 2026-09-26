import { z } from 'zod';

export const ImportTypeSchema = z.enum([
  'PATIENTS',
  'DOCTORS',
  'USERS',
  'MEDICINES',
  'PACKAGING',
  'SUPPLIERS',
  'OPENING_STOCK',
  'BARCODES',
  'APPOINTMENTS',
  'DEPARTMENTS',
  'PRICE_LISTS'
]);

export const ImportPolicySchema = z.enum([
  'REJECT_ALL_ON_ERROR',
  'IMPORT_VALID_ONLY',
  'SKIP_DUPLICATES',
  'UPSERT_EXISTING'
]);

// GSTIN Regex: 2 digits (state) + 5 letters (PAN) + 4 digits + 1 letter + 1 char + Z + 1 char
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
export const PHONE_REGEX = /^(\+91[-\s]?)?[0]?(91)?[6789]\d{9}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 1. Patient Import Schema
export const PatientImportRowSchema = z.object({
  patient_external_id: z.string().trim().optional(),
  first_name: z.string().trim().min(1, 'First name is required'),
  middle_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  date_of_birth: z.string().trim().regex(DATE_REGEX, 'Date of birth must be in YYYY-MM-DD format').optional().or(z.literal('')),
  age: z.coerce.number().int().min(0).max(130).optional(),
  gender: z.string().trim().toUpperCase().refine((val) => ['MALE', 'FEMALE', 'OTHER', 'M', 'F', 'O'].includes(val), {
    message: 'Gender must be MALE, FEMALE, or OTHER'
  }),
  phone: z.string().trim().optional().or(z.literal('')),
  alternate_phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  blood_group: z.string().trim().optional(),
  allergies: z.string().trim().optional()
});

// 2. Doctor Import Schema
export const DoctorImportRowSchema = z.object({
  name: z.string().trim().min(2, 'Doctor name must be at least 2 characters'),
  registration_number: z.string().trim().optional(),
  specialization: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  consultation_fee: z.coerce.number().min(0, 'Consultation fee cannot be negative').optional(),
  status: z.string().trim().toUpperCase().refine((val) => ['ACTIVE', 'INACTIVE'].includes(val), {
    message: 'Status must be ACTIVE or INACTIVE'
  }).optional()
});

// 3. User Import Schema (Staff / Operational users)
export const UserImportRowSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
  full_name: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().email('Invalid email address'),
  role: z.string().trim().toUpperCase().refine((val) => ['DOCTOR', 'STAFF'].includes(val), {
    message: 'Role must be DOCTOR or STAFF (OWNER creation prohibited via CSV)'
  }),
  phone: z.string().trim().optional()
});

// 4. Medicine Master Import Schema
export const MedicineImportRowSchema = z.object({
  generic_name: z.string().trim().min(1, 'Generic name is required'),
  brand_name: z.string().trim().min(1, 'Brand name is required'),
  strength: z.string().trim().optional(),
  dosage_form: z.string().trim().toUpperCase().refine(
    (val) => ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'OINTMENT', 'CREAM', 'GEL', 'INHALER', 'POWDER', 'LOTION', 'OTHER'].includes(val),
    { message: 'Dosage form must be TABLET, CAPSULE, SYRUP, INJECTION, DROPS, OINTMENT, etc.' }
  ),
  manufacturer: z.string().trim().optional(),
  category: z.string().trim().toUpperCase().refine((val) => ['GENERAL', 'H', 'H1', 'X'].includes(val), {
    message: 'Schedule category must be GENERAL, H, H1, or X'
  }).optional(),
  barcode: z.string().trim().optional(),
  hsn_code: z.string().trim().optional(),
  gst_rate: z.coerce.number().min(0).max(100, 'GST rate must be between 0% and 100%').optional(),
  mrp: z.coerce.number().min(0, 'MRP must be greater than or equal to 0'),
  selling_price: z.coerce.number().min(0, 'Selling price must be greater than or equal to 0').optional(),
  reorder_level: z.coerce.number().int().min(0, 'Reorder level must be >= 0').optional(),
  pack_size: z.string().trim().optional(),
  pack_quantity: z.coerce.number().int().min(1, 'Pack quantity must be at least 1').optional()
});

// 5. Packaging Import Schema
export const PackagingImportRowSchema = z.object({
  medicine_name: z.string().trim().min(1, 'Medicine / Product brand name is required'),
  unit_name: z.string().trim().min(1, 'Packaging unit name is required (e.g. Strip, Box)'),
  conversion_factor: z.coerce.number().int().min(1, 'Conversion factor must be an integer >= 1'),
  sale_price: z.coerce.number().min(0, 'Sale price cannot be negative').optional(),
  mrp: z.coerce.number().min(0, 'MRP cannot be negative').optional(),
  barcode: z.string().trim().optional()
});

// 6. Supplier Import Schema
export const SupplierImportRowSchema = z.object({
  supplier_name: z.string().trim().min(2, 'Supplier name is required'),
  gstin: z.string().trim().toUpperCase().refine((val) => !val || GSTIN_REGEX.test(val), {
    message: 'Invalid 15-character GSTIN format'
  }).optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  pincode: z.string().trim().optional()
});

// 7. Opening Stock Import Schema (HIGH RISK)
export const OpeningStockImportRowSchema = z.object({
  medicine_name: z.string().trim().min(1, 'Medicine / Product brand name is required'),
  batch_number: z.string().trim().min(1, 'Batch number is required'),
  expiry_date: z.string().trim().regex(DATE_REGEX, 'Expiry date must be in YYYY-MM-DD format'),
  quantity: z.coerce.number().int().min(1, 'Opening stock quantity must be at least 1 base unit'),
  purchase_price: z.coerce.number().min(0, 'Purchase price cannot be negative'),
  mrp: z.coerce.number().min(0, 'MRP cannot be negative'),
  sale_price: z.coerce.number().min(0, 'Sale price cannot be negative').optional(),
  supplier_name: z.string().trim().optional(),
  received_date: z.string().trim().regex(DATE_REGEX, 'Received date must be in YYYY-MM-DD format').optional().or(z.literal(''))
});

// 8. Barcode Import Schema
export const BarcodeImportRowSchema = z.object({
  barcode: z.string().trim().min(3, 'Barcode must be at least 3 characters').max(50, 'Barcode max 50 chars'),
  target_type: z.string().trim().toUpperCase().refine((val) => ['PRODUCT', 'PACKAGING'].includes(val), {
    message: 'Target type must be PRODUCT or PACKAGING'
  }),
  medicine_name: z.string().trim().min(1, 'Medicine / Brand name is required'),
  packaging_unit_name: z.string().trim().optional()
});

// Validation and Execution Envelope Schemas
export const ValidateImportFileSchema = z.object({
  importType: ImportTypeSchema,
  fileName: z.string().trim().min(1, 'File name is required'),
  fileContent: z.string().min(1, 'File content cannot be empty'),
  organizationId: z.string().uuid('Invalid organization ID')
});

export const ExecuteImportSchema = z.object({
  importType: ImportTypeSchema,
  fileName: z.string().trim().min(1, 'File name is required'),
  policy: ImportPolicySchema,
  validRows: z.array(z.record(z.unknown())),
  organizationId: z.string().uuid('Invalid organization ID')
});

export type ValidateImportFileInput = z.infer<typeof ValidateImportFileSchema>;
export type ExecuteImportInput = z.infer<typeof ExecuteImportSchema>;
