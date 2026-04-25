/**
 * Test d'intégration round-trip : applique chaque migration, la rollback,
 * la ré-applique, et vérifie que `__drizzle_migrations` reflète l'état
 * attendu à chaque étape.
 *
 * Le test exige une instance Postgres réelle (pour couvrir
 * `gen_random_uuid()`, `jsonb`, les index partiels, les FK CASCADE / SET
 * NULL — dont aucun n'est correctement émulé par pg-mem). Il est skippé
 * silencieusement si `KINHALE_DB_TEST_URL` n'est pas défini, ce qui
 * garde `pnpm test` rapide en local sans Postgres. La CI lance un job
 * dédié `db-rollback-test` qui set la variable et provisionne un
 * service Postgres 16.
 *
 * Bloquant CI : ce test échoue dès qu'une migration n'a pas son
 * `down.sql` ou que le `down.sql` n'est pas idempotent.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { fileURLToPath } from 'node:url';
import { applyMigration, hashUpSql, loadMigrations, rollbackMigration } from '../rollback.js';

const TEST_DB_URL = process.env['KINHALE_DB_TEST_URL'];

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../migrations/', import.meta.url));

async function applyAll(
  pool: Pool,
  migrations: Awaited<ReturnType<typeof loadMigrations>>,
): Promise<void> {
  for (const m of migrations) {
    const client = await pool.connect();
    try {
      await applyMigration(client, m);
    } finally {
      client.release();
    }
  }
}

// `describe.skipIf` est non-statique : on doit le calculer à la lecture.
const describeIfDb = TEST_DB_URL ? describe : describe.skip;

describeIfDb('migration rollback round-trip (Postgres réel)', () => {
  let pool: Pool;

  async function resetSchema(): Promise<void> {
    // Bac à sable : on repart d'un schéma `public` vide. Le test est seul
    // sur sa DB jetable, c'est sans effet de bord pour les autres jobs.
    const client = await pool.connect();
    try {
      await client.query('DROP SCHEMA IF EXISTS "drizzle" CASCADE');
      await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
      await client.query('CREATE SCHEMA "public"');
      await client.query('GRANT ALL ON SCHEMA "public" TO PUBLIC');
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL });
  }, 30_000);

  beforeEach(async () => {
    // Reset entre chaque `it()` — pas de couplage temporel, vitest peut
    // réordonner les tests sans casse.
    await resetSchema();
  }, 30_000);

  afterAll(async () => {
    await pool.end();
  });

  async function readAppliedHashes(): Promise<string[]> {
    const client = await pool.connect();
    try {
      const exists = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
         ) AS "exists"`,
      );
      if (!exists.rows[0]?.exists) return [];
      const res = await client.query<{ hash: string }>(
        `SELECT "hash" FROM "drizzle"."__drizzle_migrations" ORDER BY "created_at" ASC, "id" ASC`,
      );
      return res.rows.map((r) => r.hash);
    } finally {
      client.release();
    }
  }

  it("rejoue chaque migration en up → down → up et vérifie l'état du journal", async () => {
    const migrations = await loadMigrations(MIGRATIONS_FOLDER);
    expect(migrations.length).toBeGreaterThan(0);

    // 1. Apply all migrations dans l'ordre.
    for (const m of migrations) {
      const client = await pool.connect();
      try {
        await applyMigration(client, m);
      } finally {
        client.release();
      }
    }

    let hashes = await readAppliedHashes();
    expect(hashes).toEqual(migrations.map((m) => m.upHash));

    // 2. Rollback en sens inverse — chaque down.sql doit être valide à la
    //    fois en SQL et logiquement (pas de FK orphelines).
    for (let i = migrations.length - 1; i >= 0; i--) {
      const m = migrations[i];
      expect(m).toBeDefined();
      if (!m) continue;
      const client = await pool.connect();
      try {
        await rollbackMigration(client, m);
      } finally {
        client.release();
      }
    }

    hashes = await readAppliedHashes();
    expect(hashes).toEqual([]);

    // 3. Ré-applique tout — garantit que les down.sql ont laissé un état
    //    propre (pas de table résiduelle / pas d'index orphelin).
    for (const m of migrations) {
      const client = await pool.connect();
      try {
        await applyMigration(client, m);
      } finally {
        client.release();
      }
    }

    hashes = await readAppliedHashes();
    expect(hashes).toEqual(migrations.map((m) => m.upHash));
  }, 120_000);

  it('chaque down.sql est idempotent (peut être appliqué deux fois sans erreur)', async () => {
    const migrations = await loadMigrations(MIGRATIONS_FOLDER);

    // Repartir d'un état fully migrated connu — pas de couplage temporel
    // avec le test précédent (qui pourrait être réordonné par vitest).
    await applyAll(pool, migrations);

    // Rollback dans l'ordre inverse depuis l'état fully migrated.
    for (let i = migrations.length - 1; i >= 0; i--) {
      const m = migrations[i];
      expect(m).toBeDefined();
      if (!m) continue;
      const client = await pool.connect();
      try {
        await rollbackMigration(client, m);
      } finally {
        client.release();
      }
    }

    // Re-rollback : doit être no-op et ne pas lever — `DROP IF EXISTS`
    // partout, statements ALTER protégés par DROP CONSTRAINT IF EXISTS.
    for (let i = migrations.length - 1; i >= 0; i--) {
      const m = migrations[i];
      expect(m).toBeDefined();
      if (!m) continue;
      const client = await pool.connect();
      try {
        // Le delete sur __drizzle_migrations est déjà no-op (la ligne
        // n'existe plus). On exécute juste les statements down.
        for (const stmt of m.downStatements) {
          await client.query(stmt);
        }
      } finally {
        client.release();
      }
    }
  }, 120_000);

  it('hashUpSql produit la même valeur que celle stockée par le runtime Drizzle', async () => {
    // Sanity check : si Drizzle change sa logique de hash, ce test pète
    // et on s'en aperçoit avant que le rollback CLI n'efface la mauvaise
    // ligne en prod.
    const fs = await import('node:fs/promises');
    const migrations = await loadMigrations(MIGRATIONS_FOLDER);
    for (const m of migrations) {
      const upRaw = await fs.readFile(m.upPath, 'utf8');
      const upHashFromFile = await hashUpSql(upRaw);
      expect(m.upHash).toBe(upHashFromFile);
    }
  });
});
