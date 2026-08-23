# ADR-012: Electron Security Baseline and IPC Hardening

## Status
Accepted (`CURRENT`)

## Context
Electron desktop applications that do not enforce strict isolation are vulnerable to remote code execution (RCE), arbitrary file access, and process hijacking via XSS or malicious third-party scripts.

## Decision
Enforce the following mandatory security controls across the desktop application:
1. `contextIsolation: true` in BrowserWindow webPreferences.
2. `nodeIntegration: false` in BrowserWindow webPreferences.
3. `sandbox: true` enabled.
4. Restrictive Content Security Policy (CSP) headers applied to all renderer sessions.
5. Minimal, explicit Preload bridge (`contextBridge.exposeInMainWorld`).
6. Complete prohibition of `window.require`, `executeSQL(sql)`, `executeCommand(cmd)`, or arbitrary file read/write IPC channels.
7. Navigation and popup handlers strictly block unauthorized external URL redirects.

## Consequences
- The renderer is treated as an untrusted client, preventing security compromise of the host operating system.
