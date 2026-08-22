import nodemailer, { type Transporter } from 'nodemailer';
import { env, isDev } from '../config/env';

let transporter: Pick<Transporter, 'sendMail'> | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const smtpConfigured = !!env.SMTP_HOST && !!env.SMTP_USER;
  if (smtpConfigured) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  } else {
    // Dev fallback: capture "sent" mail and log it rather than making a real SMTP call.
    transporter = {
      async sendMail(message: never) {
        // eslint-disable-next-line no-console
        console.log(`\n📧 [mailer:dev] to=${(message as { to?: string }).to}\n  subject=${(message as { subject?: string }).subject}\n  text=${(message as { text?: string }).text}\n  html=${(message as { html?: string }).html?.slice(0, 300)}...`);
        return { messageId: `dev-${Date.now()}` } as never;
      },
    } as Pick<Transporter, 'sendMail'>;
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!isDev && !env.SMTP_HOST) {
    throw new Error('SMTP not configured for non-development environment');
  }
  await getTransporter().sendMail({
    from: env.MAIL_FROM,
    ...message,
  });
}

export function buildVerificationEmail(verifyUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Dayflow — Verify your email',
    html: `<p>Welcome to Dayflow! Click below to activate your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
    text: `Welcome to Dayflow! Activate your account here: ${verifyUrl} (expires in 24h).`,
  };
}