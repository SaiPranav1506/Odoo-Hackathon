import type { Request } from 'express';
import { AppError, httpError } from '../utils/apiError';

export interface AuthContext {
  userId: number;
  role: 'EMPLOYEE' | 'HR';
}

// Extracts the authenticated user, throwing if the middleware didn't populate it.
export function getAuth(req: Request): AuthContext {
  if (!req.userId || !req.role) {
    throw httpError.unauthorized('Authentication required');
  }
  return { userId: req.userId, role: req.role as 'EMPLOYEE' | 'HR' };
}

// HR may act on behalf of any employee (switch-into-view). Employees may act
// only on records they own. Encapsulates the horizontal-escalation guard.
export function canAccessEmployee(req: Request, recordUserId: number): boolean {
  const ctx = getAuth(req);
  if (ctx.role === 'HR') return true;
  return ctx.userId === recordUserId;
}

export function assertEmployeeAccess(req: Request, recordUserId: number): void {
  if (!canAccessEmployee(req, recordUserId)) {
    throw httpError.forbidden('You cannot access this employee\'s record');
  }
}

export { AppError };