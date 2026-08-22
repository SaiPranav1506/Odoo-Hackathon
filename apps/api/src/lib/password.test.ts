import { describe, it, expect } from 'vitest';
import { passwordIssues, hashPassword, verifyPassword } from './password';

describe('passwordIssues', () => {
  it('accepts a strong password', () => {
    expect(passwordIssues('StrongPass1!')).toEqual([]);
  });
  it('rejects short passwords', () => {
    expect(passwordIssues('Aa1!')).toContain('must be at least 8 characters long');
  });
  it('requires uppercase, lowercase, number and symbol', () => {
    expect(passwordIssues('aaaaaaaa')).toContain('must contain an uppercase letter');
    expect(passwordIssues('AAAAAAAa')).toContain('must contain a number');
    expect(passwordIssues('AAAAaaa12')).toContain('must contain a symbol');
    expect(passwordIssues('AAAAAAA1!')).toContain('must contain a lowercase letter');
  });
});

describe('hash + verify', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('CorrectHorse1!');
    expect(hash).not.toContain('CorrectHorse1!');
    expect(await verifyPassword('CorrectHorse1!', hash)).toBe(true);
    expect(await verifyPassword('WrongPass1!', hash)).toBe(false);
  });
  it('produces unique salts', async () => {
    const a = await hashPassword('SamePass1!');
    const b = await hashPassword('SamePass1!');
    expect(a).not.toEqual(b);
  });
});