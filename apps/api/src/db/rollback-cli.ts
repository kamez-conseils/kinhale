/**
 * CLI `pnpm --filter @kinhale/api db:rollback`.
 *
 * Connecte un client `pg` sur `DATABASE_URL`, lance `rollbackLatest()` et
 * imprime le tag de la migration rollée. Aucune autre opération (pas de
 * dump, pas de purge, pas de chained rollback) — l'opérateur garde la
 * main, la procédure complète est documentée dans
 * `docs/runbooks/database-migrations.md`.
 *
 * Usage :
 *   DATABASE_URL=postgres://… pnpm --filter @kinhale/api db:rollback
 *
 * Codes de retour :
 *   0 — rollback effectué (tag imprimé sur stdout)
 *   1 — erreur (message imprimé sur stderr)
 */

import { Pool } from 'pg';
import { defaultMigrationsFolder, rollbackLatest } from './rollback.js';

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url.length === 0) {
    throw new Error('DATABASE_URL is not set');
  }

  const folder = process.env['KINHALE_MIGRATIONS_FOLDER'] ?? defaultMigrationsFolder();

  const pool = new Pool({ connectionString: url });
  try {
    const client = await pool.connect();
    try {
      const tag = await rollbackLatest(client, folder);
      // stdout reste machine-readable : un seul tag par ligne.
      process.stdout.write(`${tag}\n`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`db:rollback failed: ${msg}\n`);
  process.exitCode = 1;
});
