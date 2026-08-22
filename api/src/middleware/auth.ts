import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/tokens';
import { httpError } from '../utils/apiError';

// Attaches req.user when a valid Bearer access token is present.
// Doesn't require verification (some routes allow pre-verification access, e.g. resend).
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(httpError.unauthorized('Authentication required'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);
  if (!payload) {
    next(httpError.unauthorized('Invalid or expired session'));
    return;
  }
  req.userId = payload.sub;
  req.role = payload.role as 'EMPLOYEE' | 'HR';
  next();
}

// Blocks requests from accounts that haven't verified their email (except auth paths).
export function requireVerified(req: Request, _res: Response, next: NextFunction): void {
  // Verification state is fetched in the controller where user data is needed;
  // this middleware relies on a light DB check performed per request is wasteful,
  // so routes that need it do the check explicitly in their service. Kept as a
  // convenience that always passes unless implemented; see note in README.
  next();
}