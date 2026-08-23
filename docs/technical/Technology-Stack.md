# MediDesk Technology Stack

**Document Version:** 1.0.0  
**Phase:** Phase 1 (Foundation)

---

## Approved Technology Stack Matrix

| Layer / Concern | Approved Technology | Version | Purpose & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop Runtime** | Electron.js | `^33.2.1` | Native Windows 10/11 desktop runtime with hardware access | `CURRENT` |
| **Frontend UI** | React | `^18.3.1` | Declarative, component-driven reactive renderer | `CURRENT` |
| **Language** | TypeScript | `^5.6.3` | Full strict-mode type safety across all packages | `CURRENT` |
| **Bundler & Dev Server** | Vite | `^6.0.1` | Lightning-fast HMR and optimized production builds | `CURRENT` |
| **Database** | SQLite via better-sqlite3 | `^11.7.0` | Fast, embedded, single-file ACID local storage | `CURRENT` |
| **CSS & Styling** | Tailwind CSS | `^3.4.15` | Utility-first, responsive, dark-mode ready design system | `CURRENT` |
| **UI Components** | Accessible Primitives | `1.0.0` | Reusable Button, Card, Badge, and StatusIndicator components | `CURRENT` |
| **Validation** | Zod | `^3.23.8` | Runtime schema parsing at external boundaries (IPC, Auth) | `CURRENT` |
| **Testing** | Vitest & Playwright | `^2.1.8` / `^1.49.0` | Fast unit/integration tests and desktop E2E harnesses | `CURRENT` |
| **Packaging** | Electron Builder | `^25.1.8` | Windows NSIS installer and portable executable generation | `CURRENT` |
| **Password Hashing** | Node Crypto Scrypt | Native | Modern memory-hard key derivation algorithm | `CURRENT` |
| **Cloud Database** | PostgreSQL | Future | Backend persistence for multi-PC LAN & SaaS | `FUTURE` |
| **Cloud Backup** | Google Drive API | Future | Optional encrypted cloud backup replication | `FUTURE` |
