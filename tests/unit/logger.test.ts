import { describe, it, expect } from 'vitest';
import { Logger } from '@medidesk/shared';

describe('Structured Logger & Secret Sanitization', () => {
  const logger = new Logger('TestLogger');

  it('should redact sensitive keys from log metadata', () => {
    const sensitivePayload = {
      username: 'clinician_1',
      password: 'SuperSecretPassword',
      passwordHash: '$scrypt$...',
      token: 'jwt.token.here',
      privateKey: '---PRIVATE KEY---',
      nested: {
        developerToken: 'dev-token-xyz',
        clinicName: 'MediClinic'
      }
    };

    const sanitized = logger.sanitize(sensitivePayload) as Record<string, unknown>;

    expect(sanitized.username).toBe('clinician_1');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.passwordHash).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.privateKey).toBe('[REDACTED]');

    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.developerToken).toBe('[REDACTED]');
    expect(nested.clinicName).toBe('MediClinic');
  });
});
