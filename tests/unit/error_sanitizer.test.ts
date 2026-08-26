import { describe, it, expect } from 'vitest';
import { ErrorSanitizerService } from '@medidesk/application';

describe('Phase 8H: ErrorSanitizerService & Production Safety', () => {
  it('sanitizes SQLite lock error into user-friendly message', () => {
    const rawError = new Error('SQLITE_BUSY: database is locked in transaction BEGIN IMMEDIATE');
    const sanitized = ErrorSanitizerService.sanitize(rawError, 'corr-101');

    expect(sanitized.userMessage).toContain('currently processing another transaction');
    expect(sanitized.userMessage).not.toContain('SQLITE_BUSY');
    expect(sanitized.userMessage).not.toContain('BEGIN IMMEDIATE');
    expect(sanitized.technicalDetails?.category).toBe('DATABASE_BUSY');
    expect(sanitized.technicalDetails?.correlationId).toBe('corr-101');
  });

  it('sanitizes expired batch error into clear safety message', () => {
    const rawError = new Error('ExpiredBatchSaleError: Batch AMX-2025 expired on 2025-12-31');
    const sanitized = ErrorSanitizerService.sanitize(rawError);

    expect(sanitized.userMessage).toContain('The selected batch has expired');
    expect(sanitized.technicalDetails?.category).toBe('SAFETY_EXPIRED_BATCH');
  });

  it('sanitizes insufficient stock error', () => {
    const rawError = new Error('Insufficient stock available for requested quantity');
    const sanitized = ErrorSanitizerService.sanitize(rawError);

    expect(sanitized.userMessage).toContain('Insufficient inventory stock');
    expect(sanitized.technicalDetails?.category).toBe('INVENTORY_STOCK');
  });

  it('sanitizes LAN connection error', () => {
    const rawError = new Error('ECONNREFUSED: LAN server unavailable on port 4848');
    const sanitized = ErrorSanitizerService.sanitize(rawError);

    expect(sanitized.userMessage).toContain('Unable to communicate with the main clinic server');
    expect(sanitized.userMessage).not.toContain('4848');
    expect(sanitized.technicalDetails?.category).toBe('NETWORK_LAN');
  });
});
