import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/auth';
import * as service from './service';
import { getAuth } from '../../lib/authContext';

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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});
const forgotPasswordSchema = z.object({ email: z.string().email().max(254) });
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const authRouter = Router();

async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.signup(req.body);
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

authRouter.post('/auth/signup', authLimiter, validate({ body: signupSchema }), signup);
authRouter.post('/auth/login', authLimiter, validate({ body: loginSchema }), login);
authRouter.post('/auth/refresh', validate({ body: refreshSchema }), refresh);
authRouter.get('/auth/verify-email', validate({ query: verifySchema }), verifyEmail);
authRouter.post('/auth/resend-verification', requireAuth, resend);
authRouter.post('/auth/logout', requireAuth, logout);
authRouter.get('/auth/me', requireAuth, me);

// Password self-service.
authRouter.post('/auth/change-password', requireAuth, authLimiter, validate({ body: changePasswordSchema }), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    res.json(await service.changePassword(getAuth(req).userId, currentPassword, newPassword));
  } catch (e) {
    next(e);
  }
});
authRouter.post('/auth/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), async (req, res, next) => {
  try {
    res.json(await service.forgotPassword((req.body as { email: string }).email));
  } catch (e) {
    next(e);
  }
});
authRouter.post('/auth/reset-password', authLimiter, validate({ body: resetPasswordSchema }), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };
    res.json(await service.resetPassword(token, newPassword));
  } catch (e) {
    next(e);
  }
});