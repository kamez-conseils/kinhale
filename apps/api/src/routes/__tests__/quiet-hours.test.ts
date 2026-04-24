import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';
import type { RedisClients } from '../../plugins/redis.js';
import { createDrizzleQuietHoursStore } from '../quiet-hours.js';

const ACCOUNT_ID = '00000000-0000-0000-0000-0000000000AA';
const DEVICE_ID = '00000000-0000-0000-0000-0000000000BB';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-0000000000CC';

interface QuietHoursRow {
  enabled: boolean;
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
}

/**
 * Mock DB « chainable » — pattern aligné sur notification-preferences.test.ts.
 * On capture select/insert/where pour vérifier que les bons appels Drizzle
 * sont émis sans nécessiter une vraie Postgres.
 */
function makeMockDb(initialRows: Array<QuietHoursRow> = []): DrizzleDb & {
  _selectRows: Array<QuietHoursRow>;
  _onConflictDoUpdate: ReturnType<typeof vi.fn>;
  _insertValues: ReturnType<typeof vi.fn>;
  _selectWhere: ReturnType<typeof vi.fn>;
} {
  const selectRows = [...initialRows];
  const selectWhere = vi.fn().mockImplementation(() => Promise.resolve(selectRows));
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return {
    select,
    insert,
    _selectRows: selectRows,
    _onConflictDoUpdate: onConflictDoUpdate,
    _insertValues: insertValues,
    _selectWhere: selectWhere,
  } as unknown as DrizzleDb & {
    _selectRows: Array<QuietHoursRow>;
    _onConflictDoUpdate: ReturnType<typeof vi.fn>;
    _insertValues: ReturnType<typeof vi.fn>;
    _selectWhere: ReturnType<typeof vi.fn>;
  };
}

function makeMockRedis(): RedisClients {
  return {
    pub: {
      incr: vi.fn(),
      expire: vi.fn(),
      publish: vi.fn(),
    } as never,
    sub: { on: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() } as never,
  };
}

function buildTestApp(db: ReturnType<typeof makeMockDb>) {
  return buildApp(testEnv(), { db, redis: makeMockRedis() });
}

function signAccess(app: ReturnType<typeof buildTestApp>): string {
  return app.jwt.sign({
    sub: ACCOUNT_ID,
    deviceId: DEVICE_ID,
    householdId: HOUSEHOLD_ID,
    type: 'access',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /me/quiet-hours', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/me/quiet-hours' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne les valeurs par défaut si aucune ligne persistée', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      enabled: false,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'UTC',
    });
    await app.close();
  });

  it('retourne les valeurs persistées', async () => {
    const db = makeMockDb([
      {
        enabled: true,
        startLocalTime: '23:00',
        endLocalTime: '06:30',
        timezone: 'America/Toronto',
      },
    ]);
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      enabled: true,
      startLocalTime: '23:00',
      endLocalTime: '06:30',
      timezone: 'America/Toronto',
    });
    await app.close();
  });
});

describe('PUT /me/quiet-hours', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      payload: {
        enabled: true,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si body est mal formé (champ manquant)', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: { enabled: true, startLocalTime: '22:00' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si startLocalTime est invalide', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        enabled: true,
        startLocalTime: '25:00', // heure impossible
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si endLocalTime est sans zéro padding', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        enabled: true,
        startLocalTime: '22:00',
        endLocalTime: '7:00', // pas de zéro padding
        timezone: 'America/Toronto',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si timezone IANA est invalide', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        enabled: true,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'Not/A_Real_Zone',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si timezone est whitespace-only', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        enabled: true,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: '   ',
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('persiste une configuration valide (upsert par accountId)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        enabled: true,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(db.insert).toHaveBeenCalledOnce();
    expect(db._insertValues).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      enabled: true,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'America/Toronto',
    });
    expect(db._onConflictDoUpdate).toHaveBeenCalledOnce();
    await app.close();
  });

  it('accepte enabled=false (désactivation explicite)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/quiet-hours',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        enabled: false,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(db._insertValues).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    await app.close();
  });
});

describe('createDrizzleQuietHoursStore', () => {
  it('retourne une Map vide si accountIds est vide', async () => {
    const db = makeMockDb();
    const store = createDrizzleQuietHoursStore(db);
    const result = await store.findQuietHoursByAccount([]);
    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('retourne une Map indexée par accountId', async () => {
    const db = makeMockDb();
    const whereMock = vi.fn().mockResolvedValue([
      {
        accountId: 'acc-1',
        enabled: true,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      },
      {
        accountId: 'acc-2',
        enabled: false,
        startLocalTime: '23:00',
        endLocalTime: '06:00',
        timezone: 'Europe/Paris',
      },
    ]);
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: whereMock }),
    });

    const store = createDrizzleQuietHoursStore(db);
    const result = await store.findQuietHoursByAccount(['acc-1', 'acc-2', 'acc-3']);
    expect(result.get('acc-1')).toEqual({
      enabled: true,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'America/Toronto',
    });
    expect(result.get('acc-2')).toEqual({
      enabled: false,
      startLocalTime: '23:00',
      endLocalTime: '06:00',
      timezone: 'Europe/Paris',
    });
    expect(result.has('acc-3')).toBe(false); // pas de ligne persistée
    expect(whereMock).toHaveBeenCalledOnce();
  });
});
