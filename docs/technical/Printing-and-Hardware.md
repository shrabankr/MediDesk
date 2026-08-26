# Technical Architecture: Printing & Hardware Subsystem

## Overview
The `@medidesk/printing` package provides hardware-decoupled document rendering and printing workflows for MediDesk workstations. It separates visual layout formatting (HTML/CSS) from underlying OS printer spooling.

## Supported Document Templates

### 1. Clinical Prescription (A4 / A5)
- **Header**: Clinic name, address, telephone, license numbers.
- **Doctor Identification**: Full name, qualifications (MD, MBBS), specialization, state medical council registration number.
- **Patient Identification**: Full name, age, gender, patient ID (`MD-XXXXXX`), visit timestamp.
- **Clinical Summary**: Vitals (BP, Pulse, Temp, Weight, BMI), recorded diagnoses, allergy alerts (`KNOWN`, `DENIED`, `UNKNOWN`).
- **Rx Medication Table**: Drug name, dosage form (TABLET, SYRUP, etc.), strength, frequency (`1-0-1`), duration (days), total quantity, specific timing instructions (e.g. *After food*).
- **Clinical Instructions**: Advice notes and scheduled follow-up dates.
- **Doctor Signature Area**: Formal signature line with doctor credentials.

### 2. Standard Tax Invoice (A4 / A5)
- **Header**: Clinic / Pharmacy trade name, clinic address, GSTIN, DL number.
- **Invoice Metadata**: Sequential invoice number, invoice date, patient/customer name, payment mode.
- **Line Items**: Product brand name, manufacturer, HSN code, batch number, expiry date (`MM/YYYY`), quantity, MRP/unit rate, GST % rate, tax amount, and net line total.
- **Tax Breakdown**: CGST & SGST split breakdown by tax rate bracket.
- **Rounding & Grand Total**: Net payable amount with rounding.

### 3. POS Thermal Checkout Receipt (80mm / 58mm ESC/POS)
- Compact, high-density layout optimized for 80mm and 58mm direct thermal receipt printers.
- Center-aligned headers, itemized totals, GST summary, payment method, and "Get Well Soon" footer message.

## Workstation Printer Configuration
Workstation preferences are stored in the SQLite `printer_configurations` table per user/workstation:
- `prescription_printer_name`: System printer name for prescriptions.
- `prescription_page_size`: `A4` or `A5`.
- `receipt_printer_name`: Dedicated ESC/POS thermal printer.
- `receipt_page_size`: `80mm` or `58mm`.
- `silent_printing`: Boolean flag for bypassing OS print dialog in high-throughput pharmacy environments.
