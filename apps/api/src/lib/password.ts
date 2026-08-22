import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Password policy: min 8 chars with at least one uppercase, lowercase,
 * digit, and symbol. Returns list of failure reasons (empty = valid).
 */
export function passwordIssues(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('must be at least 8 characters long');
  if (!/[A-Z]/.test(password)) issues.push('must contain an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('must contain a lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('must contain a number');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('must contain a symbol');
  return issues;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}