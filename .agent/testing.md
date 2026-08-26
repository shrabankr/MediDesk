# MediDesk Testing & Quality Assurance Guidelines

This document specifies mandatory testing requirements, test structure, verification commands, and verification reporting rules.

---

## 1. Required Verification Commands

Every phase, feature, or bugfix verification requires running the following 4 commands in sequence:

```bash
# 1. Static Type Checking
npm run typecheck

# 2. Code Linting & Static Analysis
npm run lint

# 3. Automated Test Suite Execution
npm test

# 4. Production Application Build
npm run build
```

---

## 2. Verification Reporting Format

AI agents MUST report verification results in the standard summary format:

```
======================================================================
COMMAND EXECUTION SUMMARY
======================================================================
1. npm run typecheck
   Exit Code : 0
   Result    : PASS (0 errors across monorepo and apps)

2. npm run lint
   Exit Code : 0
   Result    : PASS (0 errors, N warnings)

3. npm test
   Exit Code : 0
   Suites    : X passed (X total)
   Tests     : Y passed (Y total, 0 failed)

4. npm run build
   Exit Code : 0
   Result    : PASS (Renderer, Main, and Preload bundles built cleanly)
======================================================================
```

**STRICT RULE:** Never claim `PASS` unless the command completed with exit code 0.

---

## 3. Test Suite Organization

Tests are structured into three distinct categories:

```
tests/
├── unit/            # Fast, isolated unit tests for services, hashing, RBAC, domain rules
├── integration/     # Database repositories, migrations, full system lifecycles, LAN lifecycle
└── security/        # Electron window isolation, Developer role boundaries, HMAC validation
```

### Test Categorization Rules:
1. **Unit Tests (`tests/unit/`):**
   - Must mock external I/O where appropriate or use isolated in-memory/temp SQLite instances.
   - Verify domain invariants, validation rules, stock deductions, encryption, and licensing algorithms.
2. **Integration Tests (`tests/integration/`):**
   - Exercise SQLite repository operations, multi-migration schema updates, backup/restore cycles, and LAN client/server communication.
3. **Security Tests (`tests/security/`):**
   - Explicitly verify security boundaries: Developer role data isolation, Electron sandbox settings, invalid PIN/token rejections, and anti-replay protections.

---

## 4. Test Development Rules for AI Agents

1. **Add Tests for New Features:** Every new service method, entity, or IPC channel requires corresponding unit and integration tests.
2. **Never Weaken Assertions:** Never delete, skip, or weaken a test assertion to mask a regression or architectural defect.
3. **Deterministic & Isolated Tests:** Tests must create isolated SQLite databases in temporary directories and clean up file descriptors after execution.
