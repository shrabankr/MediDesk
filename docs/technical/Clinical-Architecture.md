# MediDesk Clinical Architecture & Record Lifecycle (Phase 4)

## 1. Overview
The Phase 4 Clinical Module provides high-safety consultation documentation, vitals telemetry tracking, allergy alerts, diagnosis cataloging, versioned prescriptions, and follow-up management.

## 2. Clinical Visit State Machine
```
   [START]
      │
      ▼
   ( OPEN ) ──────────► ( CANCELLED )
      │                     ▲
      ▼                     │
( IN_PROGRESS ) ────────────┘
      │
      ▼
 ( COMPLETED ) [LOCKED]
      │
      ▼
 [ Audited Clinical Correction ]
```

- **OPEN**: Encounter initialized; pre-consultation vitals may be recorded.
- **IN_PROGRESS**: Doctor is consulting, examining, and taking notes.
- **COMPLETED**: Consultation finalized. All notes are locked. Silent edits are strictly rejected.
- **CANCELLED**: Encounter terminated without completion.
- **Audited Correction**: Modifying a completed encounter requires submitting a `ClinicalCorrection` recording the prior state, corrected state, author, and reason.

## 3. Telemetry Vitals & Explicit Units
All vitals record explicit units:
- Temperature: Numeric value with `CELSIUS` or `FAHRENHEIT`.
- Blood Pressure: Systolic and Diastolic in `mmHg`.
- Pulse Rate: `bpm`.
- Respiratory Rate: `breaths/min`.
- Oxygen Saturation: `SpO2 %`.
- Weight & Height: `kg` and `cm` $\rightarrow$ calculated BMI `kg/m^2`.

## 4. Allergy Safety Triad
The system strictly enforces 3 distinct states:
1. `KNOWN`: Verified active allergen, category (DRUG/FOOD/ENV/OTHER), severity, and reaction.
2. `DENIED`: Verified "No Known Drug Allergies" (NKDA).
3. `UNKNOWN`: Not assessed (prominently alerts the clinician in amber).
