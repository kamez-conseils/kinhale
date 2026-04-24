import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';
import type { RedisClients } from '../../plugins/redis.js';
import { createDrizzleNotificationPreferenceStore } from '../notification-preferences.js';

const ACCOUNT_ID = '00000000-0000-0000-0000-0000000000AA';
const DEVICE_ID = '00000000-0000-0000-0000-0000000000BB';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-0000000000CC';

/**
 * Mock DB « chainable » qui capture les appels Drizzle (select/insert/where/…)
 * sans exécuter de vraie requête. Pattern aligné sur `push.test.ts`.
 */
function makeMockDb(initialRows: Array<{ type: string; enabled: boolean }> = []): DrizzleDb & {
  _selectRows: Array<{ type: string; enabled: boolean }>;
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
    _selectRows: Array<{ type: string; enabled: boolean }>;
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /me/notification-preferences', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/me/notification-preferences' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 10 types avec les sanctuarisés marqués alwaysEnabled', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      preferences: Array<{ type: string; enabled: boolean; alwaysEnabled: boolean }>;
    };
    expect(body.preferences).toHaveLength(10);

    const byType = new Map(body.preferences.map((p) => [p.type, p]));
    expect(byType.get('missed_dose')).toEqual({
      type: 'missed_dose',
      enabled: true,
      alwaysEnabled: true,
    });
    expect(byType.get('security_alert')).toEqual({
      type: 'security_alert',
      enabled: true,
      alwaysEnabled: true,
    });
    expect(byType.get('reminder')).toEqual({
      type: 'reminder',
      enabled: true,
      alwaysEnabled: false,
    });
    await app.close();
  });

  it('applique les préférences stockées en DB (opt-out explicite)', async () => {
    const db = makeMockDb([
      { type: 'peer_dose_recorded', enabled: false },
      { type: 'pump_low', enabled: false },
    ]);
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = res.json() as {
      preferences: Array<{ type: string; enabled: boolean }>;
    };
    const byType = new Map(body.preferences.map((p) => [p.type, p]));
    expect(byType.get('peer_dose_recorded')?.enabled).toBe(false);
    expect(byType.get('pump_low')?.enabled).toBe(false);
    expect(byType.get('reminder')?.enabled).toBe(true);
    await app.close();
  });

  it('force enabled=true pour les sanctuarisés même si stockés par erreur en DB', async () => {
    // Défense en profondeur : si une ligne parasite existait pour missed_dose,
    // le backend ne doit pas la respecter dans sa réponse.
    const db = makeMockDb([
      { type: 'missed_dose', enabled: false },
      { type: 'security_alert', enabled: false },
    ]);
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = res.json() as {
      preferences: Array<{ type: string; enabled: boolean }>;
    };
    const byType = new Map(body.preferences.map((p) => [p.type, p]));
    expect(byType.get('missed_dose')?.enabled).toBe(true);
    expect(byType.get('security_alert')?.enabled).toBe(true);
    await app.close();
  });
});

describe('PUT /me/notification-preferences', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      payload: { type: 'reminder', enabled: false },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si le body est mal formé', async () => {
    const app = buildTestApp(makeMockDb());
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'not_a_real_type', enabled: false },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si on tente de désactiver missed_dose', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'missed_dose', enabled: false },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'type_not_disablable' });
    expect(db.insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('retourne 400 si on tente de désactiver security_alert', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'security_alert', enabled: false },
    });
    expect(res.statusCode).toBe(400);
    expect(db.insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('accepte silencieusement enabled=true sur missed_dose (no-op, pas de persistance)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'missed_dose', enabled: true },
    });
    expect(res.statusCode).toBe(204);
    expect(db.insert).not.toHaveBeenCalled();
    await app.close();
  });

  it('persiste une désactivation pour un type togglable (ex. reminder)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'reminder', enabled: false },
    });
    expect(res.statusCode).toBe(204);
    expect(db.insert).toHaveBeenCalledOnce();
    expect(db._insertValues).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      notificationType: 'reminder',
      enabled: false,
    });
    expect(db._onConflictDoUpdate).toHaveBeenCalledOnce();
    await app.close();
  });

  it('persiste une réactivation (upsert enabled=true) pour un type togglable', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/me/notification-preferences',
      headers: { Authorization: `Bearer ${token}` },
      payload: { type: 'peer_dose_recorded', enabled: true },
    });
    expect(res.statusCode).toBe(204);
    expect(db._insertValues).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      notificationType: 'peer_dose_recorded',
      enabled: true,
    });
    await app.close();
  });
});

describe('createDrizzleNotificationPreferenceStore', () => {
  it('retourne un Set vide si accountIds est vide', async () => {
    const db = makeMockDb();
    const store = createDrizzleNotificationPreferenceStore(db);
    const result = await store.findDisabledAccountIds([], 'reminder');
    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("retourne un Set vide pour les types sanctuarisés (n'interroge pas la DB)", async () => {
    const db = makeMockDb();
    const store = createDrizzleNotificationPreferenceStore(db);
    expect((await store.findDisabledAccountIds(['acc-1'], 'missed_dose')).size).toBe(0);
    expect((await store.findDisabledAccountIds(['acc-1'], 'security_alert')).size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('retourne les accountIds dont la préférence est explicitement enabled=false', async () => {
    // On ne peut pas facilement mocker le SELECT complet ici — on vérifie
    // que l'appel est bien émis avec les bons paramètres, et que l'implémentation
    // mappe correctement la réponse.
    const db = makeMockDb();
    db._selectRows.push({ type: 'anything', enabled: false });
    // On remplace le mock de `where` pour retourner un jeu custom pour ce test.
    const whereMock = vi.fn().mockResolvedValue([{ accountId: 'acc-2' }, { accountId: 'acc-3' }]);
    (db.select as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({ where: whereMock }),
    });

    const store = createDrizzleNotificationPreferenceStore(db);
    const result = await store.findDisabledAccountIds(
      ['acc-1', 'acc-2', 'acc-3'],
      'peer_dose_recorded',
    );
    expect(result).toEqual(new Set(['acc-2', 'acc-3']));
    expect(whereMock).toHaveBeenCalledOnce();
  });
});
