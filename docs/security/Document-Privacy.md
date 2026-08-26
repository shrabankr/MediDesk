# Document Privacy & Consent Governance

## Privacy Invariants
1. **Explicit Patient / User Consent:** No patient record, prescription, or clinical summary may be dispatched to external communication channels (WhatsApp / Email) without recorded confirmation of user consent (`userConsentConfirmed: true`).
2. **Offline Local Baseline:** Prescriptions and invoices can always be printed or exported to PDF offline without transmitting data to any cloud service.
3. **Structured Audit Trail:** Every dispatch request records the actor ID, recipient name/target, timestamp, and unique document reference in `audit_events`.
4. **Developer Isolation:** Developer accounts cannot access, view, or dispatch patient health documents.
