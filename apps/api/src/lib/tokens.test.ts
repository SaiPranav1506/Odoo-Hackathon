import { describe, it, expect } from 'vitest';
import { signAccessToken, createRefreshToken, verifyAccessToken, verifyRefreshToken, sha256 } from './tokens';

describe('access tokens', () => {
  it('signs and verifies with role claim', () => {
    const token = signAccessToken(42, 'HR');
    const payload = verifyAccessToken(token);
    expect(payload).toEqual({ sub: 42, role: 'HR' });
  });
  it('rejects garbage tokens', () => {
    expect(verifyAccessToken('not-a-token')).toBeNull();
  });
});

describe('refresh tokens', () => {
  it('creates a token and its hash matches sha256', () => {
    const { token, hash } = createRefreshToken(1);
    expect(sha256(token)).toBe(hash);
    const payload = verifyRefreshToken(token);
    expect(payload?.sub).toBe(1);
    expect(payload?.type).toBe('refresh');
  });
});

describe('cross-type protections', () => {
  it('does not treat a refresh token as an access token', () => {
    const { token } = createRefreshToken(1);
    expect(verifyAccessToken(token)).toBeNull();
  });
});