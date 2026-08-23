# ADR-002: Electron Desktop Runtime & Separation

## Status
Accepted (`CURRENT`)

## Context
A rich desktop experience is required for Windows 10/11 with direct hardware integration (ESC/POS thermal receipt printers, laser prescription printers, and local storage).

## Decision
Use Electron.js with strict process separation:
- Main Process manages native OS resources, SQLite, and printing.
- Preload Bridge exposes only typed, whitelisted IPC functions.
- React Renderer runs in an untrusted sandbox with zero direct Node.js or filesystem access.

## Consequences
- Protects against malicious renderer exploits and provides standard cross-platform desktop packaging.
