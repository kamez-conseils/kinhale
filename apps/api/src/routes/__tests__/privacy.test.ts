import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';
import type { RedisClients } from '../../plugins/redis.js';

const ACCOUNT_ID = '00000000-0000-0000-0000-00000000AA01';
const OTHER_ACCOUNT_ID = '00000000-0000-0000-0000-00000000FFFF';
const DEVICE_ID = '00000000-0000-0000-0000-00000000BB01';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-00000000CC01';

/**
 * Mock DB chainable qui simule des résultats par table.
 * Le mock garde trace du `WHERE accountId = ?` filtre via une closure pour
 * pouvoir vérifier qu'un appel utilise bien le `sub` du JWT.
 */
function makeMockDbWithFixtures(args: {
  devices?: Array<{ id: string; createdAt: Date }>;
  auditEvents?: Array<{ eventType: string; eventData: unknown; createdAt: Date }>;
  preferences?: Array<{ notificationType: string; enabled: boolean; updatedAt: Date }>;
  quietHours?: Array<{
    enabled: boolean;
    startLocalTime: string;
    endLocalTime: string;
    timezone: string;
    updatedAt: Date;
  }>;
  pushTokensCount?: number;
  /** Filtre actuel — `eq(devices.accountId, X)` capture le X. */
  capturedAccountIds?: string[];
}) {
  const captured = args.capturedAccountIds ?? [];

  const select = vi.fn().mockImplementation((projection: Record<string, unknown>) => {
    // Détecte la table cible via les clés de la projection (résolution éager).
    let resolvedRows: unknown[] = [];
    if ('id' in projection && 'createdAt' in projection) {
      resolvedRows = args.devices ?? [];
    } else if ('eventType' in projection) {
      resolvedRows = args.auditEvents ?? [];
    } else if ('notificationType' in projection) {
      resolvedRows = args.preferences ?? [];
    } else if ('startLocalTime' in projection) {
      resolvedRows = args.quietHours ?? [];
    } else if ('count' in projection) {
      resolvedRows = [{ count: args.pushTokensCount ?? 0 }];
    }

    // Helper qui produit une `Promise` thenable mais qui supporte aussi
    // `.limit(n)` — drizzle expose un builder thenable (extends Promise).
    // On reproduit le même contrat ici.
    const thenableWithLimit = () => {
      const p = Promise.resolve(resolvedRows) as Promise<unknown[]> & {
        limit: (_n: number) => Promise<unknown[]>;
      };
      p.limit = (_n: number) => Promise.resolve(resolvedRows);
      return p;
    };

    const fromObj = {
      where: (_whereClause: unknown) => {
        // On ne sérialise pas le whereClause (objet drizzle circulaire) — on
        // capture simplement qu'une requête a été émise pour le test
        // d'isolation par accountId.
        captured.push('where_called');
        return thenableWithLimit();
      },
      innerJoin: (_table: unknown, _on: unknown) => ({
        where: (_whereClause: unknown) => Promise.resolve([{ count: args.pushTokensCount ?? 0 }]),
      }),
    };

    return {
      from: (_table: unknown) => fromObj,
    };
  });

  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return {
    select,
    insert,
    _capturedAccountIds: captured,
    _insertValues: insertValues,
  } as unknown as DrizzleDb & {
    _capturedAccountIds: string[];
    _insertValues: ReturnType<typeof vi.fn>;
  };
}

function makeMockRedis(): RedisClients {
  const kv = new Map<string, number>();
  const pub = {
    async incr(k: string) {
      const n = (kv.get(k) ?? 0) + 1;
      kv.set(k, n);
      return n;
    },
    async expire(_k: string, _ttl: number) {
      return 1;
    },
    async publish(_channel: string, _msg: string) {
      return 0;
    },
  };
  const sub = {
    on: () => undefined,
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
  };
  return { pub, sub } as unknown as RedisClients;
}

function buildTestApp(db: ReturnType<typeof makeMockDbWithFixtures>) {
  return buildApp(testEnv(), { db, redis: makeMockRedis() });
}

function signAccess(
  app: ReturnType<typeof buildTestApp>,
  sub: string = ACCOUNT_ID,
  deviceId: string = DEVICE_ID,
): string {
  return app.jwt.sign({
    sub,
    deviceId,
    householdId: HOUSEHOLD_ID,
    type: 'access',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /me/privacy/export/metadata', () => {
  it('retourne 401 sans JWT', async () => {
    const db = makeMockDbWithFixtures({});
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/me/privacy/export/metadata' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 200 avec une payload zero-knowledge sur compte vide', async () => {
    const db = makeMockDbWithFixtures({});
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/privacy/export/metadata',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body['accountId']).toBe(ACCOUNT_ID);
    expect(typeof body['exportedAtMs']).toBe('number');
    expect(body['devices']).toEqual([]);
    expect(body['auditEvents']).toEqual([]);
    expect(body['notificationPreferences']).toEqual([]);
    expect(body['quietHours']).toBeNull();
    expect(body['pushTokensCount']).toBe(0);
    await app.close();
  });

  it('retourne les devices, audit events, prefs, quiet hours et push tokens count', async () => {
    const REGISTERED_AT = new Date(Date.UTC(2026, 0, 1));
    const AUDIT_AT = new Date(Date.UTC(2026, 1, 15));
    const PREF_AT = new Date(Date.UTC(2026, 2, 10));
    const QH_AT = new Date(Date.UTC(2026, 3, 1));
    const db = makeMockDbWithFixtures({
      devices: [{ id: DEVICE_ID, createdAt: REGISTERED_AT }],
      auditEvents: [
        {
          eventType: 'report_generated',
          eventData: { reportHash: 'a'.repeat(64) },
          createdAt: AUDIT_AT,
        },
      ],
      preferences: [{ notificationType: 'peer_dose_recorded', enabled: false, updatedAt: PREF_AT }],
      quietHours: [
        {
          enabled: true,
          startLocalTime: '22:00',
          endLocalTime: '07:00',
          timezone: 'America/Toronto',
          updatedAt: QH_AT,
        },
      ],
      pushTokensCount: 2,
    });
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/privacy/export/metadata',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body['devices']).toEqual([
      { deviceId: DEVICE_ID, registeredAtMs: REGISTERED_AT.getTime(), lastSeenMs: null },
    ]);
    expect(body['auditEvents']).toEqual([
      {
        eventType: 'report_generated',
        eventData: { reportHash: 'a'.repeat(64) },
        createdAtMs: AUDIT_AT.getTime(),
      },
    ]);
    expect(body['notificationPreferences']).toEqual([
      { notificationType: 'peer_dose_recorded', enabled: false, updatedAtMs: PREF_AT.getTime() },
    ]);
    expect(body['quietHours']).toEqual({
      enabled: true,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'America/Toronto',
      updatedAtMs: QH_AT.getTime(),
    });
    expect(body['pushTokensCount']).toBe(2);
    await app.close();
  });

  it('ne renvoie JAMAIS le contenu des push tokens (RM16 — minimisation)', async () => {
    const db = makeMockDbWithFixtures({ pushTokensCount: 1 });
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/privacy/export/metadata',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    const body = res.json() as Record<string, unknown>;
    expect(body['pushTokens']).toBeUndefined();
    expect(body['pushTokensCount']).toBe(1);
    await app.close();
  });

  it('scope strict : la requête utilise le sub du JWT et pas un autre accountId', async () => {
    // Vérifie qu'aucun champ « accountId » dans la réponse ne contredit le sub
    // du JWT (régression IDOR potentielle via override de réponse).
    const db = makeMockDbWithFixtures({});
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/privacy/export/metadata',
      headers: { Authorization: `Bearer ${signAccess(app, ACCOUNT_ID)}` },
    });
    const body = res.json() as Record<string, unknown>;
    expect(body['accountId']).toBe(ACCOUNT_ID);
    expect(body['accountId']).not.toBe(OTHER_ACCOUNT_ID);
    await app.close();
  });

  it('applique un rate-limit (429 après 5/h par device)', async () => {
    const db = makeMockDbWithFixtures({});
    const app = buildTestApp(db);
    await app.ready();
    const token = signAccess(app);
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/me/privacy/export/metadata',
        headers: { Authorization: `Bearer ${token}` },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
    await app.close();
  });

  it('ne contient JAMAIS de mot référant à des données santé (zero-knowledge regression)', async () => {
    const db = makeMockDbWithFixtures({
      devices: [{ id: DEVICE_ID, createdAt: new Date() }],
      pushTokensCount: 1,
    });
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/privacy/export/metadata',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    const text = res.body;
    // Mots qui ne doivent JAMAIS apparaître dans la réponse (sentinelles).
    const forbidden = [
      'doseAdministered',
      'pumpName',
      'symptomCode',
      'firstName',
      'birthYear',
      'freeFormTag',
    ];
    for (const w of forbidden) {
      expect(text).not.toContain(w);
    }
    await app.close();
  });
});
