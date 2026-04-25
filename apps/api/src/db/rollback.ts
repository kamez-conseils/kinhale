/**
 * Rollback de migrations Drizzle — convention `up.sql` / `down.sql`.
 *
 * Drizzle Kit génère les fichiers `NNNN_<tag>.sql` (la « up ») et tient
 * un journal `meta/_journal.json` listant chaque migration. Le runtime
 * Drizzle (`migrate()`) applique séquentiellement chaque entrée et
 * enregistre son hash dans la table `drizzle.__drizzle_migrations`.
 *
 * Drizzle ne supporte pas nativement le rollback. La convention adoptée
 * pour Kinhale (KIN-092 / E14-S05) est de **co-localiser** un fichier
 * `NNNN_<tag>.down.sql` à côté de chaque `up.sql`. Ce module :
 *
 *  - charge le journal,
 *  - vérifie l'existence des deux fichiers (`up` + `down`),
 *  - applique / rollback une migration sous transaction,
 *  - met à jour la table `drizzle.__drizzle_migrations` en cohérence.
 *
 * **Sécurité** :
 *  - Aucune opération n'utilise `DROP DATABASE` ou `DROP SCHEMA public`.
 *    La granularité du rollback est la migration ; tout au plus, le
 *    rollback de `0000` supprime les tables applicatives.
 *  - Chaque `down.sql` doit être idempotent (DROP IF EXISTS, etc.) — la
 *    suite de tests `migration-rollback.test.ts` enforce cette règle en
 *    appliquant la séquence up → down → down → up sur une DB jetable.
 *  - Toute migration sans `down.sql` provoque une erreur explicite avant
 *    toute exécution SQL : on échoue tôt, jamais au milieu d'un rollback
 *    partiel.
 *
 * Tracking : KIN-092, follow-up de KIN-080 (issue #233).
 */

import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256HexFromString } from '@kinhale/crypto';
import type { PoolClient } from 'pg';

/** Une entrée du journal Drizzle (`meta/_journal.json`). */
export interface JournalEntry {
  readonly idx: number;
  readonly version: string;
  readonly when: number;
  readonly tag: string;
  readonly breakpoints: boolean;
}

interface Journal {
  readonly version: string;
  readonly dialect: string;
  readonly entries: readonly JournalEntry[];
}

/** Une migration matérialisée — fichiers et statements pré-découpés. */
export interface Migration {
  readonly entry: JournalEntry;
  readonly upPath: string;
  readonly downPath: string;
  readonly upStatements: readonly string[];
  readonly downStatements: readonly string[];
  readonly upHash: string;
}

const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

/**
 * Découpe un fichier SQL Drizzle sur le marqueur `statement-breakpoint`,
 * en filtrant les fragments vides.
 */
export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(STATEMENT_BREAKPOINT)
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

/**
 * Hash SHA-256 utilisé par Drizzle pour identifier une migration dans
 * `drizzle.__drizzle_migrations`. **Doit** matcher exactement la logique
 * du runtime Drizzle (`migrator.js#readMigrationFiles`) sinon le rollback
 * ne pourra pas retrouver la ligne à supprimer.
 *
 * Drizzle hash le **contenu brut** du fichier `.sql` (avant split). On
 * passe par `@kinhale/crypto` (SHA-256 Web Crypto) plutôt que `node:crypto`
 * pour respecter la règle de portabilité du monorepo (CLAUDE.md). Le
 * digest hex produit est strictement identique à celui de `crypto.createHash`.
 */
export async function hashUpSql(rawSql: string): Promise<string> {
  return sha256HexFromString(rawSql);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Charge toutes les migrations déclarées dans `_journal.json`. Lève une
 * erreur si un fichier `up.sql` ou `down.sql` est absent — la CI bloque
 * ainsi toute PR qui ajoute une migration sans son rollback.
 */
export async function loadMigrations(migrationsFolder: string): Promise<Migration[]> {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  const journalRaw = await readFile(journalPath, 'utf8');
  const journal = JSON.parse(journalRaw) as Journal;

  const migrations: Migration[] = [];
  for (const entry of journal.entries) {
    const upPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const downPath = path.join(migrationsFolder, `${entry.tag}.down.sql`);

    if (!(await fileExists(upPath))) {
      throw new Error(`missing up.sql for migration ${entry.tag} (expected at ${upPath})`);
    }
    if (!(await fileExists(downPath))) {
      throw new Error(
        `missing down.sql for migration ${entry.tag} — manual rollback required ` +
          `(expected at ${downPath}, see docs/runbooks/database-migrations.md)`,
      );
    }

    const upSql = await readFile(upPath, 'utf8');
    const downSql = await readFile(downPath, 'utf8');

    migrations.push({
      entry,
      upPath,
      downPath,
      upStatements: splitSqlStatements(upSql),
      downStatements: splitSqlStatements(downSql),
      upHash: await hashUpSql(upSql),
    });
  }
  return migrations;
}

/**
 * Applique le `up.sql` d'une migration sous une transaction unique et
 * enregistre la ligne `__drizzle_migrations` (mêmes colonnes / valeurs
 * que la fonction `migrate()` officielle de Drizzle).
 *
 * Important : on appelle ça uniquement depuis le test de round-trip ; en
 * prod / dev on continue d'utiliser `drizzle-kit migrate`.
 */
export async function applyMigration(client: PoolClient, migration: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
         id SERIAL PRIMARY KEY,
         hash text NOT NULL,
         created_at bigint
       )`,
    );
    for (const stmt of migration.upStatements) {
      await client.query(stmt);
    }
    await client.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
      [migration.upHash, migration.entry.when],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Applique le `down.sql` d'une migration sous une transaction unique et
 * retire la ligne correspondante de `drizzle.__drizzle_migrations`.
 *
 * Si la table de tracking n'existe pas (cas où aucune migration n'a
 * jamais été appliquée), on lève. C'est volontaire : rollback sans état
 * connu = opération inutile au mieux, dangereuse au pire.
 */
export async function rollbackMigration(client: PoolClient, migration: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    for (const stmt of migration.downStatements) {
      await client.query(stmt);
    }
    await client.query(`DELETE FROM "drizzle"."__drizzle_migrations" WHERE "hash" = $1`, [
      migration.upHash,
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Renvoie le hash de la dernière migration enregistrée, ou `null` si la
 * table de tracking est absente / vide.
 */
export async function getLastAppliedHash(client: PoolClient): Promise<string | null> {
  const tableExists = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
     ) AS "exists"`,
  );
  if (!tableExists.rows[0]?.exists) return null;

  const res = await client.query<{ hash: string }>(
    `SELECT "hash" FROM "drizzle"."__drizzle_migrations" ORDER BY "created_at" DESC, "id" DESC LIMIT 1`,
  );
  return res.rows[0]?.hash ?? null;
}

/**
 * Rollback de la dernière migration appliquée sur la base ciblée par
 * `client`. Renvoie le tag de la migration rollée. Si aucune migration
 * n'est appliquée, lève — un rollback à vide est un signal d'usage
 * incorrect (l'opérateur croyait probablement avoir migré).
 */
export async function rollbackLatest(
  client: PoolClient,
  migrationsFolder: string,
): Promise<string> {
  const migrations = await loadMigrations(migrationsFolder);
  const lastHash = await getLastAppliedHash(client);
  if (lastHash === null) {
    throw new Error('no applied migration found in drizzle.__drizzle_migrations');
  }
  const target = migrations.find((m) => m.upHash === lastHash);
  if (target === undefined) {
    throw new Error(
      `last applied migration (hash=${lastHash}) is not present in journal — ` +
        `manual recovery required (see docs/runbooks/database-migrations.md)`,
    );
  }
  await rollbackMigration(client, target);
  return target.entry.tag;
}

/** Résolution du dossier `migrations/` pour le binaire CLI. */
export function defaultMigrationsFolder(): string {
  // En runtime, ce module est compilé sous `dist/db/rollback.js` ; on
  // remonte d'un cran pour pointer vers `dist/db/migrations`. En
  // exécution `tsx`, on est sous `src/db/rollback.ts`, on pointe vers
  // `src/db/migrations`. Les deux fonctionnent grâce au `import.meta.url`.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, 'migrations');
}
