import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/auth';
import * as service from './service';
import { getAuth } from '../../lib/authContext';
import { httpError } from '../../utils/apiError';

const signupSchema = z.object({
  employeeId: z.string().min(1).max(30),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(['EMPLOYEE', 'HR']),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });
const verifySchema = z.object({ token: z.string().min(1) });

export type SignupBody = z.infer<typeof signupSchema>;

async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.signup(req.body as SignupBody);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
}

async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const token = String((req.query as { token?: string }).token ?? '');
    res.json(await service.verifyEmail(token));
  } catch (e) {
    next(e);
  }
}

async function resend(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.resendVerification(getAuth(req).userId));
  } catch (e) {
    next(e);
  }
}

async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    res.json(await service.login(email, password));
  } catch (e) {
    next(e);
  }
}

async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.refresh((req.body as { refreshToken: string }).refreshToken));
  } catch (e) {
    next(e);
  }
}

async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = getAuth(req);
    const refreshToken = (req.body as { refreshToken?: string }).refreshToken ?? '';
    await service.logout(ctx.userId, refreshToken);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

async function me(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ user: await service.me(getAuth(req).userId) });
  } catch (e) {
    next(e);
  }
}

export const registerAuthRoutes = (router: { post: (p: string, ...h: unknown[]) => unknown }): void => {
  router.post('/auth/signup', authLimiter, validate({ body: signupSchema }), signup as never);
  router.post('/auth/login', authLimiter, validate({ body: loginSchema }), login as never);
  router.post('/auth/refresh', validate({ body: refreshSchema }), refresh as never);
  router.get('/auth/verify-email', validate({ query: verifySchema }), verifyEmail as never);
  router.post('/auth/resend-verification', requireAuth, resend as never);
  router.post('/auth/logout', requireAuth, logout as never);
  router.get('/auth/me', requireAuth, me as never);
};