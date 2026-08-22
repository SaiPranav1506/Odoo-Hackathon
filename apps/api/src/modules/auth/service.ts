import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword, passwordIssues } from '../../lib/password';
import {
  signAccessToken,
  createRefreshToken,
  createVerificationToken,
  verifyRefreshToken,
  sha256,
} from '../../lib/tokens';
import { env } from '../../config/env';
import { sendMail, buildVerificationEmail } from '../../lib/mailer';
import { AppError, httpError } from '../../utils/apiError';
import { isDev } from '../../config/env';

export interface SignupInput {
  employeeId: string;
  email: string;
  password: string;
  role: 'EMPLOYEE' | 'HR';
  firstName: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
}

// Safe public shape of a user + minimal profile.
export function publicUser(user: User & { profile?: { employeeId?: string; firstName?: string; lastName?: string } | null }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: !!user.emailVerifiedAt,
    profile: user.profile
      ? {
          employeeId: user.profile.employeeId,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
        }
      : null,
  };
}

export async function signup(input: SignupInput) {
  const passwordProblems = passwordIssues(input.password);
  if (passwordProblems.length) {
    throw httpError.validation({ password: passwordProblems });
  }
  if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(input.email)) {
    throw httpError.validation({ email: ['Must be a valid email address'] });
  }
  if (!/^[A-Za-z0-9._-]{3,20}$/.test(input.employeeId)) {
    throw httpError.validation({ employeeId: ['3-20 chars, letters/numbers/._-'] });
  }

  const emailLower = input.email.toLowerCase();

  const emailTaken = await prisma.user.findUnique({ where: { email: emailLower } });
  if (emailTaken) throw httpError.conflict('An account with this email already exists');

  const idTaken = await prisma.employeeProfile.findUnique({ where: { employeeId: input.employeeId } });
  if (idTaken) throw httpError.conflict('This employee ID is already in use');

  const { token, expiry } = createVerificationToken();
  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email: emailLower,
        passwordHash,
        role: input.role,
        verificationToken: token,
        verificationTokenExpiry: expiry,
        profile: {
          create: {
            employeeId: input.employeeId,
            firstName: input.firstName,
            lastName: input.lastName,
            department: input.department,
            jobTitle: input.jobTitle,
            phone: input.phone,
            leaveBalance: { create: {} },
          },
        },
      },
      include: { profile: true },
    });
    return user;
  });

  await sendVerifyEmail(created.email, token);

  return {
    user: publicUser(created),
    verificationSent: true,
    message: 'Account created. Check your email to verify your account.',
    // Dev-only convenience: surface the link in the UI because no SMTP is configured.
    ...(isDev ? { verificationLink: `${env.VERIFY_BASE_URL}/verify-email?token=${token}` } : {}),
  };
}

export async function sendVerifyEmail(email: string, token: string): Promise<void> {
  const url = `${env.VERIFY_BASE_URL}/verify-email?token=${token}`;
  const mail = buildVerificationEmail(url);
  await sendMail({ to: email, ...mail });
}

export async function resendVerification(userId: number): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw httpError.notFound('User not found');
  if (user.emailVerifiedAt) throw httpError.badRequest('Email already verified');

  const { token, expiry } = createVerificationToken();
  await prisma.user.update({
    where: { id: userId },
    data: { verificationToken: token, verificationTokenExpiry: expiry },
  });
  await sendVerifyEmail(user.email, token);
  return {
    message: 'Verification email resent',
    ...(isDev ? { verificationLink: `${env.VERIFY_BASE_URL}/verify-email?token=${token}` } : {}),
  };
}

export async function verifyEmail(token: string): Promise<{ message: string; email?: string }> {
  if (!token) throw httpError.badRequest('No verification token provided');
  const user = await prisma.user.findUnique({ where: { verificationToken: token } });
  if (!user) throw httpError.badRequest('Invalid or already-used verification link');
  if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
    throw httpError.badRequest('Verification link has expired. Request a new one.');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      verificationToken: null,
      verificationTokenExpiry: null,
    },
  });
  return { message: 'Email verified. You can now sign in.', email: user.email };
}

export async function login(email: string, password: string) {
  const emailLower = email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: emailLower },
    include: { profile: true },
  });

  const generic = httpError.unauthorized('Invalid email or password');
  if (!user) throw generic;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw generic;

  const accessToken = signAccessToken(user.id, user.role);
  const { token: refreshToken, hash } = createRefreshToken(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hash } });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    user: publicUser(user),
    needsVerification: !user.emailVerifiedAt,
  };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) throw httpError.unauthorized('Invalid refresh token');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.refreshTokenHash) throw httpError.unauthorized('Session revoked');

  const storedHash = sha256(refreshToken);
  if (storedHash !== user.refreshTokenHash) throw httpError.unauthorized('Refresh token mismatch');

  const accessToken = signAccessToken(user.id, user.role);
  const { token: nextRefresh, hash } = createRefreshToken(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hash } });

  return { accessToken, refreshToken: nextRefresh, tokenType: 'Bearer', expiresIn: 900 };
}

export async function logout(userId: number, refreshToken: string): Promise<void> {
  const payload = verifyRefreshToken(refreshToken);
  const hash = payload ? sha256(refreshToken) : null;
  await prisma.user.updateMany({
    where: { id: userId, ...(hash ? { refreshTokenHash: hash } : {}) },
    data: { refreshTokenHash: null },
  });
}

export async function me(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        include: { salaryStructure: true, leaveBalance: true },
      },
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  return publicUser(user);
}

export async function requireVerifiedUser(userId: number): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  if (!user || !user.emailVerifiedAt) {
    throw httpError.forbidden('Your account is not verified. Check your email to activate it.');
  }
}

// Authenticated password change. Verifies the current password, enforces policy,
// and revokes all refresh tokens so other sessions are signed out.
export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw httpError.badRequest('Current password is incorrect');

  const problems = passwordIssues(newPassword);
  if (problems.length) throw httpError.validation({ password: problems });
  if (currentPassword === newPassword) throw httpError.badRequest('New password must be different from the current password');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, refreshTokenHash: null, resetToken: null, resetTokenExpiry: null },
  });
  return { message: 'Password changed. You have been signed out of your other devices.' };
}

// Public reset request. Always returns a generic message to avoid user enumeration.
export async function forgotPassword(email: string) {
  const emailLower = email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: emailLower } });
  const generic = { message: 'If an account exists for that email, a reset link has been sent.' };
  if (!user) return generic;

  const { token, expiry } = createVerificationToken();
  await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetTokenExpiry: expiry } });

  const url = `${env.VERIFY_BASE_URL}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Dayflow — Reset your password',
    html: `<p>We received a request to reset your password.</p><p><a href="${url}">${url}</a></p><p>This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>`,
    text: `Reset your Dayflow password here: ${url} (expires in 24h).`,
  });
  // Dev-only: since no SMTP is configured, return the reset link to the UI too.
  return isDev ? { ...generic, resetLink: url } : generic;
}

// Completes the password reset with a valid, unexpired token.
export async function resetPassword(token: string, newPassword: string) {
  if (!token) throw httpError.badRequest('No reset token provided');

  const problems = passwordIssues(newPassword);
  if (problems.length) throw httpError.validation({ password: problems });

  const user = await prisma.user.findUnique({ where: { resetToken: token } });
  if (!user) throw httpError.badRequest('Invalid or already-used reset link');
  if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
    throw httpError.badRequest('Reset link has expired. Request a new one.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null, refreshTokenHash: null },
  });
  return { message: 'Password reset successfully. You can now sign in.' };
}

export { isDev };