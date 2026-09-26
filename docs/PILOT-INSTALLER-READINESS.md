# MediDesk — Pilot Installer & Deployment Readiness Guide

**Baseline Release Tag:** `v0.8.0-phase8-frozen`  
**Baseline Commit:** `1d855314b9868772a6b29f0bf33ce0c6d32aa9c9`  
**Target Architecture:** Windows 10 & Windows 11 64-bit (x64)  
**Document Purpose:** Complete Windows Installer Architecture, Deployment Guide, Hardware Setup, and Pilot Operational Readiness Protocol.

---

## 1. Installer & Packaging Status

### A. Current Build Audit Findings:
- **Build Tool:** `electron-builder v25.1.8` targeting Windows NSIS Installer and Standalone Portable Executable.
- **Native C++ Module (`better-sqlite3`):** Compiled cleanly against Electron Node ABI via `electron-rebuild`.
- **Application Code Bundles:** Vite Renderer, Main Process (`dist/main/index.js`), and Preload Bridge (`dist/preload/index.mjs`) compiled cleanly.
- **Packaging Hoisting Requirement:** In the npm workspace structure, `electron-builder` requires an explicit `"electronVersion": "33.2.1"` declaration in `apps/desktop/electron-builder.json` or root package configuration when Electron is hoisted to monorepo root.
- **Application Branding Assets:** Multi-resolution `icon.ico` (256x256 multi-layer `.ico`) and `icon.png` (512x512 `.png`) should be placed in `apps/desktop/build/` for branded desktop shortcuts and installer banners.
- **Code Signing:** Operating under Windows Defender SmartScreen "Run anyway" prompt during pilot; Authenticode Code Signing Certificate required for general commercial release.

---

## 2. Installation & Persistence Architecture

### A. File Locations on Target Windows PC:
- **Application Binary Directory:**
  `C:\Users\<User>\AppData\Local\Programs\MediDesk\`
- **Database & Data Persistence Directory:**
  `C:\Users\<User>\AppData\Roaming\MediDesk\` (`%APPDATA%\MediDesk\`)
- **Active Database Files:**
  - Database: `%APPDATA%\MediDesk\medidesk.sqlite`
  - WAL Journal: `%APPDATA%\MediDesk\medidesk.sqlite-wal`
  - Shared Memory: `%APPDATA%\MediDesk\medidesk.sqlite-shm`
- **Encrypted Local Backups Directory:**
  `%APPDATA%\MediDesk\backups\` (e.g. `backup_2026-08-30_100000.enc` + `.sha256`)

### B. Uninstall & Upgrade Data Protection:
- **NSIS Safe Invariant:** `nsis.deleteAppDataOnUninstall: false` is configured in `electron-builder.json`.
- **Preservation Guarantee:** Uninstalling MediDesk or running an upgrade installer **never deletes or overwrites** `%APPDATA%\MediDesk\medidesk.sqlite` or local backup archives.
- **Sequential Migration Engine:** Upgrading the application starts `MigrationRunner`, which inspects `_schema_migrations`, applies only pending incremental migrations, and launches directly into the authenticated session.

---

## 3. Step-by-Step Pilot Installation Procedure

### Phase 1: Host PC (Server & POS Terminal)
1. **Launch Installer:** Double-click `MediDesk-Setup-1.0.0-x64.exe` on Host PC.
2. **SmartScreen Bypass:** If Windows Defender SmartScreen appears, click **More info** $\rightarrow$ **Run anyway**.
3. **Choose Directory:** Confirm destination directory (`%LOCALAPPDATA%\Programs\MediDesk\`) and complete installation.
4. **First Launch:** Launch MediDesk. Verify that the **System Initialization Wizard** displays automatically.
5. **Organization Setup:**
   - Clinic Name: (e.g. `City Care Family Clinic`)
   - Clinic Code: (e.g. `CCFC`)
   - Address, Phone, Email, GSTIN
   - Currency: `INR` | Timezone: `Asia/Kolkata`
6. **Master Owner Account:**
   - Create Master Username and high-entropy password (hashed via Scrypt `N=32768, r=8, p=1`).
7. **License Provisioning:** 60-Day Trial License is automatically activated with full write operations enabled.

---

## 4. On-Site Hardware Setup Checklist

The following hardware peripherals must be calibrated on-site at the clinic:

| Peripheral | Connection | On-Site Calibration Procedure | Verification Sign-Off |
| :--- | :--- | :--- | :---: |
| **80mm / 58mm Thermal Printer** | USB | Install manufacturer ESC/POS driver. In MediDesk Settings $\rightarrow$ Printers, select receipt printer. Print test receipt and verify paper cut and margins. | `[ ] PENDING ON-SITE` |
| **A4 / A5 Laser Printer** | USB / Wi-Fi | Install Windows laser printer driver. Select prescription printer in Settings. Print test prescription and verify letterhead margin alignment. | `[ ] PENDING ON-SITE` |
| **USB Barcode Scanner** | USB | Plug in HID scanner. Ensure auto-carriage return is enabled. In Medicine Master, scan 5 physical medicine boxes to verify rapid EAN-13 decoding. | `[ ] PENDING ON-SITE` |
| **Electronic Cash Drawer** | RJ11 to Printer | Connect RJ11 cable from thermal receipt printer to cash drawer. Verify drawer kicks open upon POS cash sale completion. | `[ ] PENDING ON-SITE` |

---

## 5. Multi-Workstation LAN Setup Checklist

| Step | Workstation | Action & Procedure | Status |
| :--- | :--- | :--- | :---: |
| **LAN-01** | Host PC | Navigate to **Settings $\rightarrow$ LAN Management**. Enable **LAN Server Mode** (Port 4848). Verify SHA-256 TLS certificate fingerprint is displayed. | `[ ] PENDING ON-SITE` |
| **LAN-02** | Host PC | Click **Generate Pairing PIN** (displays 6-digit one-time PIN with 10-minute validity). | `[ ] PENDING ON-SITE` |
| **LAN-03** | Doctor Laptop | Launch MediDesk in **LAN Client Mode**. Enter Host PC IP address (e.g. `192.168.1.50`) and the 6-digit pairing PIN. | `[ ] PENDING ON-SITE` |
| **LAN-04** | Host PC | In LAN Management Dashboard, locate Doctor laptop in `PENDING_APPROVAL` status and click **Approve Workstation**. | `[ ] PENDING ON-SITE` |
| **LAN-05** | Doctor Laptop | Verify Doctor laptop transitions to `CONNECTED` with green indicator. Doctor logs in and accesses OPD consultation queue. | `[ ] PENDING ON-SITE` |

---

## 6. Offline Independence vs. External Service Configuration

MediDesk operates 100% offline without remote cloud servers. External gateways are optional enhancements configured via Owner Settings:

| Feature | Offline Behavior (Default) | External Gateway Configuration |
| :--- | :--- | :--- |
| **Clinical Records & POS** | 100% Standalone local SQLite. | Zero remote network calls. |
| **Prescription Printing** | Direct local A4/A5 laser print & PDF export. | No cloud dependency. |
| **Receipt Printing** | Direct local 58mm/80mm ESC/POS thermal print. | No cloud dependency. |
| **Backup Management** | Local AES-256-GCM encrypted `.enc` snapshots. | **Optional:** Google Cloud OAuth Client ID/Secret for background Drive sync. |
| **Document Delivery** | Saves local PDF for manual sharing. | **Optional:** Meta/Twilio WhatsApp API & SMTP mail server credentials. |

---

## 7. Pilot Operational & Mistake Recovery Guidelines

1. **Server Disconnect Recovery:** If Doctor laptop shows "LAN Server Disconnected", ensure Host PC is powered on and clinic Wi-Fi router is active. Client automatically reconnects without data loss.
2. **Sales Returns & Refunds:** Process sales returns through the POS Returns view. Enter original invoice number, select returned items, and refund amount. Stock is restored automatically.
3. **Prescription Correction:** If a doctor makes a mistake after locking a visit, use **Create Prescription Revision** or **Clinical Correction** addendum. The original signed record is preserved in audit history.
4. **Disaster Recovery Restore:** In the event of hard drive failure, install MediDesk on a replacement PC, open Backup Management as Owner, select the latest `.enc` backup file, enter the Owner password, and restore.

---

## 8. Pilot Readiness Verdict

### **VERDICT: READY WITH CONFIGURATION (AUTHORIZED FOR ON-SITE PILOT DEPLOYMENT)**

**Prerequisites for On-Site Launch:**
1. Execute on-site printer, barcode scanner, and LAN router pairing calibration according to Section 4 & 5.
2. Complete Owner onboarding and staff user provisioning.
3. Obtain Clinic Owner formal sign-off.
