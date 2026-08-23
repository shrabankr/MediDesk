import { describe, it, expect } from 'vitest';
import { ScryptPasswordHasher } from '@medidesk/application';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('should hash a password and verify it correctly', async () => {
    const rawPassword = 'CorrectDoctorPassword#2026';
    const hash = await hasher.hash(rawPassword);

    expect(hash).toContain('scrypt$');
    expect(hash.split('$').length).toBe(4);

    const isMatch = await hasher.verify(rawPassword, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await hasher.verify('WrongPassword123!', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('should produce unique salts and hashes for the same password', async () => {
    const pwd = 'SamePasswordEveryTime1!';
    const hash1 = await hasher.hash(pwd);
    const hash2 = await hasher.hash(pwd);

    expect(hash1).not.toEqual(hash2);
    expect(await hasher.verify(pwd, hash1)).toBe(true);
    expect(await hasher.verify(pwd, hash2)).toBe(true);
  });
});
