import { describe, it, expect } from 'vitest';
import { PrintService, PrescriptionPrintData, BillPrintData } from '@medidesk/printing';

describe('Phase 6: Printing & Document Generation Unit Tests', () => {
  const printService = new PrintService();

  it('renders clinical prescription HTML with all clinical components for A4/A5', () => {
    const rxData: PrescriptionPrintData = {
      clinicName: 'Apex PolyClinic & Diagnostics',
      clinicAddress: '104 Healthcare Blvd, Bangalore',
      clinicPhone: '+91 98888 12345',
      doctorName: 'Dr. Anand Sharma, MD',
      doctorSpecialty: 'General Physician',
      doctorRegistrationNumber: 'KMC-54321',
      patientName: 'Ramesh Gupta',
      patientNumber: 'MD-000456',
      patientAge: 45,
      patientGender: 'Male',
      visitDate: '2026-08-26',
      vitals: {
        bloodPressure: '120/80',
        pulseRate: 72,
        temperature: 98.6,
        weightKg: 70,
        bmi: 24.2
      },
      diagnoses: ['Acute Upper Respiratory Tract Infection'],
      allergies: ['No Known Drug Allergies'],
      items: [
        {
          medicineName: 'Augmentin',
          dosageForm: 'TABLET',
          strength: '625mg',
          dosageInstruction: '1 tab orally',
          frequency: '1-0-1',
          durationDays: 5,
          quantity: 10,
          specialInstructions: 'After food'
        }
      ],
      adviceNotes: 'Drink warm water and avoid cold beverages.',
      followUpDate: '2026-09-02'
    };

    const a4Html = printService.renderPrescriptionHtml(rxData, 'A4');
    expect(a4Html).toContain('Apex PolyClinic');
    expect(a4Html).toContain('Dr. Anand Sharma');
    expect(a4Html).toContain('Ramesh Gupta');
    expect(a4Html).toContain('120/80');
    expect(a4Html).toContain('Augmentin 625mg');
    expect(a4Html).toContain('1-0-1');
    expect(a4Html).toContain('Authorized Signature');

    const a5Html = printService.renderPrescriptionHtml(rxData, 'A5');
    expect(a5Html).toContain('size: A5');
  });

  it('renders standard tax invoice HTML with GST and HSN breakdown', () => {
    const billData: BillPrintData = {
      clinicName: 'Apex Health Pharmacy',
      clinicAddress: '104 Healthcare Blvd, Bangalore',
      clinicGstin: '29ABCDE1234F1Z5',
      billNumber: 'INV-2026-0042',
      billDate: '2026-08-26',
      customerName: 'Suresh Kumar',
      customerPhone: '9876543210',
      customerType: 'WALK_IN',
      items: [
        {
          brandName: 'Dolo 650',
          batchNumber: 'DL-889',
          expiryDate: '2028-12',
          hsnCode: '30049060',
          quantity: 15,
          unitPrice: 2.0,
          taxPercent: 12,
          taxAmount: 3.6,
          lineTotal: 33.6
        }
      ],
      grossAmount: 30.0,
      discountAmount: 0.0,
      taxAmount: 3.6,
      roundOffAmount: 0.4,
      netAmount: 34.0,
      paymentMode: 'UPI'
    };

    const invoiceHtml = printService.renderInvoiceHtml(billData, 'A4');
    expect(invoiceHtml).toContain('TAX INVOICE');
    expect(invoiceHtml).toContain('29ABCDE1234F1Z5');
    expect(invoiceHtml).toContain('INV-2026-0042');
    expect(invoiceHtml).toContain('Dolo 650');
    expect(invoiceHtml).toContain('DL-889');
    expect(invoiceHtml).toContain('₹34.00');
  });

  it('renders compact 80mm/58mm thermal receipt layout', () => {
    const billData: BillPrintData = {
      clinicName: 'Apex Pharmacy',
      billNumber: 'POS-1001',
      billDate: '2026-08-26',
      customerName: 'Walk-In Customer',
      customerType: 'WALK_IN',
      items: [
        {
          brandName: 'Paracetamol',
          batchNumber: 'B101',
          expiryDate: '2027-01',
          quantity: 10,
          unitPrice: 1.5,
          taxPercent: 5,
          taxAmount: 0.75,
          lineTotal: 15.75
        }
      ],
      grossAmount: 15.0,
      discountAmount: 0.0,
      taxAmount: 0.75,
      roundOffAmount: 0.25,
      netAmount: 16.0,
      paymentMode: 'CASH'
    };

    const thermalHtml = printService.renderReceiptHtml(billData, '80mm');
    expect(thermalHtml).toContain('Apex Pharmacy');
    expect(thermalHtml).toContain('POS-1001');
    expect(thermalHtml).toContain('NET TOTAL');
    expect(thermalHtml).toContain('Thank you! Get Well Soon.');
  });
});
