# ADR-004: Owner vs Developer Privileged Access Separation

## Status
Accepted (`CURRENT`)

## Context
In healthcare software, technical administrators must not have unrestricted access to confidential medical and financial records. Universal `SUPER_ADMIN` accounts present grave compliance and security hazards.

## Decision
Strictly separate Business Authority from Technical Authority:
- **OWNER (Business Authority):** Has control over clinic configuration, staff accounts, clinical data, pharmacy inventory, and billing records.
- **DEVELOPER (Technical Authority):** Has control over database migrations, system diagnostics, configuration parameters, and local backups.
- **NO UNIVERSAL BYPASS:** Developer has no default access to clinical, patient, pharmacy, or financial data. Temporary sensitive support access requires explicit Owner approval, limited scope, expiration, and audit logging.

## Consequences
- Protects patient medical confidentiality and prevents inadvertent or unauthorized access by IT technicians.
- Enforces explicit Owner authorization, temporal expiration, and tamper-evident audit logging for any emergency support session.
