import { describe, it, expect } from 'vitest';
import { CsvParser } from '@medidesk/application';

describe('Searchable Select, Column Mapping & Export Tests', () => {
  describe('Column Mapping Auto-Detection', () => {
    const targetFields = [
      { name: 'generic_name', required: true },
      { name: 'brand_name', required: true },
      { name: 'strength', required: false },
      { name: 'dosage_form', required: true },
      { name: 'mrp', required: true },
      { name: 'hsn_code', required: false }
    ];

    it('should accurately auto-map user spreadsheet headers with different casing and spacing', () => {
      const userHeaders = ['Generic Name', 'Brand', 'Strength (mg)', 'Dosage Form', 'MRP (INR)', 'HSN Code'];

      const mapping: Record<string, string> = {};
      for (const target of targetFields) {
        const normalizedTarget = target.name.toLowerCase().replace(/[\s_-]/g, '');
        const match = userHeaders.find((h) => {
          const normalizedUser = h.toLowerCase().replace(/[\s_-]/g, '');
          return normalizedUser === normalizedTarget || normalizedUser.includes(normalizedTarget) || normalizedTarget.includes(normalizedUser);
        });
        if (match) {
          mapping[target.name] = match;
        }
      }

      expect(mapping.generic_name).toBe('Generic Name');
      expect(mapping.dosage_form).toBe('Dosage Form');
      expect(mapping.hsn_code).toBe('HSN Code');
    });

    it('should detect when required fields are missing from mapping', () => {
      const incompleteMapping = {
        generic_name: 'Generic',
        strength: '500mg'
      };

      const missingRequired = targetFields.filter((c) => c.required && !incompleteMapping[c.name as keyof typeof incompleteMapping]);
      expect(missingRequired.length).toBe(3); // brand_name, dosage_form, mrp
      expect(missingRequired.map((m) => m.name)).toContain('brand_name');
    });
  });

  describe('CSV & JSON Export Generators', () => {
    const samplePatients = [
      {
        patientNumber: 'MD-000001',
        fullName: 'Rahul Sharma',
        sex: 'MALE',
        age: 34,
        mobile: '9876543210',
        address: '123 MG Road, Bengaluru'
      },
      {
        patientNumber: 'MD-000002',
        fullName: 'Pooja "Special" Patel',
        sex: 'FEMALE',
        age: 29,
        mobile: '9876543211',
        address: '456 Ring Road, Ahmedabad'
      }
    ];

    it('should generate properly escaped RFC 4180 CSV export content', () => {
      const columns = [
        { key: 'patientNumber', header: 'Patient ID' },
        { key: 'fullName', header: 'Full Name' },
        { key: 'mobile', header: 'Mobile Number' },
        { key: 'address', header: 'Address' }
      ];

      const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
      const rows = samplePatients.map((row) =>
        columns
          .map((c) => {
            const val = row[c.key as keyof typeof row];
            const strVal = val === undefined || val === null ? '' : String(val);
            return `"${strVal.replace(/"/g, '""')}"`;
          })
          .join(',')
      );
      const csv = [headers, ...rows].join('\r\n');

      expect(csv).toContain('"Patient ID","Full Name","Mobile Number","Address"');
      expect(csv).toContain('"MD-000001","Rahul Sharma","9876543210","123 MG Road, Bengaluru"');
      expect(csv).toContain('"MD-000002","Pooja ""Special"" Patel","9876543211","456 Ring Road, Ahmedabad"');
    });

    it('should parse back exported CSV with CsvParser without data corruption', () => {
      const headers = ['id', 'name', 'notes'];
      const data = [
        { id: '1', name: 'Dolo 650', notes: 'Contains, commas and "quotes"' }
      ];

      const csvString = CsvParser.stringify(headers, data);
      const parsed = CsvParser.parse(csvString);

      expect(parsed.rows.length).toBe(1);
      expect(parsed.rows[0].data.name).toBe('Dolo 650');
      expect(parsed.rows[0].data.notes).toBe('Contains, commas and "quotes"');
    });
  });
});
