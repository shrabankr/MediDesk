# MediDesk Phase Workflow & Governance Rules

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS:**  
> **PHASE COMPLETION DOES NOT AUTHORIZE THE NEXT PHASE.**  
> Never infer approval from a successful build, passing tests, a user viewing the result, or an implementation request that belongs to a later phase.  
> Before starting any new phase, the user must provide explicit, written approval.

---

## 1. Phase Progression Lifecycle

Every development phase follows this strict linear lifecycle:

```
[ Phase N Proposed ]
        │
        ▼
1. Research & Planning ──► Produce detailed implementation plan
        │
        ▼
2. User Review & Approval ──► STOP & WAIT for explicit user approval
        │
        ▼
3. Implementation ──► Clean domain/app/db/ui/ipc code changes
        │
        ▼
4. Testing & Security Review ──► Unit, integration, security test coverage
        │
        ▼
5. Documentation & ADRs ──► Update technical guides and add ADRs
        │
        ▼
6. Full Verification ──► Run typecheck, lint, test, build
        │
        ▼
7. Verification Report ──► Present comprehensive summary to user
        │
        ▼
8. STOP & FREEZE ──► Phase N is FROZEN. Do NOT start Phase N+1.
```

---

## 2. Phase Status Register

| Phase | Title | Status | Approval & Invariants |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation Architecture, Electron Security, SQLite & RBAC | **APPROVED & FROZEN** | Context isolation, WAL mode, migrations, Scrypt hashing, Developer isolation. |
| **Phase 2** | System Setup Wizard, Authentication & User Management | **APPROVED & FROZEN** | First-run setup, 24-hr session tokens, password resets, last-owner protection. |
| **Phase 3** | Patient Demographics, Doctor Directory & Appointments | **APPROVED & FROZEN** | Patient duplicate matching, doctor schedules, 15-min queue slots, conflict prevention. |
| **Phase 4** | Clinical Consultations, EHR Records & Digital Prescriptions | **APPROVED & FROZEN** | Append-only clinical notes, signed Rx versioning, vitals, allergies, ICD-10 diagnoses. |
| **Phase 5** | Pharmacy Master, Inventory Batches, FEFO Sales & POS Billing | **APPROVED & FROZEN** | FEFO batch allocation, atomic stock deduction, GST calculations, thermal receipts. |
| **Phase 6** | Hardware Printing, Offline Licensing & Hybrid Backup | **APPROVED & FROZEN** | Native print configs, 60-day trial, Ed25519 licensing, AES-GCM Hybrid Google Drive backup. |
| **Phase 7** | LAN / Multi-Computer Workstation Architecture | **APPROVED & FROZEN** | Zero-trust TLS, 6-digit pairing PIN, HMAC request signing, serialized POS write mutex. |
| **Phase 8** | Planned Future Phase | **NOT STARTED / LOCKED** | **STRICT STOP:** Must not be designed or coded without explicit user directive. |

---

## 3. Strict Rules on User Authorization

1. **Explicit Phase Approval Required:** An AI agent must never transition from Phase N to Phase N+1 without an explicit user prompt directing the start of Phase N+1.
2. **No Speculative Coding:** Do not implement features, add database columns, or introduce packages designated for future phases.
3. **No Autonomous Multi-Phase Execution:** Even if tests pass 100% and the build succeeds with exit code 0, the agent must present the Phase N report and **STOP**.
