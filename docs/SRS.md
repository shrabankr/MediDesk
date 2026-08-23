# MediDesk System Requirements Specification (SRS)

**Document Version:** 2.0  
**Phase:** Phase 1 (Foundation Baseline)

---

## 1. Introduction

MediDesk is an offline-first Clinical and Pharmacy Management System built for single-clinic environments transitioning to multi-terminal LAN and cloud SaaS.

---

## 2. Overall Description

### 2.1 Deployment Target
- **Primary:** Windows 10/11 Desktop
- **Architecture:** Single-PC local installation, 100% offline-capable for clinical and billing operations.
- **Future Targets:** Multi-PC LAN (Phase 8), Multi-tenant Cloud SaaS (Phase 9).

### 2.2 User Roles & Authority Separation
- **OWNER:** Clinic business and administrative authority. Controls user accounts, clinical policies, pharmacy pricing, and financial audits.
- **DOCTOR:** Medical practitioner authority. Clinical consultation, patient history, and electronic prescription writing.
- **STAFF:** Operational and pharmacy dispensary staff. Patient check-in, POS billing, and medicine dispensing.
- **DEVELOPER:** Technical and infrastructure authority. Database migrations, diagnostics, technical configuration, and local backup execution.
  *CRITICAL RULE:* Developer does NOT possess clinical, patient, pharmacy, or financial data access rights. No `SUPER_ADMIN` universal bypass exists.

---

## 3. System Features & Phased Scope

| Feature ID | Scope Description | Target Phase | Implementation Status |
| :--- | :--- | :--- | :--- |
| **REQ-F-001** | Electron Main-Preload-Renderer Isolation | Phase 1 | `CURRENT` |
| **REQ-F-002** | SQLite Local Storage with WAL & FKs | Phase 1 | `CURRENT` |
| **REQ-F-003** | Versioned Database Migration Engine | Phase 1 | `CURRENT` |
| **REQ-F-004** | RBAC Model & Engine | Phase 1 | `CURRENT` |
| **REQ-F-005** | Structured Audit Logging | Phase 1 | `CURRENT` |
| **REQ-F-006** | Secure Password Hashing (Scrypt) | Phase 1 | `CURRENT` |
| **REQ-F-007** | First-Run Setup Wizard & Auth Login | Phase 2 | `PLANNED` |
| **REQ-F-008** | Patient Demographics & Appointments | Phase 3 | `FUTURE` |
| **REQ-F-009** | Clinical Consultation & Rx Generator | Phase 4 | `FUTURE` |
| **REQ-F-010** | Pharmacy Inventory & POS Billing | Phase 5 | `FUTURE` |
| **REQ-F-011** | Hardware Printing & Google Drive Backup | Phase 6 | `FUTURE` |
| **REQ-F-012** | Multi-PC Local Area Network (PostgreSQL) | Phase 8 | `FUTURE` |
| **REQ-F-013** | SaaS Cloud Multi-Tenancy | Phase 9 | `FUTURE` |
