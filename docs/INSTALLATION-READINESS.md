# MediDesk — Windows Installation & Packaging Readiness Guide

**Document Version:** 1.0  
**Target Platform:** Windows 10 & Windows 11 (64-bit Architecture)  
**Package Formats:** NSIS Standard Installer (`.exe`) & Standalone Portable Executable (`.exe`)  
**Configuration File:** `apps/desktop/electron-builder.json`

---

## 1. Installer Architecture & Build Specifications

### Electron-Builder Configuration Overview:
- **Application ID:** `com.medidesk.desktop`
- **Product Name:** `MediDesk`
- **Output Directory:** `apps/desktop/release/`
- **Output Artifact Naming:** `MediDesk-Setup-${version}-x64.exe` and `MediDesk-${version}-x64.exe` (Portable)
- **Installer Type:** NSIS (Nullsoft Scriptable Install System)

```json
{
  "appId": "com.medidesk.desktop",
  "productName": "MediDesk",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "package.json",
    "node_modules/**/*",
    "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
    "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
    "!**/node_modules/*.d.ts",
    "!**/node_modules/.bin",
    "!**/*.{o,h,c,hpp,cpp,m}"
  ],
  "extraResources": [
    {
      "from": "../../database/migrations",
      "to": "database/migrations",
      "filter": ["*.sql"]
    }
  ],
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64"] },
      { "target": "portable", "arch": ["x64"] }
    ],
    "artifactName": "${productName}-Setup-${version}-${arch}.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "deleteAppDataOnUninstall": false
  }
}
```

---

## 2. Native C++ Dependency Handling (`better-sqlite3`)

1. **Compilation Lifecycle:**
   - Pre-build script executes `electron-rebuild -f -w better-sqlite3` targeting the bundled Electron Node ABI version.
   - Packaging bundles the compiled binary (`better_sqlite3.node`) directly into `node_modules/better-sqlite3/build/Release/`.
2. **Runtime Verification:**
   - In packaged production, Electron loads the pre-compiled native binding without requiring Python or Visual C++ Build Tools on the target clinic PC.

---

## 3. Storage & Migration Directory Resolution

### A. Database Location:
- Production database path defaults to:
  `%APPDATA%\MediDesk\medidesk.sqlite` (`app.getPath('userData')`).
- Write-Ahead Logging generates `%APPDATA%\MediDesk\medidesk.sqlite-wal` and `medidesk.sqlite-shm`.

### B. Migrations Directory Resolution:
- Main process dynamically resolves migrations directory:
  ```typescript
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'database', 'migrations')
    : path.resolve(__dirname, '../../../../database/migrations');
  ```
- `extraResources` copies all SQL files (`001_initial_schema.sql` through `009_phase9_inventory_reconciliation.sql`) into the application resources bundle.

---

## 4. First-Run & Reinstall Behavior

1. **Fresh Installation:**
   - `MigrationRunner` executes all pending migrations sequentially.
   - `SystemInitializationService` detects zero organizations and triggers the interactive **Setup Wizard**.
2. **Reinstallation / Upgrade:**
   - `nsis.deleteAppDataOnUninstall: false` ensures uninstalling the application does **NOT** delete the database or local backups in `%APPDATA%\MediDesk\`.
   - Installing a newer version automatically detects existing data, runs any newly added incremental migrations (`009`, `010`, etc.) inside atomic transactions, and launches directly into the authenticated login screen.

---

## 5. Code Signing & Release Checklist

To build and package a production-ready installer:

1. **Generate Assets:**
   - Place 256x256 multi-layer `icon.ico` in `apps/desktop/build/icon.ico`.
2. **Build Distribution Packages:**
   ```bash
   npm run build
   npm run package:win
   ```
3. **Sign Executables (Production CI/CD):**
   - Apply Windows Authenticode Code Signing Certificate:
   ```bash
   signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "apps/desktop/release/MediDesk-Setup-1.0.0-x64.exe"
   ```
4. **Deploy:**
   - Distribute the signed `MediDesk-Setup-1.0.0-x64.exe` to clinic workstations.
