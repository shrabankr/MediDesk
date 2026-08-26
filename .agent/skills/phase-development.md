# Operational Skill: Phase Development Template

Use this standard operational workflow when executing approved project phases in MediDesk.

---

## Standard Phase Execution Workflow

```
1. DISCOVERY & RESEARCH
   ├── Inspect codebase, existing ADRs, SRS requirements, and package boundaries.
   └── Verify all previous phases remain fully frozen and unbroken.

2. IMPLEMENTATION PLANNING
   ├── Draft comprehensive implementation plan covering:
   │   ├── Domain entities & Repository contracts
   │   ├── Database schema migrations & permissions
   │   ├── Service orchestration & business rules
   │   ├── Validation schemas (Zod) & IPC contracts
   │   ├── Preload bridge & Renderer React UI
   │   └── Unit, integration, and security test plans.
   └── Set RequestFeedback=true and present plan to user.

3. EXPLICIT APPROVAL GATE
   └── STOP and wait for explicit user approval before modifying code.

4. STEPWISE IMPLEMENTATION
   ├── Step A: Domain entities, repository interfaces, validation schemas.
   ├── Step B: Database migration SQL and concrete SQLite repositories.
   ├── Step C: Application orchestration services and RBAC enforcement.
   ├── Step D: IPC handlers, preload bridge methods, React UI views.
   └── Step E: Error handling, logging, and edge case mitigation.

5. TEST-DRIVEN VERIFICATION
   ├── Write unit tests for services, business rules, and error conditions.
   ├── Write integration tests for SQLite repositories and migrations.
   └── Write security tests verifying role isolation and authorization denial.

6. DOCUMENTATION & ADRs
   ├── Author Architecture Decision Records (ADRs) in adr/.
   ├── Update technical guides in docs/technical/ and docs/security/.
   └── Update walkthrough.md with step-by-step verification.

7. FULL COMMAND VERIFICATION
   ├── npm run typecheck (Exit Code 0)
   ├── npm run lint (Exit Code 0)
   ├── npm test (Exit Code 0, 100% passing)
   └── npm run build (Exit Code 0)

8. FINAL REPORT & MANDATORY STOP
   ├── Present complete verification report to user.
   └── STOP. Do NOT proceed to the next phase without explicit approval.
```
