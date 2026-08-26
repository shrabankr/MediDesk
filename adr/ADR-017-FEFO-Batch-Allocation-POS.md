# ADR-017: FEFO Batch Allocation & Pharmacy POS Architecture

## Status
Accepted (Phase 5)

## Context
Dispensing expired medication violates Indian Drugs & Cosmetics Act regulations. Additionally, pharmacy shops need fast, keyboard-driven point-of-sale checkout where available stock with the earliest expiry is automatically allocated to minimize batch wastage. Furthermore, pharmacy customers include both registered clinic patients and non-patient walk-in buyers.

## Decision
1. **First Expire, First Out (FEFO)**:
   - When dispensing or querying available product stock, batches are strictly ordered by `expiry_date ASC, created_at ASC`.
   - The domain and repository layer strictly filter out batches where $\text{expiry\_date} < \text{current\_date}$ or $\text{current\_stock\_quantity} = 0$.
   - Selling expired stock is impossible at the database and application service layer (throws `ExpiredBatchSaleError`).
2. **Walk-In vs Registered Patient Distinction**:
   - The POS supports two distinct sale modes: `WALK_IN` and `PATIENT`.
   - A walk-in sale requires customer name and phone without creating a patient database record.
   - A patient sale links to `patient_id` and can import prescription items directly from Phase 4 clinical prescriptions.
3. **GST Calculation & Round-off**:
   - Standard Indian GST slabs (0%, 5%, 12%, 18%, 28%) are configured per product SKU.
   - Total taxable amount, CGST/SGST splitting, bill-level discount, and cash round-off are computed deterministically.

## Consequences
- **Positive**: Complies with statutory expiry laws, minimizes inventory write-offs, provides fast POS workflow for staff.
