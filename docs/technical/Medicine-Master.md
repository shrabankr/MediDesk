# Medicine Master & Product Variant Architecture

## Overview
The Medicine Master module manages pharmaceutical data with strict separation between generic molecules and commercial brand variants (SKUs).

## Domain Model & Separation

1. **Generic Chemical Entity (`medicines`)**:
   - `id`: Unique surrogate key (UUID).
   - `generic_name`: Chemical molecule name (e.g., *Paracetamol*, *Amoxicillin + Clavulanic Acid*).
   - `therapeutic_class`: Classification (e.g., *Analgesic / Antipyretic*).
   - `schedule_category`: Regulatory drug schedule (`GENERAL`, `H`, `H1`, `X`).
   - `is_prescription_required`: Boolean flag for dispensing regulations.
   - `storage_instructions`: Storage guidelines (e.g., *Store below 25°C*).

2. **Manufacturer (`manufacturers`)**:
   - `id`: Unique surrogate key.
   - `name`: Pharmaceutical manufacturer (e.g., *Micro Labs Ltd*, *Cipla*).
   - `code`: Manufacturer reference code.
   - `country`: Country of origin.

3. **Commercial Product Variant SKU (`medicine_products`)**:
   - `id`: Unique surrogate key.
   - `medicine_id`: Foreign key referencing generic molecule.
   - `manufacturer_id`: Foreign key referencing manufacturer.
   - `brand_name`: Trade name (e.g., *Dolo 650*, *Augmentin 625 Duo*).
   - `strength`: Dose specification (e.g., *650mg*, *625mg*).
   - `dosage_form`: Form (`TABLET`, `CAPSULE`, `SYRUP`, `INJECTION`, `DROPS`, `OINTMENT`, `INHALER`, `OTHER`).
   - `pack_size`: Pack display label (e.g., *15 Tablets / Strip*).
   - `pack_quantity`: Number of base units per commercial pack (e.g., 15).
   - `barcode`: EAN/UPC barcode string for physical optical scanners.
   - `hsn_code`: Indian Harmonized System of Nomenclature code (e.g., `30049060`).
   - `tax_rate_percent`: Applicable GST rate (e.g., 12.0%).
   - `min_stock_level`: Reorder trigger threshold.

## Identity & Immutability Rules
- The medicine name is **never** used as a primary key.
- Soft-deletion/deactivation via `is_active = 0` prevents breaking historical purchase invoices, sales bills, or audit logs.
