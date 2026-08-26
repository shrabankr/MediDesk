# ADR-018: Offline Cryptographic Licensing & 60-Day Trial Engine

## Status
Accepted and Verified (Phase 6)

## Context
MediDesk is designed as an offline-first clinical workstation application. Medical clinics in Tier 2/3 cities frequently operate in environments with intermittent, unreliable, or zero continuous internet connectivity. A traditional cloud-based SaaS licensing system with frequent online heartbeats, centralized token refreshes, or remote kill switches would disrupt clinical operations during network outages.

At the same time, commercial software distribution requires:
1. A frictionless 60-day full-featured local evaluation trial upon initial workstation setup.
2. Tamper-evident commercial license tokens tied to clinic hardware.
3. Strict enforcement of the **Patient Data Retention Invariant**: Under no circumstance may license expiration lock out, encrypt, delete, or obstruct reading and exporting historical clinical records, prescriptions, or patient data.

## Decision
1. **Asymmetric RSA-SHA256 Digital Signatures**:
   - License tokens use the format `BASE64(PAYLOAD).BASE64(RSA_SHA256_SIGNATURE)`.
   - The desktop client embeds only the public verification key. The private key remains secure on offline license issuance servers.
   - Verification is 100% offline, instantaneous, and immune to DNS poisoning or network failure.
2. **Deterministic Hardware Fingerprinting**:
   - Hardware hashes are computed deterministically from workstation machine attributes (`os.hostname`, `os.platform`, `os.arch`, CPU models, total RAM) via SHA-256.
3. **Graceful Write-Lock on Expiration**:
   - When a trial or commercial license expires, write operations (`createPatient`, `createVisit`, `createPrescription`, `createSale`) are restricted with `LicenseExpiredError`.
   - All read, view, search, and export operations remain unrestricted forever.
4. **Developer Role Restriction**:
   - The Developer role (`role-developer`) is strictly denied `system.license.activate` permissions to prevent unauthorized tampering or bypass of clinic licensing.

## Consequences
- **Positive**: Zero downtime due to network outages; mathematically unforgeable license keys; full compliance with medical data retention ethics.
- **Trade-offs**: License renewals require clinic staff or owners to paste/input renewed license key strings into the settings interface.
