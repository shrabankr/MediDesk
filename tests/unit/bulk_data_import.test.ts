import { describe, it, expect } from 'vitest';
import { CsvParser } from '@medidesk/application';
import {
  PatientImportRowSchema,
  DoctorImportRowSchema,
  UserImportRowSchema,
  MedicineImportRowSchema,
  PackagingImportRowSchema,
  SupplierImportRowSchema,
  OpeningStockImportRowSchema,
  BarcodeImportRowSchema
} from '@medidesk/validation';

describe('Bulk Data Import Unit Tests', () => {
  describe('CsvParser & Injection Defense', () => {
    it('should parse standard CSV content correctly', () => {
      const csv = 'first_name,last_name,gender\nRahul,Sharma,MALE\nPooja,Patel,FEMALE';
      const parsed = CsvParser.parse(csv);

      expect(parsed.headers).toEqual(['first_name', 'last_name', 'gender']);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].data.first_name).toBe('Rahul');
      expect(parsed.rows[0].data.last_name).toBe('Sharma');
      expect(parsed.rows[0].data.gender).toBe('MALE');
      expect(parsed.rows[1].data.first_name).toBe('Pooja');
    });

    it('should handle quoted fields containing commas, quotes, and newlines', () => {
      const csv = 'medicine_name,description\n"Dolo 650mg","Contains, Paracetamol"\n"Syrup","Line 1\nLine 2"\n"Quoted","Item ""Special"""';
      const parsed = CsvParser.parse(csv);

      expect(parsed.rows.length).toBe(3);
      expect(parsed.rows[0].data.description).toBe('Contains, Paracetamol');
      expect(parsed.rows[1].data.description).toBe('Line 1\nLine 2');
      expect(parsed.rows[2].data.description).toBe('Item "Special"');
    });

    it('should strip UTF-8 BOM if present', () => {
      const csvWithBom = '\uFEFFfirst_name,last_name\nRahul,Sharma';
      const parsed = CsvParser.parse(csvWithBom);

      expect(parsed.headers[0]).toBe('first_name');
      expect(parsed.rows[0].data.first_name).toBe('Rahul');
    });

    it('should defend against CSV formula injection characters (=, +, @, etc.)', () => {
      const maliciousCsv = 'name,notes\n"=1+1","+CMD"\n"@SUM(1,2)","\tMALICIOUS"';
      const parsed = CsvParser.parse(maliciousCsv);

      expect(parsed.rows[0].data.name).toBe('1+1');
      expect(parsed.rows[0].data.notes).toBe('CMD');
      expect(parsed.rows[1].data.name).toBe('SUM(1,2)');
      expect(parsed.rows[1].data.notes).toBe('MALICIOUS');
    });

    it('should stringify data rows into compliant CSV format', () => {
      const headers = ['name', 'price', 'notes'];
      const data = [{ name: 'Paracetamol', price: '30.50', notes: 'Standard, 10 tablets' }];
      const output = CsvParser.stringify(headers, data);

      expect(output).toContain('name,price,notes');
      expect(output).toContain('Paracetamol,30.50,"Standard, 10 tablets"');
    });
  });

  describe('Import Row Schemas Validation', () => {
    it('should validate valid patient row and normalize gender', () => {
      const row = {
        first_name: 'Amit',
        last_name: 'Verma',
        gender: 'MALE',
        date_of_birth: '1988-12-25',
        phone: '9876543210'
      };
      const result = PatientImportRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it('should reject patient row with missing first_name or invalid gender', () => {
      const row = {
        first_name: '',
        gender: 'UNKNOWN'
      };
      const result = PatientImportRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    });

    it('should validate valid medicine row with integer-Paise compatible numbers', () => {
      const row = {
        generic_name: 'Paracetamol',
        brand_name: 'Dolo 650mg Tablet',
        dosage_form: 'TABLET',
        mrp: '30.50',
        selling_price: '28.00',
        gst_rate: '12'
      };
      const result = MedicineImportRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Math.round(result.data.mrp * 100)).toBe(3050);
      }
    });

    it('should reject invalid medicine dosage forms or negative MRP', () => {
      const row = {
        generic_name: 'Paracetamol',
        brand_name: 'Dolo',
        dosage_form: 'INVALID_FORM',
        mrp: '-10'
      };
      const result = MedicineImportRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    });

    it('should validate packaging unit with integer conversion factor >= 1', () => {
      const row = {
        medicine_name: 'Dolo 650mg Tablet',
        unit_name: 'Strip',
        conversion_factor: '15',
        sale_price: '28.00',
        mrp: '30.50'
      };
      const result = PackagingImportRowSchema.safeParse(row);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conversion_factor).toBe(15);
      }
    });

    it('should reject packaging unit with conversion factor < 1', () => {
      const row = {
        medicine_name: 'Dolo 650mg Tablet',
        unit_name: 'Strip',
        conversion_factor: '0'
      };
      const result = PackagingImportRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    });

    it('should validate supplier row with valid 15-digit Indian GSTIN', () => {
      const row = {
        supplier_name: 'Evergreen Pharma',
        gstin: '29ABCDE1234F1Z5',
        phone: '080-23456789'
      };
      const result = SupplierImportRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it('should reject supplier row with invalid GSTIN', () => {
      const row = {
        supplier_name: 'Evergreen Pharma',
        gstin: 'INVALID_GSTIN_123'
      };
      const result = SupplierImportRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    });

    it('should validate opening stock row with positive quantity and future expiry date format', () => {
      const row = {
        medicine_name: 'Dolo 650mg Tablet',
        batch_number: 'DL65-2026',
        expiry_date: '2028-12-31',
        quantity: '300',
        purchase_price: '1.50',
        mrp: '2.03'
      };
      const result = OpeningStockImportRowSchema.safeParse(row);
      expect(result.success).toBe(true);
    });

    it('should reject opening stock with negative purchase price or quantity <= 0', () => {
      const row = {
        medicine_name: 'Dolo 650mg Tablet',
        batch_number: 'DL65',
        expiry_date: '2028-12-31',
        quantity: '0',
        purchase_price: '-5',
        mrp: '10'
      };
      const result = OpeningStockImportRowSchema.safeParse(row);
      expect(result.success).toBe(false);
    });

    it('should validate user row rejecting OWNER creation via CSV', () => {
      const staffRow = {
        username: 'reception_priya',
        full_name: 'Priya Nair',
        email: 'priya@clinic.com',
        role: 'STAFF'
      };
      expect(UserImportRowSchema.safeParse(staffRow).success).toBe(true);

      const ownerRow = {
        username: 'fake_owner',
        full_name: 'Hacker',
        email: 'hacker@clinic.com',
        role: 'OWNER'
      };
      expect(UserImportRowSchema.safeParse(ownerRow).success).toBe(false);
    });

    it('should validate doctor row and default optional values', () => {
      const doctorRow = {
        name: 'Dr. Ananya Roy',
        registration_number: 'KMC-54321',
        specialization: 'General Medicine',
        consultation_fee: '500'
      };
      const result = DoctorImportRowSchema.safeParse(doctorRow);
      expect(result.success).toBe(true);
    });

    it('should validate barcode rows for products and packaging', () => {
      const productBarcode = {
        barcode: '8901234567890',
        target_type: 'PRODUCT',
        medicine_name: 'Dolo 650mg Tablet'
      };
      expect(BarcodeImportRowSchema.safeParse(productBarcode).success).toBe(true);

      const packagingBarcode = {
        barcode: '8901234567891',
        target_type: 'PACKAGING',
        medicine_name: 'Dolo 650mg Tablet',
        packaging_unit_name: 'Strip'
      };
      expect(BarcodeImportRowSchema.safeParse(packagingBarcode).success).toBe(true);
    });
  });
});
