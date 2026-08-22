export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const httpError = {
  badRequest: (msg = 'Bad request', details?: unknown) => new AppError(400, msg, details),
  unauthorized: (msg = 'Unauthorized') => new AppError(401, msg),
  forbidden: (msg = 'Forbidden') => new AppError(403, msg),
  notFound: (msg = 'Not found') => new AppError(404, msg),
  conflict: (msg = 'Conflict') => new AppError(409, msg),
  validation: (details: unknown) => new AppError(422, 'Validation failed', details),
  notImplemented: (msg = 'Not implemented') => new AppError(501, msg),
};