import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../env.js';

/**
 * Construit un transporter SMTP. En dev/test on pointe vers Mailpit
 * (sans auth, pas de TLS). En prod on peut utiliser Postmark ou autre
 * provider via les variables SMTP_*.
 */
export function createMailTransport(env: Env): Transporter {
  const auth =
    env.SMTP_USER !== undefined && env.SMTP_PASS !== undefined
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(auth !== undefined ? { auth } : {}),
  });
}
