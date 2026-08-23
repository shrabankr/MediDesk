import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Electron Security Boundary Verification', () => {
  const mainIndexPath = path.resolve(__dirname, '../../apps/desktop/src/main/index.ts');
  const preloadIndexPath = path.resolve(__dirname, '../../apps/desktop/src/preload/index.ts');
  const htmlPath = path.resolve(__dirname, '../../apps/desktop/index.html');

  it('should enforce contextIsolation: true and nodeIntegration: false in BrowserWindow', () => {
    const mainContent = fs.readFileSync(mainIndexPath, 'utf-8');

    expect(mainContent).toContain('contextIsolation: true');
    expect(mainContent).toContain('nodeIntegration: false');
    expect(mainContent).toContain('sandbox: true');
    expect(mainContent).toContain('allowRunningInsecureContent: false');
  });

  it('should never expose dangerous APIs in Preload Bridge', () => {
    const preloadContent = fs.readFileSync(preloadIndexPath, 'utf-8');

    // Forbidden exposures
    expect(preloadContent).not.toContain('window.require');
    expect(preloadContent).not.toContain('executeSQL');
    expect(preloadContent).not.toContain('executeCommand');
    expect(preloadContent).not.toContain('fs.');
    expect(preloadContent).not.toContain('child_process');
    expect(preloadContent).not.toContain('electron.remote');

    // Required safe exposure
    expect(preloadContent).toContain('contextBridge.exposeInMainWorld');
  });

  it('should configure restrictive Content Security Policy in index.html', () => {
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    expect(htmlContent).toContain('http-equiv="Content-Security-Policy"');
    expect(htmlContent).toContain("default-src 'self'");
  });
});
