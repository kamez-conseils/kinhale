import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('14d'),
  REDIS_URL: z.string().default('redis://:kinhale_redis_dev@localhost:6379'),
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
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '14d',
    REDIS_URL: 'redis://:kinhale_redis_dev@localhost:6379',
    ...overrides,
  };
}
