# ADR-024: Document Delivery & Privacy Consent Router

## Status
Accepted (Phase 8)

## Context
Prescriptions, invoices, and clinical summaries must be printable offline and exportable as PDFs, with optional capability for external delivery (WhatsApp / Email) while adhering to strict healthcare data privacy regulations.

## Decision
1. **Unified Delivery Router:** `DocumentDeliveryService` provides a unified dispatch interface routing to Native Printer, Local PDF, or optional WhatsApp/Email provider implementations.
2. **Offline Independence Invariant:** Document rendering, printing, and PDF local file export operate 100% offline with zero external network dependencies.
3. **Mandatory Patient Consent Gate:** Automatic background dispatch of clinical records is strictly blocked. Every external dispatch requires explicit user confirmation of recipient details and user consent flag.
4. **Audit Logging:** Every document dispatch writes an immutable `AuditAction.DOCUMENT_DISPATCHED` record with recipient and document metadata.

## Consequences
- 100% offline baseline for all core clinical and billing workflows.
- Patient health information is protected against accidental background transmission.
