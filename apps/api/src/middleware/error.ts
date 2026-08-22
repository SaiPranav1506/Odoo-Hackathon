import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/apiError';
import { isDev } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { message: 'Route not found' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
    return;
  }

  // Zod errors are normalized in the validate middleware, but handle strays defensively.
  if (
    err &&
    typeof err === 'object' &&
    'issues' in err &&
    Array.isArray((err as { issues?: unknown[] }).issues)
  ) {
    res.status(422).json({ error: { message: 'Validation failed', details: (err as { issues: unknown[] }).issues } });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { message: 'Internal server error', ...(isDev ? { details: String(err) } : {}) },
  });
}