import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: number; // userId
  role: string;
}

export interface RefreshTokenPayload {
  sub: number;
  type: 'refresh';
  jti: string; // token id so a hash can be stored at rest
}

export function signAccessToken(userId: number, role: string): string {
  return jwt.sign({ sub: userId, role } as AccessTokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

// Returns the raw refresh token AND its sha256 hash (stored, revocable).
export function createRefreshToken(userId: number): { token: string; hash: string } {
  const jti = randomBytes(24).toString('hex');
  const token = jwt.sign(
    { sub: userId, type: 'refresh', jti } as RefreshTokenPayload,
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'] },
  );
  return { token, hash: sha256(token) };
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload & { type?: string };
    if (payload.type === 'refresh') return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as RefreshTokenPayload;
    if (payload.type !== 'refresh') return null;
    return payload;
  } catch {
    return null;
  }
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Single-use opaque verification token for email activation.
export function createVerificationToken(): { token: string; expiry: Date } {
  const token = randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  return { token, expiry };
}