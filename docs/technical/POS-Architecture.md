# Point of Sale (POS) & Pharmacy Billing Architecture

## Overview
The Pharmacy Point of Sale (POS) subsystem is optimized for rapid checkout in small medical retail stores and clinic dispensaries.

## Features & Subsystem Design

### 1. Optical Barcode & Keyboard Navigation
- Standard USB/Bluetooth barcode scanners operating in HID keyboard wedge mode stream barcode characters directly into the input buffer.
- Real-time indexing against `medicine_products(barcode)` resolves matching SKUs locally with 0ms network latency.

### 2. FEFO Batch Selection
- Products with multiple active batches automatically suggest the batch with the earliest valid expiry date (`expiry_date ASC, created_at ASC`).
- Expired batches ($\text{expiry\_date} < \text{current\_date}$) are excluded at the database and application levels.
- Staff can manually select alternate valid batches if physical packaging dictates.

### 3. Walk-In vs Patient Distinction
- `WALK_IN`: Records customer name and contact phone on the sale bill without creating a clinical patient record.
- `PATIENT`: Links directly to `patients.id` and allows importing active prescriptions from Phase 4 clinical visits.

### 4. Deterministic Financial & GST Computation
- Gross Amount: $\sum (\text{Quantity} \times \text{Unit Sale Price})$
- Line Discount / Bill Discount: Applied before tax computation.
- GST Calculation: Tax is calculated per line item based on the configured GST slab percentage (0%, 5%, 12%, 18%, 28%).
- Cash Round-Off: Net amount is rounded to the nearest integer rupee for cash transactions.

### 5. Returns & Stock Restoration
- Returns reference the original `sale_id` and specific `sale_items`.
- Returned units restore available batch quantity and write a `SALE_RETURN` movement into the stock ledger.
