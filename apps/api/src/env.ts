import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  /**
   * Pepper de pseudonymisation pour `deleted_accounts.pseudo_id`. Distinct
   * du `JWT_SECRET` : la rotation JWT (procédure normale) ne doit pas
   * invalider la corrélation audit_events ↔ deleted_accounts (Loi 25 / RGPD).
   * Doit être ≥ 32 chars random, **jamais** roté (ou via migration douce
   * double-pepper). Refs: kz-securite AUDIT-TRANSVERSE M2.
   */
  PSEUDO_ID_PEPPER: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('14d'),
  REDIS_URL: z.string().default('redis://:kinhale_redis_dev@localhost:6379'),
  SMTP_HOST: z.string().default('mailpit'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  // z.coerce.boolean() traite 'false' comme true (string non-vide = truthy).
  // On utilise une transformation explicite pour respecter la valeur 'false'.
  SMTP_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('no-reply@kinhale.health'),
  WEB_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(raw);
}

/** Env de test — toutes les valeurs minimales valides */
export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://kinhale:kinhale_dev_secret@localhost:5434/kinhale_dev',
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    PSEUDO_ID_PEPPER: 'test-pseudo-id-pepper-minimum-32-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '14d',
    REDIS_URL: 'redis://:kinhale_redis_dev@localhost:6379',
    SMTP_HOST: 'mailpit',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    MAIL_FROM: 'no-reply@kinhale.health',
    WEB_URL: 'http://localhost:3000',
    ...overrides,
  };
}
