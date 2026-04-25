/**
 * Tests unitaires des helpers de `rollback.ts` — pas besoin de DB.
 *
 * Couvre :
 *  - `splitSqlStatements` : découpe propre, filtrage des fragments vides.
 *  - `hashUpSql` : conformité au hash Drizzle (SHA-256 hex sur le brut).
 *  - `loadMigrations` : parcours du journal, présence des fichiers, rejet
 *     explicite quand un `down.sql` est absent.
 *
 * L'invariant le plus important pour la CI : `loadMigrations` doit
 * réussir sur le dossier réel `apps/api/src/db/migrations`. Ce test fait
 * office de garde — toute migration ajoutée sans son `down.sql` casse la
 * suite.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256HexFromString } from '@kinhale/crypto';

import { hashUpSql, loadMigrations, splitSqlStatements } from '../rollback.js';

const REAL_MIGRATIONS = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  'migrations',
);

describe('splitSqlStatements', () => {
  it('découpe sur le marqueur Drizzle et trim les fragments', () => {
    const input = `CREATE TABLE a();--> statement-breakpoint\n\nDROP TABLE b;`;
    expect(splitSqlStatements(input)).toEqual(['CREATE TABLE a();', 'DROP TABLE b;']);
  });

  it('filtre les fragments vides', () => {
    const input = `--> statement-breakpoint\n\n--> statement-breakpoint\nDROP TABLE a;`;
    expect(splitSqlStatements(input)).toEqual(['DROP TABLE a;']);
  });

  it('renvoie un seul fragment pour un fichier sans breakpoint', () => {
    expect(splitSqlStatements('SELECT 1;')).toEqual(['SELECT 1;']);
  });
});

describe('hashUpSql', () => {
  it('reproduit le hash Drizzle (SHA-256 hex sur le brut)', async () => {
    const sql = 'CREATE TABLE foo(id int);';
    const expected = await sha256HexFromString(sql);
    expect(await hashUpSql(sql)).toBe(expected);
  });

  it('produit la même valeur que crypto.createHash(sha256) — vector connu', async () => {
    // Vector RFC : sha256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad.
    expect(await hashUpSql('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('loadMigrations sur le dossier réel apps/api/src/db/migrations', () => {
  it('charge toutes les entrées du journal et trouve up + down pour chacune', async () => {
    const migrations = await loadMigrations(REAL_MIGRATIONS);
    expect(migrations.length).toBeGreaterThanOrEqual(5);

    const tags = migrations.map((m) => m.entry.tag);
    expect(tags).toContain('0000_silent_zzzax');
    expect(tags).toContain('0001_curly_iron_man');
    expect(tags).toContain('0002_quiet_hours');
    expect(tags).toContain('0003_audit_events');
    expect(tags).toContain('0004_account_deletion');

    for (const m of migrations) {
      expect(m.upStatements.length).toBeGreaterThan(0);
      expect(m.downStatements.length).toBeGreaterThan(0);
      expect(m.upHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('loadMigrations sur dossier synthétique', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'kinhale-rollback-'));
    await mkdir(path.join(tmpDir, 'meta'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function writeJournal(entries: ReadonlyArray<{ tag: string; idx: number }>) {
    const payload = {
      version: '7',
      dialect: 'postgresql',
      entries: entries.map((e) => ({
        idx: e.idx,
        version: '7',
        when: 1700000000000 + e.idx,
        tag: e.tag,
        breakpoints: true,
      })),
    };
    await writeFile(path.join(tmpDir, 'meta', '_journal.json'), JSON.stringify(payload));
  }

  it('lève quand un fichier up.sql est absent', async () => {
    await writeJournal([{ tag: '0000_init', idx: 0 }]);
    await writeFile(path.join(tmpDir, '0000_init.down.sql'), 'DROP TABLE a;');

    await expect(loadMigrations(tmpDir)).rejects.toThrow(/missing up\.sql.*0000_init/);
  });

  it('lève avec un message explicite quand un down.sql manque', async () => {
    await writeJournal([{ tag: '0000_init', idx: 0 }]);
    await writeFile(path.join(tmpDir, '0000_init.sql'), 'CREATE TABLE a();');

    await expect(loadMigrations(tmpDir)).rejects.toThrow(
      /missing down\.sql for migration 0000_init.*manual rollback required/,
    );
  });

  it('charge correctement quand up + down sont présents', async () => {
    await writeJournal([{ tag: '0000_init', idx: 0 }]);
    const upSql = 'CREATE TABLE a(id int);';
    const downSql = 'DROP TABLE IF EXISTS a;';
    await writeFile(path.join(tmpDir, '0000_init.sql'), upSql);
    await writeFile(path.join(tmpDir, '0000_init.down.sql'), downSql);

    const migrations = await loadMigrations(tmpDir);
    expect(migrations).toHaveLength(1);
    const first = migrations[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.entry.tag).toBe('0000_init');
    expect(first.upStatements).toEqual(['CREATE TABLE a(id int);']);
    expect(first.downStatements).toEqual(['DROP TABLE IF EXISTS a;']);
    expect(first.upHash).toBe(await hashUpSql(upSql));
  });
});
