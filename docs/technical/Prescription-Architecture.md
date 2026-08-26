# MediDesk Prescription Versioning & Pharmacy Decoupling Architecture

## 1. Overview
Prescriptions are legal medication orders. Phase 4 provides versioned prescription authoring while preparing a clean decoupling interface for the Phase 5 Pharmacy Master.

## 2. Prescription State Machine
```
   [DRAFT] ──────► [CANCELLED]
      │
      ▼
   [SIGNED] ──(Revision)──► [SUPERSEDED]
      │                          │
      └──────────────────────────┴─► [New Version ACTIVE / SIGNED]
```

## 3. Entity Relationships
- **`prescriptions`**: Master prescription record linking patient, doctor, clinical visit, status, and current active version number.
- **`prescription_versions`**: Version container capturing version number, status (`ACTIVE`, `SUPERSEDED`, `CANCELLED`), reason for revision, and creation metadata.
- **`prescription_items`**: Line items containing `medicineName`, `genericName`, `strength`, `dosageForm`, `route`, `frequency`, `durationValue`, `durationUnit`, `instructions`, `quantity`, and `isSubstitutionAllowed`.

## 4. Pharmacy Decoupling (`MedicineReference`)
Prescription items adhere to the `MedicineReference` interface. When Phase 5 introduces the Pharmacy & Inventory module, medicine items will reference the Pharmacy Master catalogue without requiring data migrations on historical Phase 4 prescription records.
