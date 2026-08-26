# ADR-025: Entity-Specific Non-Destructive Corrections & Financial Reversals

## Status
Accepted (Phase 8)

## Context
Healthcare and pharmacy applications require non-destructive auditability. Applying a single generic "Undo" mechanism risks violating domain invariants, data integrity, and compliance standards.

## Decision
1. **Three-Tier Non-Destructive Classification:**
   - `DRAFT`: Pre-finalization state (OPD consultation in progress, unbilled cart). Editable and cancelable without audit trail.
   - `CORRECTION`: Post-finalization amendment (e.g. `ClinicalCorrection` with prior/new JSON diff, signed prescription revision `v2`). Original immutable record preserved.
   - `REVERSAL`: Financial/inventory compensatory transactions (e.g. `SaleReturn` generating a credit note and returning base units to stock ledger).
2. **Domain-Specific Lifecycle Matrix:** Each entity (Patients, Doctors, Appointments, Consultations, Prescriptions, Purchases, Sales, Adjustments) defines explicit lifecycle operations rather than generic delete/undo.
3. **Immutable History:** Finalized clinical consultations, stock movements, and financial invoices are never deleted or modified in-place.

## Consequences
- Full compliance with medical record keeping and financial tax accounting standards.
- Auditable lineage for every clinical amendment and inventory balance movement.
