# ADR-014: Clinical Encounters, Telemetry Vitals & Audited Corrections

## Status
Accepted (Phase 4)

## Context
In outpatient medical clinics across India, clinical consultation records represent sensitive legal and medical data. Clinical errors, silent overwrites, or ambiguous allergy statuses pose direct threats to patient safety and clinical integrity.
MediDesk must support rapid consultation note intake while strictly enforcing the following invariants:
1. **Safety Boundary**: The software acts strictly as a data-recording instrument for clinician-provided information. It never autonomously diagnoses, prescribes, or sends clinical data to external AI/cloud services.
2. **Clinical Immutability**: Completed encounters cannot be modified directly. Post-completion edits require an audited correction workflow capturing a mandatory reason and prior/posterior snapshot state.
3. **Explicit Allergy States**: Allergies must distinguish `KNOWN`, `DENIED` (NKDA), and `UNKNOWN` (not assessed) to prevent false assumptions of safety.
4. **Explicit Telemetry Units**: Vitals must capture explicit temperature units (°C or °F) and standard metric units.

## Decision
1. Implemented `ClinicalVisit` lifecycle with explicit transitions: `OPEN` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` / `CANCELLED`.
2. Implemented `clinical_corrections` table capturing complete JSON snapshots and mandatory rationale for revisions to completed encounters.
3. Structured `vitals`, `allergies`, `medical_history`, `diagnoses`, and `follow_ups` with foreign keys tied to `patients` and `organizations` (`ON DELETE RESTRICT`).
4. Enforced strict RBAC: Default denial for `DEVELOPER` role on all clinical records.

## Consequences
- **Positive**: Complete legal defensibility and audit trail; zero data ambiguity; strong safety guardrails.
- **Negative**: Extra step required when correcting a completed visit (justified by regulatory compliance and patient safety).
