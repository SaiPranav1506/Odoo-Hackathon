import type { NextFunction, Request, Response } from 'express';
import { httpError } from '../utils/apiError';

export type Role = 'EMPLOYEE' | 'HR';

// Authz boundary: rejects unless the authenticated user holds one of the allowed roles.
// Always used AFTER requireAuth so req.role is populated.
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.role && allowed.includes(req.role)) {
      next();
      return;
    }
    next(httpError.forbidden('You do not have permission to perform this action'));
  };
}