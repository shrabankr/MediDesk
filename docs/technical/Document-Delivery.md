# Document Delivery & Routing

## Overview
MediDesk Phase 8 unifies document rendering and delivery for prescriptions, POS invoices, receipts, and clinical summaries.

## Supported Channels
- **PRINT:** Native Electron hardware printing (A4, A5, 58mm, 80mm thermal receipts).
- **PDF:** Offline local PDF generation and file export.
- **WHATSAPP:** Optional, pluggable messaging integration requiring explicit user trigger and patient consent.
- **EMAIL:** Optional, pluggable email integration requiring explicit user trigger and patient consent.

## Invariants
- **100% Offline Core:** Core printing and PDF export operate with 0 network dependencies.
- **Explicit Consent:** Automatic broadcast of health data is blocked. Every dispatch logs `AuditAction.DOCUMENT_DISPATCHED`.
