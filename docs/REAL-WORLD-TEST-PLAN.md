# MediDesk — Real-World Pilot Test Plan

**Document Version:** 1.0  
**Target Environment:** Real Clinic / Outpatient Pharmacy Setup (Windows 10/11 Target)  
**Test Setup Architecture:**
- **Primary Computer (LAN Server):** Reception / Pharmacy Checkout Terminal (Host PC)
- **Secondary Computer (LAN Client 1):** Doctor Consultation Room (Laptop/PC)
- **Tertiary Computer (LAN Client 2):** Pharmacy Inward / Secondary Billing Counter
- **Hardware Peripherals:**
  - 1x 80mm USB / Thermal Receipt Printer (POS Checkout)
  - 1x A4 / A5 Laser Printer (Doctor Prescription Printing)
  - 1x USB Barcode Scanner (Keyboard Wedge Mode)
  - 1x Cash Drawer with RJ11 Trigger

---

## 1. Test Actors & Credentials

| Actor Role | Username | Display Name | Test Responsibilities |
| :--- | :--- | :--- | :--- |
| **Owner / Administrator** | `owner_admin` | Dr. Rajesh Sharma | Organization config, user management, license activation, backup & restore, LAN approval. |
| **Doctor** | `dr_priya` | Dr. Priya Patel (MBBS, MD) | OPD queue, consultations, vitals, allergy checks, digital prescription authoring. |
| **Staff 1 (Receptionist)** | `staff_arun` | Arun Kumar | Patient registration, appointment scheduling, queue management. |
| **Staff 2 (Pharmacist)** | `staff_neha` | Neha Gupta | Medicine stock inward, barcode scanning, POS billing, returns, physical stock audit. |

---

## 2. Sample Master Data for Testing

### A. Organization Details:
- **Clinic Name:** City Care Family Clinic & Pharmacy
- **Code:** `CCFC`
- **Address:** 124 Station Road, Civil Lines, Jaipur, Rajasthan 302006
- **GSTIN:** `08AAAAA1234A1Z5`
- **Phone:** `+91 98290 12345`
- **Email:** `contact@citycarejaipur.in`

### B. Sample Medicines & Multi-Tier Packaging:
1. **Augmentin 625 Duo** (Amoxicillin 500mg + Clavulanic Acid 125mg)
   - Packaging: 1 Box = 10 Strips = 100 Tablets (Base Unit: `TABLET`)
   - MRP: ₹200.00 / Strip (₹20.00 / Tablet)
   - Batch A101: Expiry in 18 Months (10 Strips)
   - Batch A102: Expiry in 20 Days (Near-Expiry Test, 5 Strips)
2. **Pan-D Capsule** (Pantoprazole 40mg + Domperidone 30mg)
   - Packaging: 1 Strip = 15 Capsules (Base Unit: `CAPSULE`)
   - MRP: ₹180.00 / Strip
   - Batch P901: Expiry in 12 Months (20 Strips)
3. **Benadryl Cough Syrup 100ml** (Diphenhydramine HCl)
   - Packaging: 1 Bottle = 100 ml (Base Unit: `BOTTLE`)
   - MRP: ₹125.00 / Bottle
   - Batch B401: Expiry in 24 Months (15 Bottles)

---

## 3. Step-by-Step Test Scenarios

### Scenario 1: Clean Installation & First-Run Wizard (Host PC)
1. Launch `MediDesk-Setup-x64.exe` on Host PC.
2. Select destination folder and complete installation.
3. Open MediDesk. Verify that the Setup Wizard appears.
4. Enter clinic organization details and create initial Owner account (`owner_admin`).
5. **Expected Result:** Database initializes, migrations apply automatically, organization is provisioned, 60-day trial license is activated, and Owner dashboard loads.

### Scenario 2: User Provisioning & Authority Verification
1. Login as `owner_admin`. Navigate to **User Management**.
2. Create `dr_priya` (`DOCTOR`), `staff_arun` (`STAFF`), and `staff_neha` (`STAFF`).
3. Attempt to delete `owner_admin`.
4. **Expected Result:** System blocks deletion with "Cannot delete or deactivate the last active Owner" error.

### Scenario 3: LAN Server Activation & Workstation Pairing
1. On Host PC, navigate to **Settings $\rightarrow$ LAN Management**. Enable **LAN Server Mode** (Port 4848).
2. Click **Generate Pairing PIN** (displays 6-digit PIN with 10-minute countdown).
3. On Doctor Laptop (LAN Client 1), launch MediDesk in **LAN Client Mode**.
4. Enter Host PC IP address and 6-digit pairing PIN.
5. On Host PC, verify that the Doctor laptop appears as `PENDING_APPROVAL`.
6. Click **Approve Workstation**.
7. **Expected Result:** Doctor laptop transitions to `CONNECTED` status with green LAN indicator.

### Scenario 4: Patient Registration & Appointment Scheduling
1. On Reception terminal (Staff Arun), navigate to **Patient Registration**.
2. Register patient "Ramesh Verma", Phone: `9876543210`, Age: `45`, Gender: `MALE`.
3. Book appointment with `Dr. Priya Patel` for today at 10:30 AM.
4. **Expected Result:** Patient is issued UHID `PAT-YYYYMMDD-XXXX`. Appointment appears in Doctor's queue in real-time.

### Scenario 5: Clinical Consultation & Prescription Authoring
1. On Doctor Laptop (Dr. Priya), open appointment for "Ramesh Verma".
2. Record Vitals: BP `130/85 mmHg`, Pulse `76 bpm`, Temp `98.6 °F`, Weight `72 kg`, Height `175 cm` (Verify BMI auto-calculates to `23.5 kg/m²`).
3. Record Drug Allergy: "Amoxicillin / Penicillins" (Severity: High).
4. In Prescription builder, attempt to add "Augmentin 625 Duo".
5. **Expected Result:** System displays prominent **Drug Allergy Warning** alert. Doctor selects alternate drug "Cefuroxime 500mg" + "Pan-D", signs prescription, and completes visit.

### Scenario 6: Pharmacy Inventory Inward & Multi-Tier Packaging
1. On Pharmacy Counter (Staff Neha), open **Inventory $\rightarrow$ Purchases**.
2. Record supplier invoice from "Rajasthan Medico Distributors".
3. Inward 5 Boxes of Augmentin 625 (entered as 5 Boxes $\times$ 10 Strips $\times$ 10 Tablets = 500 Tablets).
4. Verify base unit conversion in SQLite inventory ledger.
5. **Expected Result:** `inventory_batches` reflects 500 base units; `stock_movements` records append-only `PURCHASE` ledger movement.

### Scenario 7: Barcode Scanning & POS Billing Checkout
1. Open **Pharmacy POS Billing**.
2. Scan barcode on medicine box using USB barcode scanner.
3. Verify product and earliest expiring batch are automatically populated.
4. Bill 2 Strips of Augmentin 625 + 1 Bottle of Benadryl.
5. Select Payment Mode: `UPI` (₹525.00). Click **Complete Sale**.
6. **Expected Result:** POS thermal receipt prints on 80mm printer, stock is atomically deducted from batch, and GST breakdown (CGST + SGST) is recorded in integer Paise.

### Scenario 8: Near-Expiry & Expired Batch Protection
1. Inward a test batch of medicine with expiry date set to yesterday.
2. Attempt to add this expired batch to a POS sale.
3. **Expected Result:** System strictly denies adding the item with "Expired Batch Cannot Be Sold" error.
4. Verify that the Near-Expiry alert widget surfaces amber warning for Batch A102 (expiring in 20 days).

### Scenario 9: Sales Return & Refund Processing
1. On POS counter, open **Sales Returns**.
2. Search invoice number from Scenario 7.
3. Return 1 Strip of Augmentin 625 (Reason: "Customer returned sealed strip").
4. Process cash refund of ₹200.00.
5. **Expected Result:** Return receipt prints, refund is deducted from daily revenue, and 10 tablets are restored to batch inventory with a `RETURN` stock movement.

### Scenario 10: Physical Stock Reconciliation & Owner Approval (Phase 9A)
1. Staff Neha opens **Physical Stock Count $\rightarrow$ New Session**.
2. Counts Augmentin 625: System says 490 tablets; Physical count is 480 tablets (10 tablets damaged in transit).
3. Selects reason `DAMAGE`, enters notes, and submits session.
4. Owner logs in, reviews the 10-tablet variance, and clicks **Approve & Post**.
5. **Expected Result:** Stock adjusts to 480 tablets; compensating `DAMAGED_WRITE_OFF` ledger movement is written; past movements remain untouched.

### Scenario 11: Multi-Workstation Concurrent Checkout Stress Test
1. On Host PC (Counter 1) and LAN Client 2 (Counter 2), open POS checkout for the same batch with only 5 units remaining.
2. Counter 1 attempts to sell 4 units; Counter 2 simultaneously attempts to sell 4 units.
3. **Expected Result:** The first transaction succeeds; the second transaction cleanly rejects with "Insufficient Stock Available: 1 remaining", guaranteeing zero negative stock.

### Scenario 12: LAN Disconnect & Reconnect Resilience
1. During an active session on Doctor Laptop, unplug Ethernet / disconnect Wi-Fi.
2. Verify Doctor UI displays "LAN Server Disconnected (Reconnecting...)".
3. Re-enable Wi-Fi.
4. **Expected Result:** Client automatically reconnects within 5 seconds without crashing or losing uncommitted form data.

### Scenario 13: Hybrid Backup & Owner Disaster Recovery
1. Owner opens **Backup Management**. Click **Create Encrypted Backup Now**.
2. Verify local `.enc` backup file is generated with SHA-256 sidecar checksum.
3. Click **Restore Database** and select the backup file. Re-enter Owner password.
4. **Expected Result:** System creates automatic `PRE_RESTORE_SAFETY` snapshot, verifies checksum, validates AES-GCM authentication tag, and successfully replaces database.
