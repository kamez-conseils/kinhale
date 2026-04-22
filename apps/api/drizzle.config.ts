import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env['DATABASE_URL'] ??
      'postgresql://kinhale:kinhale_dev_secret@localhost:5434/kinhale_dev',
  },
  verbose: true,
  strict: true,
} satisfies Config;
