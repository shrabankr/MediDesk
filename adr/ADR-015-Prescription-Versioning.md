# ADR-015: Versioned Prescriptions & Pharmacy Decoupling Boundary

## Status
Accepted (Phase 4)

## Context
A signed prescription is a legal medical instruction for medication dispensation.
Silent modification of a signed prescription can lead to dosage errors, adverse drug interactions, or prescription fraud.
Furthermore, Phase 4 clinical prescribing must decouple from the upcoming Phase 5 Pharmacy Master while remaining forward-compatible.

## Decision
1. **Prescription Versioning Model**:
   - Prescriptions are split into parent `prescriptions`, `prescription_versions`, and child `prescription_items`.
   - Signing locks version $v$.
   - Any modifications require creating version $v+1$ with mandatory `reason_for_change` and marking version $v$ as `SUPERSEDED`.
2. **Pharmacy Abstraction (`MedicineReference`)**:
   - Prescriptions record `medicineName`, `genericName`, `strength`, `dosageForm`, `route`, `frequency`, `durationValue`, `durationUnit`, and `instructions`.
   - No tight coupling or hardcoded foreign keys to un-migrated pharmacy tables in Phase 4.
3. **Drug Allergy Pre-Check**:
   - Creating or revising prescriptions checks patient active drug allergies and triggers `DrugAllergyWarningError` unless explicitly confirmed by the clinician.

## Consequences
- **Positive**: Complete immutable history of all signed medication orders; audit-proof revision logs; clean boundary for Phase 5 Pharmacy Master integration.
- **Negative**: Revisions require a distinct workflow compared to draft editing (clinically necessary).
