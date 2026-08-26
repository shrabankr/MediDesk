# Technical Architecture: Licensing & 60-Day Trial Engine

## Overview
The `@medidesk/licensing` subsystem implements an offline-first cryptographic licensing model. It verifies digital signatures locally on the clinic desktop without network dependencies.

## Key Principles

### 1. Offline Verification
- Verification uses 2048-bit RSA-SHA256 asymmetric cryptography.
- The public key is bundled in the desktop application binary.
- The private key is never exposed or distributed to client environments.

### 2. Token Format
```text
BASE64(LicenseTokenPayload) . BASE64(RSASHA256Signature)
```

Payload structure:
```json
{
  "installationId": "INST-A1B2C3D4",
  "organizationId": "org-metro-clinic",
  "organizationName": "Metro City Clinic",
  "tier": "CLINIC_STANDARD",
  "features": ["clinical", "pharmacy", "billing", "reports", "backup_local", "backup_cloud"],
  "validFrom": "2026-01-01T00:00:00.000Z",
  "validTo": "2027-01-01T00:00:00.000Z",
  "maxDoctors": 10,
  "maxStaff": 20,
  "issuedAt": "2026-01-01T00:00:00.000Z"
}
```

### 3. 60-Day Full Evaluation Trial
- On first-time initialization, `LicenseService.initializeTrial` generates a 60-day trial record in SQLite.
- The trial enables full access to clinical consultations, pharmacy inventory, and POS billing.
- Real-time countdown (`daysRemaining`) is surfaced in the clinic settings UI.

### 4. Patient Data Protection Invariant
- If a trial or commercial license expires, MediDesk transitions into a read-only archive state (`LicenseExpiredError` on writes).
- Historical patient records, consultations, prescriptions, and sales remain readable, printable, and exportable.
- Historical medical records are never encrypted, deleted, or held hostage.

### 5. RBAC Isolation
- Activating a commercial license requires `system.license.activate`.
- Granted exclusively to `role-owner`.
- Denied to `role-developer`, `role-doctor`, and `role-staff`.
