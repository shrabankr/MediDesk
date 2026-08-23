# IPC Architecture & Contract Standards

**Status:** CURRENT (Phase 1 Baseline)

---

## 1. IPC Invocation Flow

```
Renderer UI
     │  (e.g., window.mediDeskBridge.getSystemStatus())
     ▼
Preload Bridge (`contextBridge.exposeInMainWorld`)
     │  (ipcRenderer.invoke(IPC_CHANNELS.GET_SYSTEM_STATUS))
     ▼
Secure IPC Channel
     │
     ▼
Main Process Handler (`ipcMain.handle`)
     │
     ├─► Boundary Schema Validation (Zod)
     ├─► Authorization Context Check (RBACEngine)
     ├─► Application Service Execution
     ├─► SQLite Repository Interaction
     │
     ▼
Structured `IPCResponse<T>` returned to Renderer
```

---

## 2. Standard Response Structure

Every IPC request returns a structured response envelope:

```typescript
export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

## 3. Strict Boundary Rules

1. **NO Arbitrary SQL Execution:** No endpoint resembling `executeSQL(query)` is permitted.
2. **NO Shell / OS Execution:** No endpoint resembling `executeCommand(cmd)` is permitted.
3. **NO Arbitrary File System Access:** Renderer cannot request arbitrary file reads/writes.
4. **Input Validation:** All complex inputs must pass through Zod boundary parsers.
5. **Safe Error Masking:** Low-level database errors or stack traces are not leaked to the renderer in production.
