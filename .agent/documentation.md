# MediDesk Documentation Standards & ADR Guidelines

This document specifies documentation obligations, triggers for updating technical guides, and Architecture Decision Record (ADR) formats.

---

## 1. Documentation Update Triggers

AI agents MUST update technical and security documentation whenever changes involve:

| Change Category | Documentation Target |
| :--- | :--- |
| **System Architecture & Packaging** | `docs/technical/Architecture.md`, `docs/technical/Project-Structure.md` |
| **Database Schema & Migrations** | `docs/technical/Database-Design.md` |
| **RBAC Roles & Permissions** | `docs/technical/RBAC.md` |
| **Clinical EHR & Consultations** | `docs/technical/Clinical-Architecture.md`, `docs/security/Clinical-Data-Protection.md` |
| **Pharmacy & Inventory Billing** | `docs/technical/Pharmacy-Architecture.md`, `docs/security/Pharmacy-Data-Protection.md` |
| **Licensing & Trial Logic** | `docs/technical/Licensing-Architecture.md` |
| **Hybrid Backup & Disaster Recovery**| `docs/technical/Hybrid-Backup.md`, `docs/technical/Backup-and-Recovery.md` |
| **LAN & Multi-Computer Setup** | `docs/technical/LAN-Architecture.md`, `docs/technical/LAN-Deployment.md`, `docs/security/LAN-Security.md` |
| **Hardware & Document Printing** | `docs/technical/Printing-and-Hardware.md` |

---

## 2. Architecture Decision Records (ADRs)

Significant architectural decisions MUST be recorded in the `adr/` directory using sequential numbering:

```
adr/
├── ADR-001-Overall-Architecture.md
├── ADR-002-Electron.md
├── ...
├── ADR-020-Hybrid-Backup-Architecture.md
├── ADR-021-LAN-Multi-Computer-Architecture.md
└── ADR-XXX-<Short-Title>.md
```

### Standard ADR Structure:

```markdown
# ADR-XXX: Title of Decision

## Status
[PROPOSED | ACCEPTED | SUPERSEDED]

## Context
Background of the problem, operational requirements, constraints, and business context.

## Decision
Clear, direct statement of the architectural pattern, library, or protocol selected.

## Consequences
### Positive
- Specific benefits and guarantees gained.

### Negative / Trade-offs
- Technical limitations, operational costs, or constraints introduced.

### Security & Invariants
- Enforced security controls, threat mitigations, and data protections.
```

---

## 3. Walkthrough & Implementation Artifacts

- For every development phase or major refactor, create or update `walkthrough.md` in the artifact directory.
- Walkthroughs must detail:
  1. Summary of completed work.
  2. Exact command verification results (`typecheck`, `lint`, `test`, `build`).
  3. Security and architectural invariants confirmed.
  4. List of modified and created files with links.
