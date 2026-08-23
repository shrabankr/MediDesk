import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'tests/**/*.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@medidesk/domain': path.resolve(__dirname, 'packages/domain/src'),
      '@medidesk/authorization': path.resolve(__dirname, 'packages/authorization/src'),
      '@medidesk/validation': path.resolve(__dirname, 'packages/validation/src'),
      '@medidesk/database': path.resolve(__dirname, 'packages/database/src'),
      '@medidesk/audit': path.resolve(__dirname, 'packages/audit/src'),
      '@medidesk/backup': path.resolve(__dirname, 'packages/backup/src'),
      '@medidesk/printing': path.resolve(__dirname, 'packages/printing/src'),
      '@medidesk/licensing': path.resolve(__dirname, 'packages/licensing/src'),
      '@medidesk/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@medidesk/ui': path.resolve(__dirname, 'packages/ui/src'),
      '@medidesk/application': path.resolve(__dirname, 'packages/application/src')
    }
  }
});
