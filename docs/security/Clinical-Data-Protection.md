# MediDesk Clinical Data Protection & Privacy Policy

## 1. Zero External AI / Data Leakage Policy
MediDesk operates on a 100% offline-first local workstation model:
- Zero data is transmitted to external AI endpoints or cloud LLMs.
- Zero clinical diagnoses or prescriptions are generated autonomously.
- The clinician maintains exclusive authoring and signing control.

## 2. Developer Access Boundary
By default, the `DEVELOPER` role possesses:
- `SYSTEM_DIAGNOSTICS`, `SYSTEM_CONFIG_READ`, `SYSTEM_CONFIG_UPDATE`, `SYSTEM_MIGRATE`, `SYSTEM_BACKUP_LOCAL`.
- Explicitly **ZERO** clinical permissions (`clinical.*`, `vitals.*`, `diagnosis.*`, `history.*`, `allergy.*`, `prescription.*`, `followup.*`).
- Invariant: Developers cannot query, view, or export patient clinical encounters or medical history under standard diagnostic workflows.

## 3. Multi-Tenant Scoping
All queries across `clinical_visits`, `vitals`, `allergies`, `medical_history`, `diagnoses`, `prescriptions`, and `follow_ups` enforce `organization_id = ?` filtering at the SQLite repository query boundary with foreign key `ON DELETE RESTRICT`.

## 4. Immutability & Audit Integrity
- Modifications to signed prescriptions or completed visits require mandatory documented justifications and generate append-only audit events.
- All actions are logged to `audit_events` with actor attribution and synthetic resource IDs.
