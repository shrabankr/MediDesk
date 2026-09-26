# MediDesk — Production Gaps & Readiness Analysis

**Document Version:** 1.0  
**Baseline Evaluated:** `v0.8.0-phase8-frozen`  
**Purpose:** Comprehensive categorization of technical, operational, and configuration gaps prior to broad commercial deployment.

---

## 1. Classification Overview

| Category | Count | Status Summary |
| :--- | :---: | :--- |
| **A. Critical Blockers** | 0 | Zero architectural, security, or data corruption blockers in core codebase. |
| **B. High-Priority Deployment Gaps** | 2 | Windows Code Signing Certificate & Packaging Icon Assets. |
| **C. Medium-Priority Operational Gaps** | 3 | Day-End Cashier Z-Report (Phase 9B), Rx Margin Offset Calibration, Accounting Export. |
| **D. Cosmetic & Usability Enhancements** | 2 | Continuous POS Barcode Scan Stream & One-Click Print Dialog Toggle. |
| **E. External Configuration Prerequisites** | 3 | Google Cloud OAuth Keys, WhatsApp Business API, Clinic SMTP Credentials. |
| **F. Physical Hardware Calibration Items** | 4 | Thermal 58/80mm Printer Spooler, A4/A5 Letterhead Margins, USB Barcode Scanner, Cash Drawer. |

---

## 2. Detailed Gap Analysis

### Category A: Critical Blockers (Severity: NONE)
- **Status:** **0 Blockers.**
- The core architecture fulfills all clinical, financial, security, and offline persistence requirements.

---

### Category B: High-Priority Deployment Gaps

#### GAP-B01: Missing Windows Authenticode Code Signing Certificate
- **Description:** Unsigned Windows `.exe` installers trigger Windows Defender SmartScreen ("Unknown Publisher / Protected your PC") on fresh Windows 10/11 installations.
- **Affected Components:** `apps/desktop/electron-builder.json`, Windows NSIS Installer.
- **Real-World Impact:** Non-technical clinic staff may hesitate to click through SmartScreen warnings during initial installation.
- **Recommended Resolution:** Obtain a Standard or EV Windows Authenticode Code Signing Certificate from a trusted CA (e.g. DigiCert, Sectigo) and configure signing in CI/CD release builds.

#### GAP-B02: Packaging Branding & Icon Assets
- **Description:** `apps/desktop/electron-builder.json` references `buildResources: "build"`, but high-resolution multi-size icon files (`icon.ico` for Windows, `icon.png` for Linux) must be placed in `apps/desktop/build/`.
- **Affected Components:** `apps/desktop/build/icon.ico`.
- **Real-World Impact:** Windows desktop shortcut and taskbar icon default to generic Electron icon if custom `.ico` is absent.
- **Recommended Resolution:** Place 256x256 multi-layer `.ico` and 512x512 `.png` brand assets in `apps/desktop/build/`.

---

### Category C: Medium-Priority Operational Gaps

#### GAP-C01: Day-End Cashier Closing & Financial Z-Report
- **Description:** Small pharmacy counters require an end-of-day register balancing workflow (`OPEN` $\rightarrow$ `CLOSED`) to count physical drawer cash against recorded cash sales and print a daily Z-report receipt.
- **Target Phase:** Scheduled in approved roadmap as **Phase 9B**.
- **Real-World Impact:** Cashiers currently sum daily POS totals from the financial dashboard rather than having an explicit end-of-shift cash reconciliation receipt.
- **Recommended Resolution:** Implement Phase 9B Day-End Cashier Closing & 80mm Z-Report document generation.

#### GAP-C02: Pre-Printed Clinic Letterhead Top Margin Offsets
- **Description:** Some doctors print electronic prescriptions onto physical pre-printed letterheads that already contain doctor credentials and clinic logos, requiring a customizable top margin offset (e.g. 50mm blank header).
- **Target Phase:** Scheduled in approved roadmap as **Phase 9C**.
- **Real-World Impact:** Prescriptions currently print standard full clinic headers; clinics with pre-printed stationary require header suppression settings.
- **Recommended Resolution:** Implement Phase 9C configurable top/bottom letterhead margins.

#### GAP-C03: Owner Financial CSV/Excel Export for Chartered Accountants
- **Description:** Clinic owners periodically export monthly sales, purchase registers, and GST summaries to Excel/CSV for GST filing (GSTR-1/GSTR-3B) with their tax accountant.
- **Target Phase:** Scheduled in approved roadmap as **Phase 9E**.
- **Real-World Impact:** Owners currently inspect dashboard reports on screen or print PDF summaries.
- **Recommended Resolution:** Implement Phase 9E structured CSV/Excel accounting export.

---

### Category D: Usability & UX Enhancements

#### GAP-D01: Continuous Multi-Barcode Scan Stream
- **Description:** High-volume retail pharmacies benefit from a rapid-fire barcode scan mode that automatically increments quantities upon scanning duplicate barcodes without requiring keyboard/mouse interaction.
- **Affected Components:** `apps/desktop/src/renderer/src/components/PharmacyPOSView.tsx`.
- **Real-World Impact:** Speeds up checkout when dispensing multiple identical OTC items.
- **Recommended Resolution:** Add automatic scan increment buffer in POS billing component.

#### GAP-D02: One-Click Print Dialog / Silent Print Preference Switcher
- **Description:** Allow the user to toggle between direct silent printing (fast thermal checkout) and system print dialog (allowing printer selection) directly from the POS interface.
- **Affected Components:** `apps/desktop/src/renderer/src/components/SettingsView.tsx`.
- **Real-World Impact:** Useful when a clinic shares a single counter between thermal receipts and A4 invoices.
- **Recommended Resolution:** Add a quick-toggle preference in Workstation Settings.

---

### Category E: External Configuration Prerequisites

| Prerequisite Item | Impacted Subsystem | Configuration Steps |
| :--- | :--- | :--- |
| **Google Cloud OAuth 2.0 Client** | Hybrid Google Drive Backup | Create project in Google Cloud Console, enable Drive API, generate OAuth 2.0 Client ID & Secret, and input into Owner Settings. |
| **WhatsApp / SMS Gateway API** | Digital Document Dispatch | Register WhatsApp Business API (via Meta, Twilio, or MSG91), generate API Auth Token, and input into Owner Settings. |
| **SMTP Mail Server Credentials** | Email Document Dispatch | Configure clinic outbound SMTP server host, port, username, and TLS password. |

---

### Category F: Physical Hardware Testing Requirements

1. **Thermal Printers (58mm & 80mm):** Test ESC/POS auto-cutter, paper roll width margin alignment, and barcode/QR rendering.
2. **Prescription Printers (A4 & A5):** Test tray feed, duplex printing, and ink contrast for patient legibility.
3. **USB Barcode Scanners:** Test 1D Code-128 and 2D DataMatrix scanning on curved medicine vials and reflective blister packs.
4. **Electronic Cash Drawers:** Test 24V RJ11 kick-out solenoid pulse triggered upon cash receipt print.
