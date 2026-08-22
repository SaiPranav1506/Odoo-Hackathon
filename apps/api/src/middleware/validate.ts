import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject } from 'zod';
import { httpError } from '../utils/apiError';

// Validates and REPLACES req.body/req.query with the parsed (sanitized) values.
// Unknown keys are stripped, sizes/lengths enforced by the schemas.
export function validate(schemas: { body?: AnyZodObject; query?: AnyZodObject; params?: AnyZodObject }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      if (schemas.query) {
        const result = schemas.query.parse(req.query);
        req.query = result as Request['query'];
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (e) {
      const issues = (e as { issues?: unknown[] }).issues ?? [];
      next(httpError.validation(issues));
      return;
    }
  };
}