# Electron Architecture & Security Baseline

**Status:** CURRENT (Phase 1 Baseline)

---

## 1. Process Separation Model

MediDesk adheres strictly to Electron process isolation principles:

```
+-------------------------------------------------------------+
|               Renderer Process (Untrusted UI)               |
|  - React 18 UI components                                   |
|  - Strictly isolated from Node.js runtime                   |
|  - Communicates solely through window.mediDeskBridge        |
+-------------------------------------------------------------+
                              |
                              | Context Bridge
                              v
+-------------------------------------------------------------+
|                 Preload Script (Bridge Layer)               |
|  - Minimal and explicit API surface                         |
|  - Exposes typed functions via contextBridge                |
|  - No Node modules or handles leaked to global window       |
+-------------------------------------------------------------+
                              |
                              | IPC Invocation
                              v
+-------------------------------------------------------------+
|                  Main Process (Trusted Node)                |
|  - Native Windows Integration & Hardware Printing           |
|  - SQLite Database Execution & Migrations                   |
|  - Local File System Access & AppData Resolution            |
|  - Secret Storage & Cryptographic Hashing                   |
+-------------------------------------------------------------+
```

---

## 2. Electron Security Configuration

| Setting | Configuration | Rationale |
| :--- | :--- | :--- |
| `contextIsolation` | `true` | Prevents renderer scripts from accessing Node internals or prototype pollution. |
| `nodeIntegration` | `false` | Completely disables `require`, `process`, and `Buffer` in the renderer. |
| `sandbox` | `true` | Restricts renderer execution to Chromium OS sandbox. |
| `webSecurity` | `true` | Enforces same-origin policy and blocks insecure mixed content. |
| `allowRunningInsecureContent` | `false` | Blocks HTTP resources in HTTPS / secure contexts. |
| `Content-Security-Policy` | Enforced | Strict CSP header applied to all sessions and pages. |
| `Navigation Handler` | Restrictive | Blocks navigation to arbitrary external web destinations. |
| `Window Open Handler` | Denied | Denies opening uncontrolled new popup windows. |
