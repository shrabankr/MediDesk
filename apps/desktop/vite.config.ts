import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

/**
 * Vite plugin that blocks non-Electron browser access to the dev server.
 *
 * The Electron renderer identifies itself with a User-Agent containing
 * "Electron/". WebSocket upgrade requests (used for HMR) are always
 * allowed. Any plain browser (Chrome, Edge, etc.) receives a styled
 * HTML page explaining how to open the desktop application.
 */
function electronOnlyDevServerPlugin(): Plugin {
  return {
    name: 'medidesk:electron-only-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Allow WebSocket upgrades (Vite HMR) regardless of user-agent
        if (req.headers.upgrade === 'websocket') {
          return next();
        }
        const ua = req.headers['user-agent'] ?? '';
        // Electron renderer always includes "Electron/" in the UA string
        if (ua.includes('Electron/')) {
          return next();
        }
        // Block all other browser requests with a clear HTML message
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MediDesk — Desktop App Required</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #020617; color: #e2e8f0; min-height: 100vh;
      display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    }
    .card {
      background: #1e293b; border: 1px solid #334155; border-radius: 1.25rem;
      padding: 2.5rem 2rem; max-width: 520px; width: 100%; text-align: center;
    }
    .icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 5rem; height: 5rem; border-radius: 1.25rem;
      background: rgba(20,184,166,.1); border: 1px solid rgba(20,184,166,.2);
      margin-bottom: 1.5rem;
    }
    h1 { font-size: 1.375rem; font-weight: 700; color: #f8fafc; margin-bottom: .5rem; }
    .sub { color: #94a3b8; font-size: .875rem; margin-bottom: 1.75rem; }
    .amber { color: #fbbf24; font-weight: 600; }
    .inner { background: #0f172a; border: 1px solid #334155; border-radius: .875rem; padding: 1.25rem; text-align: left; }
    .label { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; color: #64748b; font-weight: 600; margin-bottom: .6rem; }
    ol { padding-left: 1.2rem; color: #cbd5e1; font-size: .875rem; line-height: 1.9; }
    .path {
      margin-top: .875rem; background: #020617; border: 1px solid #1e293b;
      border-radius: .5rem; padding: .625rem .875rem;
      font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      font-size: .78rem; color: #2dd4bf; word-break: break-all;
    }
    footer { margin-top: 1.75rem; font-size: .72rem; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6
             11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623
             5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152
             c-3.196 0-6.1-1.248-8.25-3.285z"/>
      </svg>
    </div>
    <h1>MediDesk Desktop App Required</h1>
    <p class="sub">
      You are viewing MediDesk in a <span class="amber">web browser</span>.
      Login is not available here.
    </p>
    <div class="inner">
      <p class="label">How to open MediDesk correctly</p>
      <ol>
        <li>Open <strong>File Explorer</strong> on your Windows PC</li>
        <li>Navigate to your MediDesk project folder</li>
        <li>Double-click <strong>MediDesk.exe</strong></li>
      </ol>
      <div class="path">apps\\desktop\\release\\win-unpacked\\MediDesk.exe</div>
    </div>
    <p class="footer">MediDesk Clinical &amp; Pharmacy Management &bull; Offline Desktop Application</p>
  </div>
</body>
</html>`);
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    electronOnlyDevServerPlugin(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['better-sqlite3']
            }
          },
          resolve: {
            alias: {
              '@medidesk/domain': path.resolve(__dirname, '../../packages/domain/src'),
              '@medidesk/authorization': path.resolve(__dirname, '../../packages/authorization/src'),
              '@medidesk/validation': path.resolve(__dirname, '../../packages/validation/src'),
              '@medidesk/database': path.resolve(__dirname, '../../packages/database/src'),
              '@medidesk/audit': path.resolve(__dirname, '../../packages/audit/src'),
              '@medidesk/backup': path.resolve(__dirname, '../../packages/backup/src'),
              '@medidesk/printing': path.resolve(__dirname, '../../packages/printing/src'),
              '@medidesk/licensing': path.resolve(__dirname, '../../packages/licensing/src'),
              '@medidesk/shared': path.resolve(__dirname, '../../packages/shared/src'),
              '@medidesk/ui': path.resolve(__dirname, '../../packages/ui/src'),
              '@medidesk/application': path.resolve(__dirname, '../../packages/application/src'),
              '@medidesk/lan': path.resolve(__dirname, '../../packages/lan/src')
            }
          }
        }
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'index.cjs',
                inlineDynamicImports: true
              }
            }
          },
          resolve: {
            alias: {
              '@medidesk/shared': path.resolve(__dirname, '../../packages/shared/src'),
              '@medidesk/domain': path.resolve(__dirname, '../../packages/domain/src')
            }
          }
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@medidesk/domain': path.resolve(__dirname, '../../packages/domain/src'),
      '@medidesk/authorization': path.resolve(__dirname, '../../packages/authorization/src'),
      '@medidesk/validation': path.resolve(__dirname, '../../packages/validation/src'),
      '@medidesk/database': path.resolve(__dirname, '../../packages/database/src'),
      '@medidesk/audit': path.resolve(__dirname, '../../packages/audit/src'),
      '@medidesk/backup': path.resolve(__dirname, '../../packages/backup/src'),
      '@medidesk/printing': path.resolve(__dirname, '../../packages/printing/src'),
      '@medidesk/licensing': path.resolve(__dirname, '../../packages/licensing/src'),
      '@medidesk/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@medidesk/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@medidesk/application': path.resolve(__dirname, '../../packages/application/src'),
      '@medidesk/lan': path.resolve(__dirname, '../../packages/lan/src')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  }
});

