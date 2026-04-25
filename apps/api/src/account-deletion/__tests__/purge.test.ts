import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';
import {
  findAccountsDueForPurge,
  purgeAccount,
  runPurge,
  type AccountPendingPurge,
} from '../purge.js';
import type { DrizzleDb } from '../../plugins/db.js';

const PEPPER = 'test-pepper-32-characters-min-1234';

interface InsertCapture {
  table: string;
  values: unknown[];
  conflictDoNothing: boolean;
}

interface DeleteCapture {
  table: string;
  whereLabel: string;
}

interface UpdateCapture {
  table: string;
  set: Record<string, unknown>;
}

/**
 * Mock DB chainable pour la purge. Capture les opérations dans un tableau
 * partagé pour vérifier l'ordre des appels (audit avant DELETE accounts).
 *
 * Note : on simule `transaction` en exécutant le callback synchroneusement
 * avec le même mock — pas de rollback réel, mais c'est suffisant pour
 * tester la séquence et l'idempotence.
 */
function makeMockDb(initialAccounts: AccountPendingPurge[] = []): DrizzleDb & {
  _selected: AccountPendingPurge[];
  _inserts: InsertCapture[];
  _deletes: DeleteCapture[];
  _updates: UpdateCapture[];
  _failOn?: string;
} {
  const inserts: InsertCapture[] = [];
  const deletes: DeleteCapture[] = [];
  const updates: UpdateCapture[] = [];
  const ctx = { failOn: undefined as string | undefined };

  const insertChain = (table: string) => ({
    values(v: unknown) {
      const onConflictDoNothing = (): Promise<void> => {
        if (ctx.failOn === `insert:${table}:conflict`) {
          throw new Error(`fail-${table}-conflict`);
        }
        inserts.push({ table, values: [v], conflictDoNothing: true });
        return Promise.resolve();
      };
      const result: unknown = {
        onConflictDoNothing,
        then: (
          onfulfilled: (value: undefined) => unknown,
          onrejected?: (reason: unknown) => unknown,
        ) => {
          if (ctx.failOn === `insert:${table}`) {
            return Promise.reject(new Error(`fail-${table}`)).then(onfulfilled, onrejected);
          }
          inserts.push({ table, values: [v], conflictDoNothing: false });
          return Promise.resolve().then(onfulfilled, onrejected);
        },
      };
      return result;
    },
  });

  const deleteChain = (table: string) => ({
    where: (cond: unknown) => {
      if (ctx.failOn === `delete:${table}`) {
        return Promise.reject(new Error(`fail-${table}`));
      }
      deletes.push({ table, whereLabel: String(cond) });
      return Promise.resolve();
    },
  });

  const updateChain = (table: string) => ({
    set: (s: Record<string, unknown>) => ({
      where: (_cond: unknown) => {
        updates.push({ table, set: s });
        return Promise.resolve();
      },
    }),
  });

  const selectChain = () => ({
    from: (table: unknown) => {
      const name = (() => {
        try {
          return getTableName(table as never);
        } catch {
          return 'unknown';
        }
      })();
      return {
        where: (_cond: unknown) => {
          if (name === 'accounts') {
            return Promise.resolve(initialAccounts.map((a) => ({ id: a.accountId })));
          }
          return Promise.resolve([]);
        },
      };
    },
  });

  // Identification fiable via l'API publique Drizzle.
  const identify = (table: unknown): string => {
    try {
      return getTableName(table as never);
    } catch {
      return 'unknown';
    }
  };

  const insert = (table: unknown) => insertChain(identify(table));
  const del = (table: unknown) => deleteChain(identify(table));
  const update = (table: unknown) => updateChain(identify(table));
  const select = () => selectChain();
  const transaction = async <T>(fn: (tx: DrizzleDb) => Promise<T>): Promise<T> => {
    return fn(api as unknown as DrizzleDb);
  };

  const api = {
    insert,
    delete: del,
    update,
    select,
    transaction,
    _selected: initialAccounts,
    _inserts: inserts,
    _deletes: deletes,
    _updates: updates,
    _failOn: ctx.failOn,
    set _failOnSetter(v: string) {
      ctx.failOn = v;
    },
  };

  return api as unknown as DrizzleDb & {
    _selected: AccountPendingPurge[];
    _inserts: InsertCapture[];
    _deletes: DeleteCapture[];
    _updates: UpdateCapture[];
    _failOn?: string;
  };
}

const NOW_MS = 1_700_000_000_000;
const ACC_A: AccountPendingPurge = {
  accountId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  householdId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};
const ACC_B: AccountPendingPurge = {
  accountId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  householdId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
};

const fakeLogger = {
  info: vi.fn(),
  error: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findAccountsDueForPurge', () => {
  it('retourne uniquement les comptes pending avec scheduledAtMs <= now (mock)', async () => {
    const db = makeMockDb([ACC_A]);
    const result = await findAccountsDueForPurge(db, NOW_MS);
    expect(result).toHaveLength(1);
    expect(result[0]?.accountId).toBe(ACC_A.accountId);
  });

  it('retourne un tableau vide si aucun compte échu', async () => {
    const db = makeMockDb([]);
    const result = await findAccountsDueForPurge(db, NOW_MS);
    expect(result).toEqual([]);
  });
});

describe('purgeAccount', () => {
  it('insère deleted_accounts (idempotent) puis audit puis DELETE accounts dans cet ordre', async () => {
    const db = makeMockDb();
    await purgeAccount(db, ACC_A, NOW_MS, PEPPER);

    // Ordre attendu : INSERT deleted_accounts > INSERT audit_events >
    // DELETE mailbox_messages > DELETE accounts.
    const order = [
      ...db._inserts.map((i) => `insert:${i.table}`),
      ...db._deletes.map((d) => `delete:${d.table}`),
    ];
    // Tri par séquence d'apparition (les arrays capturent dans l'ordre).
    expect(db._inserts[0]?.table).toBe('deleted_accounts');
    expect(db._inserts[0]?.conflictDoNothing).toBe(true);
    expect(db._inserts[1]?.table).toBe('audit_events');
    expect(db._deletes.find((d) => d.table === 'accounts')).toBeDefined();
    // mailbox supprimé avant accounts
    const mailboxIdx = order.indexOf('delete:mailbox_messages');
    const accountsIdx = order.indexOf('delete:accounts');
    expect(mailboxIdx).toBeGreaterThanOrEqual(0);
    expect(accountsIdx).toBeGreaterThan(mailboxIdx);
  });

  it("écrit l'audit avec accountId du compte (pour cascade SET NULL après DELETE)", async () => {
    const db = makeMockDb();
    await purgeAccount(db, ACC_A, NOW_MS, PEPPER);
    const auditInsert = db._inserts.find((i) => i.table === 'audit_events');
    expect(auditInsert).toBeDefined();
    const v = auditInsert?.values[0] as {
      accountId: string;
      eventType: string;
      eventData: unknown;
    };
    expect(v.accountId).toBe(ACC_A.accountId);
    expect(v.eventType).toBe('account_deleted');
    expect(v.eventData).toMatchObject({ deletedAtMs: NOW_MS });
    // pseudoId 64 chars hex (SHA-256)
    expect((v.eventData as { pseudoId: string }).pseudoId).toMatch(/^[0-9a-f]{64}$/);
  });

  it("n'expose JAMAIS l'accountId dans deleted_accounts (zero-knowledge)", async () => {
    const db = makeMockDb();
    await purgeAccount(db, ACC_A, NOW_MS, PEPPER);
    const deleted = db._inserts.find((i) => i.table === 'deleted_accounts');
    const v = deleted?.values[0] as {
      pseudoId: string;
      deletedAtMs: number;
      householdId: string;
    };
    expect(v.pseudoId).toMatch(/^[0-9a-f]{64}$/);
    expect(v.pseudoId).not.toContain('aaaa'); // accountId fictif est en aaa
    expect(v.deletedAtMs).toBe(NOW_MS);
    expect(v.householdId).toBe(ACC_A.householdId); // householdId reste en clair (preuve foyer purgé)
  });
});

describe('runPurge', () => {
  it("ne s'arrête pas sur l'échec d'un compte", async () => {
    const db = makeMockDb([ACC_A, ACC_B]);
    // Force un échec sur le PREMIER INSERT deleted_accounts. On patche
    // db.insert pour retourner un onConflictDoNothing qui throw au
    // premier appel.
    let firstSeen = false;
    const origInsert = (db as unknown as { insert: (t: unknown) => unknown }).insert;
    (db as unknown as { insert: (t: unknown) => unknown }).insert = (table: unknown) => {
      const tn = (() => {
        try {
          return getTableName(table as never);
        } catch {
          return '';
        }
      })();
      if (tn === 'deleted_accounts' && !firstSeen) {
        firstSeen = true;
        return {
          values() {
            return {
              onConflictDoNothing: () => Promise.reject(new Error('boom')),
            };
          },
        };
      }
      return origInsert.call(db, table);
    };

    const purged = await runPurge(db, NOW_MS, PEPPER, fakeLogger);
    expect(purged).toBe(1); // un seul a réussi
    expect(fakeLogger.error).toHaveBeenCalled();
  });

  it('retourne 0 si aucun compte échu', async () => {
    const db = makeMockDb([]);
    const purged = await runPurge(db, NOW_MS, PEPPER, fakeLogger);
    expect(purged).toBe(0);
  });

  it('ne logue jamais accountId en clair', async () => {
    const db = makeMockDb([ACC_A]);
    await runPurge(db, NOW_MS, PEPPER, fakeLogger);
    const allLogs = [...fakeLogger.info.mock.calls, ...fakeLogger.error.mock.calls].flat();
    const stringified = JSON.stringify(allLogs);
    expect(stringified).not.toContain(ACC_A.accountId);
  });
});
