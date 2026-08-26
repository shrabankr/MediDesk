import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
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
            outDir: 'dist/preload'
          },
          resolve: {
            alias: {
              '@medidesk/shared': path.resolve(__dirname, '../../packages/shared/src')
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
