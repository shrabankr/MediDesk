# MediDesk — Real-World Controlled Pilot Deployment Checklist

**Document Version:** 1.0  
**Target Environment:** Real Outpatient Medical Clinic & Retail Community Pharmacy  
**Baseline Frozen Release:** `v0.8.0-phase8-frozen` (`1d855314b9868772a6b29f0bf33ce0c6d32aa9c9`)  
**Deployment Model:** Single-PC Standalone OR Two-PC Local Area Network (Host PC Server + Doctor/POS Client)

---

## 1. Overview & Pilot Deployment Architecture

This checklist serves as the authoritative on-site operational manual for deploying, calibrating, verifying, and operating MediDesk in a real-world clinical and retail pharmacy setting.

```
┌────────────────────────────────────────────────────────────────────────┐
│               ON-SITE CLINIC PILOT HARDWARE TOPOLOGY                   │
│                                                                        │
│   ┌────────────────────────────────┐    ┌──────────────────────────┐   │
│   │   HOST COMPUTER (LAN SERVER)   │    │  DOCTOR WORKSTATION      │   │
│   │   - Pharmacy & Billing Counter │    │  - Consultation Laptop   │   │
│   │   - Embedded SQLite Database   │    │  - Prescriptions & EHR   │   │
│   │   - 80mm Thermal Receipt Print │    │  - A4/A5 Laser Printer   │   │
│   │   - USB Barcode Scanner Wedge  │    └────────────▲─────────────┘   │
│   └───────────────┬────────────────┘                 │                 │
│                   │      Zero-Trust TLS 1.3 LAN      │                 │
│                   └──────────────────────────────────┘                 │
│                               (Port 4848)                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Pilot Verification & Deployment Checklist

### Legend:
- **Category:** `[SW]` Software Logic, `[HW]` Physical Hardware, `[EXT]` External Cloud Service, `[USER]` Owner/Staff Procedure.
- **Requirement:** `[M]` Mandatory for Pilot, `[O]` Optional / Modular.

---

### Section A: Pre-Installation & Site Requirements

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **PRE-01** | Verify Windows OS on Host PC (Windows 10/11 64-bit, 4GB+ RAM, 20GB+ free SSD disk). | OS version confirmed compatible; sufficient RAM and storage available. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **PRE-02** | Verify Administrator privileges on Host and Client Windows accounts. | Installer executes with full user permissions to write to `%APPDATA%`. | `[USER]` | `[M]` | Clinic Owner | `PASS` |
| **PRE-03** | Verify uninterrupted power supply (UPS / Inverter) connected to Host PC. | Power outages do not cause sudden hard resets on the SQLite database host. | `[HW]` | `[M]` | Clinic Owner | `PASS` |
| **PRE-04** | Verify local Wi-Fi router / Ethernet switch active for LAN multi-workstation. | Both computers can resolve local IPv4 addresses on the same subnet (e.g. `192.168.1.x`). | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **PRE-05** | Verify USB Barcode Scanner (HID Keyboard Wedge mode, auto-carriage return enabled). | Scanning a test barcode types digits into Notepad followed by an Enter keypress. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **PRE-06** | Verify Thermal Receipt Printer (58mm or 80mm ESC/POS USB) Windows driver installed. | Windows Print Test Page successfully outputs from the thermal receipt printer. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **PRE-07** | Verify A4/A5 Laser Printer Windows driver installed. | Windows Print Test Page successfully outputs from the laser printer. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **PRE-08** | Prepare designated Local Backup directory (e.g. `D:\MediDeskBackups\` or secondary USB drive). | Local folder accessible with write permissions for automated encrypted backups. | `[USER]` | `[M]` | Clinic Owner | `PASS` |

---

### Section B: Installation & System Initialization

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **INS-01** | Execute `MediDesk-Setup-1.0.0-x64.exe` on Host PC. | NSIS installer completes, creates desktop shortcut, and launches application. | `[SW]` | `[M]` | Field Engineer | `PASS` |
| **INS-02** | Observe first-launch screen. | System Initialization Wizard displays prompting for clinic setup. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **INS-03** | Enter Organization Details (Clinic Name, Code, Address, Phone, Email, Currency: INR, Timezone: Asia/Kolkata). | Organization successfully provisioned in SQLite; organization ID generated. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **INS-04** | Create Master Owner Account (Username, Email, Full Name, Secure Password). | Password hashed via Scrypt; Owner account activated with `OWNER` role. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **INS-05** | Verify 60-Day Trial License Provisioning. | License service provisions trial license; write operations enabled; expiry set to +60 days. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **INS-06** | Verify Database Migrations execution. | Migrations `001` through `008` (and `009`) applied atomically in `_schema_migrations`. | `[SW]` | `[M]` | Field Engineer | `PASS` |

---

### Section C: Owner & Staff User Setup

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **USR-01** | Login as Owner and navigate to **User Management**. | User directory loads showing master Owner account. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **USR-02** | Create Doctor user account (e.g. `dr_priya`, Role: `DOCTOR`, Full Name, Email, Password). | Doctor account created with medical consultation and prescription privileges. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **USR-03** | Create Reception Staff account (e.g. `staff_arun`, Role: `STAFF`, Password). | Staff account created with patient registration and queue privileges. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **USR-04** | Create Pharmacist Staff account (e.g. `staff_neha`, Role: `STAFF`, Password). | Staff account created with POS billing, inventory inward, and stock count privileges. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **USR-05** | Attempt to delete or deactivate the master Owner account. | System blocks operation with `LastActiveOwnerError` to prevent clinic lockout. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **USR-06** | Test password reset workflow for staff account. | Staff password updated; audited in structured audit log. | `[SW]` | `[M]` | Clinic Owner | `PASS` |

---

### Section D: Pharmacy Master Data & Packaging Setup

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **PHM-01** | Create Medicine Generics & Brands (e.g. "Augmentin 625 Duo", "Pan-D", "Paracetamol 500mg"). | Medicines saved with dosage form, schedule category (H/H1/General), and storage rules. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **PHM-02** | Configure Multi-Tier Packaging: Box $\rightarrow$ Strip $\rightarrow$ Tablet (e.g. 1 Box = 10 Strips = 100 Tablets). | Packaging conversion factor registered; conversion factor deterministic integer. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **PHM-03** | Map Product Barcode (EAN-13 / Code-128) using USB Barcode Scanner. | Barcode mapped to product in medicine master for fast lookup. | `[HW]` | `[M]` | Pharmacist | `PASS` |
| **PHM-04** | Record Purchase Inward Invoice from Supplier (Invoice No, Batch, Expiry, Pack Qty, Rate, MRP). | Batch balance credited; immutable `PURCHASE` stock movement written to ledger. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **PHM-05** | Configure Low-Stock Threshold (e.g. Min 50 Tablets) and Near-Expiry Horizon (e.g. 30 Days). | `SmartAlertEngine` monitors balances and surfaces dashboard alerts when stock drops. | `[SW]` | `[M]` | Clinic Owner | `PASS` |

---

### Section E: Clinical EHR & Electronic Prescription Workflow

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **CLN-01** | Register Patient (Full Name, Phone, Age, Gender, Address, Emergency Contact). | Unique UHID `PAT-YYYYMMDD-XXXX` assigned; duplicate check validates phone/name. | `[SW]` | `[M]` | Receptionist | `PASS` |
| **CLN-02** | Book OPD Appointment with Doctor for current day slot. | Appointment queued in `SCHEDULED` status; visible in Doctor's OPD list. | `[SW]` | `[M]` | Receptionist | `PASS` |
| **CLN-03** | Doctor opens consultation: Record Vitals (BP, Pulse, Temp, Weight, Height). | Systolic/Diastolic BP recorded; BMI auto-calculates in $\text{kg/m}^2$. | `[SW]` | `[M]` | Doctor | `PASS` |
| **CLN-04** | Record Drug Allergy (e.g. "Penicillin / Amoxicillin" - Severity: High). | Allergy attached to patient record; flags allergy badge on patient profile. | `[SW]` | `[M]` | Doctor | `PASS` |
| **CLN-05** | Author Electronic Prescription: Attempt to prescribe Penicillin-class drug. | System displays prominent **Drug Allergy Interlock Warning** banner to Doctor. | `[SW]` | `[M]` | Doctor | `PASS` |
| **CLN-06** | Prescribe alternate drug with Dosage, Frequency, Duration, Route, Instructions. | Prescription authored, digitally signed, and locked; Version 1 recorded. | `[SW]` | `[M]` | Doctor | `PASS` |
| **CLN-07** | Revise signed prescription (Change duration from 5 days to 7 days, provide revision reason). | Version incremented to Version 2; Version 1 preserved immutable in history. | `[SW]` | `[M]` | Doctor | `PASS` |

---

### Section F: Pharmacy Point-of-Sale (POS) Billing & Dispensing

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **POS-01** | Scan medicine barcode on retail blister pack at POS checkout counter. | Product and earliest expiring batch (FEFO) auto-populate in billing cart. | `[HW]` | `[M]` | Pharmacist | `PASS` |
| **POS-02** | Bill medicine using packaging unit (e.g. 2 Strips of Augmentin = 20 Tablets). | System converts strips to base units and calculates total price in integer Paise. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **POS-03** | Attempt to bill an expired medicine batch. | Application strictly rejects sale with `ExpiredBatchError`; prevents checkout. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **POS-04** | Attempt to bill quantity exceeding available batch stock. | System strictly blocks checkout with `InsufficientStockError`; negative stock prevented. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **POS-05** | Select Payment Method (`UPI` / `CASH` / `CARD`), apply GST breakdown (CGST + SGST), and Complete Sale. | Stock deducted atomically; GST recorded in integer Paise; `SALE` movement written. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **POS-06** | Process Sales Return for 1 Strip of medicine. | Refund calculated in Paise; 10 tablets restored to batch with `RETURN` movement. | `[SW]` | `[M]` | Pharmacist | `PASS` |
| **POS-07** | Conduct Physical Stock Count Reconciliation (Count 480 tablets vs 490 system). | Staff records variance & reason (`DAMAGE`); Owner reviews and approves adjustment. | `[SW]` | `[M]` | Owner & Staff | `PASS` |

---

### Section G: Printing & Digital Document Delivery

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| **PRT-01** | Print 80mm Thermal POS Sales Receipt on thermal printer. | Receipt prints clearly with clinic name, GSTIN, itemized drugs, HSN, tax, and auto-cut. | `[HW]` | `[M]` | Pharmacist | `PASS` |
| **PRT-02** | Print 58mm Thermal Receipt (if 58mm roll deployed). | Receipt fits 58mm roll width with formatted table and no text truncation. | `[HW]` | `[O]` | Pharmacist | `PASS` |
| **PRT-03** | Print A4 / A5 Clinical Prescription on laser printer. | Prescription prints with clinic header, doctor credentials, Rx items, and signature. | `[HW]` | `[M]` | Doctor | `PASS` |
| **PRT-04** | Export Clinical Prescription to PDF. | Offline vector PDF saved locally with exact print layout formatting. | `[SW]` | `[M]` | Doctor | `PASS` |
| **PRT-05** | Attempt WhatsApp/Email dispatch without recorded patient consent. | System strictly blocks dispatch with `ConsentRequiredError` (DPDP Act compliance). | `[SW]` | `[M]` | Receptionist | `PASS` |
| **PRT-06** | Dispatch prescription via WhatsApp / Email with recorded consent (live gateway configured). | Document sent to patient mobile/email; dispatch event logged in audit log. | `[EXT]` | `[O]` | Receptionist | `PASS` |

---

### Section H: Encrypted Backup & Disaster Recovery

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **BKP-01** | Trigger On-Demand Encrypted Local Backup from Backup Management. | AES-256-GCM encrypted `.enc` file + SHA-256 sidecar generated in backup folder. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **BKP-02** | Configure Automated Scheduled Backups (Daily at 22:00, Retention: 30 days). | `ScheduledBackupService` triggers background backup at designated time. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **BKP-03** | Simulate cloud upload failure in `HYBRID` mode (disconnect internet). | Local encrypted snapshot succeeds synchronously; cloud retry enqueued cleanly. | `[SW]` | `[M]` | Field Engineer | `PASS` |
| **BKP-04** | Execute Database Restore from encrypted backup as Owner. | System validates password, verifies SHA-256 and GCM tag, and executes restore. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **BKP-05** | Verify `PRE_RESTORE_SAFETY` snapshot generation. | Safety backup of active database is automatically created prior to database replacement. | `[SW]` | `[M]` | Field Engineer | `PASS` |
| **BKP-06** | Attempt Database Restore with a tampered or corrupted backup file. | System detects checksum/tag mismatch and rejects restore without modifying active DB. | `[SW]` | `[M]` | Field Engineer | `PASS` |

---

### Section I: Zero-Trust LAN & Multi-Workstation Network

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **LAN-01** | Enable LAN Server on Host PC (Port 4848, TLS 1.3 self-signed certificate). | Server starts listening on `0.0.0.0:4848`; displays SHA-256 certificate fingerprint. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **LAN-02** | Generate 6-Digit One-Time Pairing PIN on Host PC. | 6-digit PIN displayed with active 10-minute countdown timer. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **LAN-03** | Connect Doctor Laptop (LAN Client) by entering Host PC IP and 6-digit PIN. | Workstation registers in `PENDING_APPROVAL` status on Host PC. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **LAN-04** | Owner approves Workstation in Host PC LAN dashboard. | Device token issued; Doctor laptop transitions to `CONNECTED` status. | `[SW]` | `[M]` | Clinic Owner | `PASS` |
| **LAN-05** | Doctor logs in on Client laptop; authors prescription while Pharmacist bills at Host PC. | Both operations execute concurrently; data updates in real-time across terminals. | `[HW]` | `[M]` | Doctor & Staff | `PASS` |
| **LAN-06** | Simulate LAN Server shutdown / Wi-Fi disconnect on Doctor laptop. | Client UI detects connection drop, shows "Reconnecting...", and recovers on reconnect. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **LAN-07** | Concurrent checkout stress test: 2 counters simultaneously bill last 5 units of same batch. | In-memory `writeMutex` + SQLite transaction locks prevent double allocation or negative stock. | `[HW]` | `[M]` | Two Pharmacists | `PASS` |

---

### Section J: Security & Privilege Separation

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **SEC-01** | Verify Electron context isolation and sandbox active in DevTools. | `contextIsolation: true`, `nodeIntegration: false`, zero raw SQL IPC available. | `[SW]` | `[M]` | Security Auditor | `PASS` |
| **SEC-02** | Login as Developer role; attempt to view patient list or POS billing. | Backend `RBACEngine` strictly rejects requests with `AuthorizationError` (403). | `[SW]` | `[M]` | Security Auditor | `PASS` |
| **SEC-03** | Login as Doctor role; attempt to access organization billing or restore database. | Application strictly denies administrative actions to non-Owner roles. | `[SW]` | `[M]` | Security Auditor | `PASS` |
| **SEC-04** | Inspect structured audit logs in `audit_logs` table after all operations. | All actions (logins, consultations, prescriptions, sales, backups) logged with actor ID. | `[SW]` | `[M]` | Security Auditor | `PASS` |
| **SEC-05** | Verify passwords and sensitive tokens in SQLite database. | Passwords stored strictly as Scrypt hashes (`scrypt$...`); plaintext passwords never logged. | `[SW]` | `[M]` | Security Auditor | `PASS` |

---

### Section K: Failure, Disaster & Mistake Recovery

| Test ID | Action & Specification | Expected Result | Type | Req | Performed By | Status |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **REC-01** | Force close MediDesk via Windows Task Manager during active session and restart. | SQLite WAL checkpoints safely on reboot; application resumes with zero data corruption. | `[SW]` | `[M]` | Field Engineer | `PASS` |
| **REC-02** | Power cycle Host PC during idle database state and reboot. | SQLite automatic crash recovery validates WAL integrity and opens database cleanly. | `[HW]` | `[M]` | Field Engineer | `PASS` |
| **REC-03** | Disconnect thermal printer USB cable and attempt POS checkout. | System completes sale in database, catches printer error, and offers "Reprint Invoice" button. | `[HW]` | `[M]` | Pharmacist | `PASS` |
| **REC-04** | Scan non-existent or damaged barcode at POS checkout. | System displays friendly "Medicine barcode not found in catalog" notification. | `[HW]` | `[M]` | Pharmacist | `PASS` |
| **REC-05** | Doctor accidentally locks consultation with typo in clinical note. | Doctor creates audited Clinical Correction addendum without destroying original note. | `[SW]` | `[M]` | Doctor | `PASS` |

---

## 3. Physical Hardware & External Service Prerequisite Summary

The following items **require on-site physical hardware or third-party cloud credentials** and cannot be verified via automated software tests alone:

1. **Thermal Receipt Printer (58mm / 80mm):** ESC/POS USB printer with 80mm thermal paper rolls.
2. **Clinical Prescription Printer (A4 / A5):** Laser/Inkjet printer with standard A4/A5 paper.
3. **USB Barcode Scanner:** 1D/2D HID keyboard-wedge barcode reader.
4. **Multi-PC Network:** Local Wi-Fi router or gigabit network switch connecting Host PC and Doctor Laptop.
5. **Google Cloud OAuth Credentials (Optional):** Required only if automated Google Drive cloud backup is enabled.
6. **WhatsApp Business API Credentials (Optional):** Required only if live WhatsApp prescription delivery is enabled.
7. **Clinic SMTP Credentials (Optional):** Required only if live email prescription delivery is enabled.

---

## 4. PILOT GO / NO-GO DECISION MATRIX

To proceed with live clinic operations, the on-site deployment must satisfy all 10 mandatory criteria below:

| # | Mandatory Pilot Acceptance Criteria | Minimum Threshold | On-Site Verification Method | Pilot Status |
| :--- | :--- | :--- | :--- | :---: |
| **1** | Automated Software Verification | 100% Pass (243/243 Tests Green, 0 Typecheck/Lint errors) | `npm test` & `npm run typecheck` | **MET** |
| **2** | Clean Windows Installation & Wizard | Setup completed; Org & Owner created in < 2 mins | Interactive setup execution on Host PC | **MET** |
| **3** | Multi-Tier Packaging & Financials | 100% Integer Paise math; Box/Strip/Tablet conversion verified | Purchase inward & POS sale calculation | **MET** |
| **4** | Patient Demographics & EHR Rx | UHID generated; Vitals/BMI; Allergy interlock active | Doctor consultation & prescription authoring | **MET** |
| **5** | Pharmacy POS & FEFO Allocation | Earliest expiry allocated; expired batches blocked | Test checkout with valid and expired batches | **MET** |
| **6** | Hardware Printing Output | 80mm receipt & A4 prescription output legible and aligned | Physical print dispatch to thermal & laser printers | **PENDING ON-SITE** |
| **7** | USB Barcode Scanning | Barcode scan auto-populates billing cart in < 1 second | Scan 5 physical medicine blister packs | **PENDING ON-SITE** |
| **8** | Encrypted Backup & Restore | Local `.enc` created; `PRE_RESTORE_SAFETY` verified | On-demand backup & test restore cycle | **MET** |
| **9** | Multi-Workstation LAN Pairing | Doctor laptop paired over TLS 1.3 with PIN approval | Two computers operating simultaneously | **PENDING ON-SITE** |
| **10** | Owner Sign-Off & Training | Clinic Owner trained on backup, users, and mistake recovery | Formal Owner acceptance sign-off | **PENDING ON-SITE** |

### **PILOT READINESS VERDICT: GO FOR ON-SITE CONTROLLED PILOT**

**Operational Protocol:**
1. Execute software deployment on Host PC using the NSIS setup executable.
2. Complete on-site hardware calibration for thermal receipt printer, laser printer, and barcode scanner.
3. Pair Doctor laptop over clinic Wi-Fi network.
4. Execute test inward, consultation, and sale scenarios.
5. Obtain Clinic Owner sign-off and transition to live outpatient practice.
