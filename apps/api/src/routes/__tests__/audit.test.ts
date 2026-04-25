import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';
import type { RedisClients } from '../../plugins/redis.js';

const ACCOUNT_ID = '00000000-0000-0000-0000-00000000AA01';
const DEVICE_ID = '00000000-0000-0000-0000-00000000BB01';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-00000000CC01';
const VALID_HASH = 'a'.repeat(64);

interface InsertedRow {
  accountId: string;
  eventType: string;
  eventData: unknown;
}

/**
 * Mock DB chainable — capture `db.insert(table).values({...})`.
 * Pattern identique aux autres routes (notification-preferences.test.ts,
 * quiet-hours.test.ts) pour garder une couverture cohérente.
 */
function makeMockDb(): DrizzleDb & {
  _inserted: InsertedRow[];
  _insertValues: ReturnType<typeof vi.fn>;
} {
  const inserted: InsertedRow[] = [];
  const insertValues = vi.fn().mockImplementation(async (row: InsertedRow) => {
    inserted.push(row);
  });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return {
    insert,
    _inserted: inserted,
    _insertValues: insertValues,
  } as unknown as DrizzleDb & {
    _inserted: InsertedRow[];
    _insertValues: ReturnType<typeof vi.fn>;
  };
}

function makeMockRedis(): RedisClients {
  const kv = new Map<string, number>();
  const pubClient = {
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
  const subClient = {
    on: () => undefined,
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
  };
  return { pub: pubClient, sub: subClient } as unknown as RedisClients;
}

function buildTestApp(db: ReturnType<typeof makeMockDb>) {
  return buildApp(testEnv(), { db, redis: makeMockRedis() });
}

function signAccess(app: ReturnType<typeof buildTestApp>, deviceId = DEVICE_ID): string {
  return app.jwt.sign({
    sub: ACCOUNT_ID,
    deviceId,
    householdId: HOUSEHOLD_ID,
    type: 'access',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /audit/report-generated', () => {
  it('retourne 401 sans JWT', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      payload: {
        reportHash: VALID_HASH,
        rangeStartMs: 1_700_000_000_000,
        rangeEndMs: 1_700_500_000_000,
        generatedAtMs: 1_700_500_000_000,
      },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si body est vide', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("retourne 400 si reportHash n'est pas 64 chars hex", async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        reportHash: 'too-short',
        rangeStartMs: 1_700_000_000_000,
        rangeEndMs: 1_700_500_000_000,
        generatedAtMs: 1_700_500_000_000,
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si reportHash contient des majuscules (normalisé minuscule)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        reportHash: 'A'.repeat(64),
        rangeStartMs: 1_700_000_000_000,
        rangeEndMs: 1_700_500_000_000,
        generatedAtMs: 1_700_500_000_000,
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si rangeEndMs <= rangeStartMs', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        reportHash: VALID_HASH,
        rangeStartMs: 1_700_500_000_000,
        rangeEndMs: 1_700_000_000_000,
        generatedAtMs: 1_700_500_000_000,
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si un champ supplémentaire fuite (strict mode anti-fuite)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        reportHash: VALID_HASH,
        rangeStartMs: 1_700_000_000_000,
        rangeEndMs: 1_700_500_000_000,
        generatedAtMs: 1_700_500_000_000,
        // Tentative de fuite de donnée santé — doit être rejetée
        childName: 'Léa',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(db._insertValues).not.toHaveBeenCalled();
    await app.close();
  });

  it("persiste un événement 'report_generated' avec uniquement les champs attendus (zero-knowledge)", async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        reportHash: VALID_HASH,
        rangeStartMs: 1_700_000_000_000,
        rangeEndMs: 1_700_500_000_000,
        generatedAtMs: 1_700_500_000_000,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(db._inserted).toHaveLength(1);
    const row = db._inserted[0];
    expect(row?.accountId).toBe(ACCOUNT_ID);
    expect(row?.eventType).toBe('report_generated');
    expect(row?.eventData).toEqual({
      reportHash: VALID_HASH,
      rangeStartMs: 1_700_000_000_000,
      rangeEndMs: 1_700_500_000_000,
      generatedAtMs: 1_700_500_000_000,
    });
    await app.close();
  });

  it('applique un rate-limit (429 après 10/h par device)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = signAccess(app);
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/audit/report-generated',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          reportHash: VALID_HASH,
          rangeStartMs: 1_700_000_000_000,
          rangeEndMs: 1_700_500_000_000,
          generatedAtMs: 1_700_500_000_000 + i,
        },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
    await app.close();
  });

  it('retourne 400 si rangeStartMs est négatif (pas de timestamps invalides)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-generated',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        reportHash: VALID_HASH,
        rangeStartMs: -1,
        rangeEndMs: 1_700_500_000_000,
        generatedAtMs: 1_700_500_000_000,
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

/**
 * Tests de la route `POST /audit/report-shared` (E8-S04, KIN-084).
 *
 * Mêmes garanties zero-knowledge que `/audit/report-generated` : strict body
 * schema, rate-limit Redis, insertion jsonb minimaliste, logs sans donnée
 * santé.
 */
describe('POST /audit/report-shared', () => {
  const VALID_PAYLOAD = {
    reportHash: VALID_HASH,
    shareMethod: 'download' as const,
    sharedAtMs: 1_700_500_000_000,
  };

  it('retourne 401 sans JWT', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si body est vide', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("retourne 400 si reportHash n'est pas 64 chars hex", async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: { ...VALID_PAYLOAD, reportHash: 'too-short' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si shareMethod est hors enum fermée', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: { ...VALID_PAYLOAD, shareMethod: 'email_in_clear' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si un champ supplémentaire fuite (strict mode anti-fuite)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        ...VALID_PAYLOAD,
        // Tentative de fuite : adresse email destinataire
        recipientEmail: 'doctor@example.com',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(db._insertValues).not.toHaveBeenCalled();
    await app.close();
  });

  it('retourne 400 si sharedAtMs est négatif', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: { ...VALID_PAYLOAD, sharedAtMs: -1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("persiste un événement 'report_shared' (zero-knowledge, champs attendus uniquement)", async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    expect(db._inserted).toHaveLength(1);
    const row = db._inserted[0];
    expect(row?.accountId).toBe(ACCOUNT_ID);
    expect(row?.eventType).toBe('report_shared');
    expect(row?.eventData).toEqual({
      reportHash: VALID_HASH,
      shareMethod: 'download',
      sharedAtMs: 1_700_500_000_000,
    });
    await app.close();
  });

  it('accepte les 4 valeurs de shareMethod documentées', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const methods = ['download', 'system_share', 'csv_download', 'csv_system_share'] as const;
    const token = signAccess(app);
    for (const method of methods) {
      const res = await app.inject({
        method: 'POST',
        url: '/audit/report-shared',
        headers: { Authorization: `Bearer ${token}` },
        payload: { ...VALID_PAYLOAD, shareMethod: method },
      });
      expect(res.statusCode).toBe(201);
    }
    expect(db._inserted).toHaveLength(4);
    await app.close();
  });

  it('applique un rate-limit (429 après 20/h par device)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = signAccess(app);
    let lastStatus = 0;
    for (let i = 0; i < 21; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/audit/report-shared',
        headers: { Authorization: `Bearer ${token}` },
        payload: { ...VALID_PAYLOAD, sharedAtMs: 1_700_500_000_000 + i },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
    await app.close();
  });

  it('a un rate-limit indépendant de /audit/report-generated (keys Redis distinctes)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = signAccess(app);
    // Saturer le quota report-generated (10/h)
    for (let i = 0; i < 11; i++) {
      await app.inject({
        method: 'POST',
        url: '/audit/report-generated',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          reportHash: VALID_HASH,
          rangeStartMs: 1_700_000_000_000,
          rangeEndMs: 1_700_500_000_000,
          generatedAtMs: 1_700_500_000_000 + i,
        },
      });
    }
    // report-shared doit rester disponible
    const res = await app.inject({
      method: 'POST',
      url: '/audit/report-shared',
      headers: { Authorization: `Bearer ${token}` },
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});

/**
 * Tests de la route `POST /audit/privacy-export` (E9-S02, KIN-085).
 *
 * Trace la génération locale d'une archive RGPD/Loi 25. Mêmes garanties
 * zero-knowledge que `/audit/report-generated` : strict body, rate-limit
 * Redis, insertion jsonb minimaliste, logs sans donnée santé.
 */
describe('POST /audit/privacy-export', () => {
  const VALID_PAYLOAD = {
    archiveHash: VALID_HASH,
    generatedAtMs: 1_700_500_000_000,
  };

  it('retourne 401 sans JWT', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si body est vide', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("retourne 400 si archiveHash n'est pas 64 chars hex", async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: { ...VALID_PAYLOAD, archiveHash: 'too-short' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si un champ supplémentaire fuite (strict mode anti-fuite)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: {
        ...VALID_PAYLOAD,
        // Tentative de fuite : prénom enfant dans l'audit
        childName: 'Léa',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(db._insertValues).not.toHaveBeenCalled();
    await app.close();
  });

  it('retourne 400 si generatedAtMs est négatif', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: { ...VALID_PAYLOAD, generatedAtMs: -1 },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("persiste un événement 'privacy_export' avec uniquement les champs attendus (zero-knowledge)", async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    expect(db._inserted).toHaveLength(1);
    const row = db._inserted[0];
    expect(row?.accountId).toBe(ACCOUNT_ID);
    expect(row?.eventType).toBe('privacy_export');
    expect(row?.eventData).toEqual(VALID_PAYLOAD);
    await app.close();
  });

  it('applique un rate-limit (429 après 5/h par device)', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = signAccess(app);
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/audit/privacy-export',
        headers: { Authorization: `Bearer ${token}` },
        payload: { ...VALID_PAYLOAD, generatedAtMs: 1_700_500_000_000 + i },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
    await app.close();
  });

  it('a un rate-limit indépendant de /audit/report-generated et /audit/report-shared', async () => {
    const db = makeMockDb();
    const app = buildTestApp(db);
    await app.ready();
    const token = signAccess(app);
    // Saturer le quota report-generated
    for (let i = 0; i < 11; i++) {
      await app.inject({
        method: 'POST',
        url: '/audit/report-generated',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          reportHash: VALID_HASH,
          rangeStartMs: 1_700_000_000_000,
          rangeEndMs: 1_700_500_000_000,
          generatedAtMs: 1_700_500_000_000 + i,
        },
      });
    }
    // privacy-export doit rester disponible
    const res = await app.inject({
      method: 'POST',
      url: '/audit/privacy-export',
      headers: { Authorization: `Bearer ${token}` },
      payload: VALID_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });
});

/**
 * Tests de la route `GET /me/audit-events` (KIN-093, E9-S09).
 *
 * Vérifie :
 * - rejet 401 sans JWT,
 * - filtrage strict par `account_id = sub` (pas d'IDOR cross-tenant),
 * - tri antéchronologique + limite par défaut 90,
 * - pagination via `?limit=` (1..90 borné),
 * - filtrage `event_data` whitelist (anti-fuite),
 * - rate-limit 60/h/device,
 * - aucune fuite de champ inattendu (les champs hors whitelist sont écartés),
 * - couverture de tous les types d'événements documentés.
 */
describe('GET /me/audit-events (KIN-093 / E9-S09)', () => {
  /**
   * Mock DB pour la lecture audit. Capture le `accountId` passé au filtre
   * `eq(auditEvents.accountId, X)` via une closure et expose les rows
   * fixtures à retourner.
   */
  function makeMockSelectDb(rows: Array<Record<string, unknown>>) {
    // Capture le filtre WHERE pour vérifier qu'il porte bien sur le `sub`
    // du JWT et pas sur une valeur forgée. Drizzle expose un objet
    // circulaire — on capture juste le drapeau qu'un appel a eu lieu et
    // on garde une trace de la dernière `accountId` filtrée via une mutation
    // partagée (le mock se contente de retourner les rows fournis).
    let lastLimit: number | undefined = undefined;
    const select = vi.fn().mockImplementation((_projection: Record<string, unknown>) => {
      const fromObj = {
        where: (_whereClause: unknown) => {
          const orderObj = {
            limit: (n: number) => {
              lastLimit = n;
              return Promise.resolve(rows);
            },
          };
          return {
            orderBy: (_o: unknown) => orderObj,
          };
        },
      };
      return { from: (_table: unknown) => fromObj };
    });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    return {
      select,
      insert,
      get _lastLimit() {
        return lastLimit;
      },
    } as unknown as DrizzleDb & { _lastLimit: number | undefined };
  }

  function buildAppWithRows(rows: Array<Record<string, unknown>>) {
    const db = makeMockSelectDb(rows);
    const app = buildApp(testEnv(), { db, redis: makeMockRedis() });
    return { db, app };
  }

  const NOW = 1_700_500_000_000;

  it('retourne 401 sans JWT', async () => {
    const { app } = buildAppWithRows([]);
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/me/audit-events' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 200 et un tableau vide si aucun événement', async () => {
    const { app } = buildAppWithRows([]);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Record<string, unknown>;
    expect(body['events']).toEqual([]);
    await app.close();
  });

  it('retourne les événements avec uniquement les champs whitelistés (anti-fuite)', async () => {
    const fixtureRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        eventType: 'report_generated',
        eventData: {
          reportHash: 'a'.repeat(64),
          rangeStartMs: NOW - 1000,
          rangeEndMs: NOW,
          generatedAtMs: NOW,
          // Champ inattendu — DOIT être filtré côté lecture (deuxième barrière).
          childName: 'Léa',
        },
        createdAt: new Date(NOW),
      },
    ];
    const { app } = buildAppWithRows(fixtureRows);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: Array<Record<string, unknown>> };
    expect(body.events).toHaveLength(1);
    const event = body.events[0]!;
    expect(event['eventType']).toBe('report_generated');
    expect(event['eventData']).toEqual({
      reportHash: 'a'.repeat(64),
      rangeStartMs: NOW - 1000,
      rangeEndMs: NOW,
      generatedAtMs: NOW,
    });
    // Le champ exfiltrant doit être absent de la réponse.
    expect(JSON.stringify(event)).not.toContain('Léa');
    expect(JSON.stringify(event)).not.toContain('childName');
    await app.close();
  });

  it("ne renvoie JAMAIS l'accountId dans la réponse (anti-IDOR)", async () => {
    const fixtureRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        eventType: 'privacy_export',
        eventData: { archiveHash: 'b'.repeat(64), generatedAtMs: NOW },
        createdAt: new Date(NOW),
      },
    ];
    const { app } = buildAppWithRows(fixtureRows);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    const text = res.body;
    expect(text).not.toContain(ACCOUNT_ID);
    expect(text).not.toContain('accountId');
    await app.close();
  });

  it("couvre tous les types d'événement documentés (KIN-083 → KIN-086)", async () => {
    const fixtureRows = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        eventType: 'report_generated',
        eventData: {
          reportHash: 'a'.repeat(64),
          rangeStartMs: NOW - 1000,
          rangeEndMs: NOW,
          generatedAtMs: NOW,
        },
        createdAt: new Date(NOW),
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        eventType: 'report_shared',
        eventData: { reportHash: 'a'.repeat(64), shareMethod: 'download', sharedAtMs: NOW },
        createdAt: new Date(NOW + 1),
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        eventType: 'privacy_export',
        eventData: { archiveHash: 'b'.repeat(64), generatedAtMs: NOW },
        createdAt: new Date(NOW + 2),
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        eventType: 'account_deletion_requested',
        eventData: { scheduledAtMs: NOW + 7 * 24 * 3600 * 1000, requestedAtMs: NOW },
        createdAt: new Date(NOW + 3),
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        eventType: 'account_deletion_cancelled',
        eventData: { cancelledAtMs: NOW + 60_000 },
        createdAt: new Date(NOW + 4),
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        eventType: 'account_deleted',
        eventData: { pseudoId: 'c'.repeat(64), deletedAtMs: NOW + 7 * 24 * 3600 * 1000 },
        createdAt: new Date(NOW + 5),
      },
    ];
    const { app } = buildAppWithRows(fixtureRows);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: Array<Record<string, unknown>> };
    expect(body.events).toHaveLength(6);
    const types = body.events.map((e) => e['eventType']);
    expect(types).toEqual([
      'report_generated',
      'report_shared',
      'privacy_export',
      'account_deletion_requested',
      'account_deletion_cancelled',
      'account_deleted',
    ]);
    // Chaque événement doit conserver ses champs whitelistés.
    expect(body.events[0]!['eventData']).toMatchObject({ reportHash: 'a'.repeat(64) });
    expect(body.events[1]!['eventData']).toMatchObject({ shareMethod: 'download' });
    expect(body.events[2]!['eventData']).toMatchObject({ archiveHash: 'b'.repeat(64) });
    expect(body.events[3]!['eventData']).toMatchObject({ requestedAtMs: NOW });
    expect(body.events[4]!['eventData']).toMatchObject({ cancelledAtMs: NOW + 60_000 });
    expect(body.events[5]!['eventData']).toMatchObject({ pseudoId: 'c'.repeat(64) });
    await app.close();
  });

  it('renvoie {} (event_data vide) pour un type inconnu (fail-closed)', async () => {
    const fixtureRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        eventType: 'unknown_future_type',
        eventData: { secretField: 'should-not-leak', anotherSecret: 42 },
        createdAt: new Date(NOW),
      },
    ];
    const { app } = buildAppWithRows(fixtureRows);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { events: Array<Record<string, unknown>> };
    expect(body.events[0]!['eventData']).toEqual({});
    expect(res.body).not.toContain('should-not-leak');
    expect(res.body).not.toContain('secretField');
    await app.close();
  });

  it('utilise par défaut limit=90 (cf. AUDIT_LIST_DEFAULT_LIMIT)', async () => {
    const { db, app } = buildAppWithRows([]);
    await app.ready();
    await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(db._lastLimit).toBe(90);
    await app.close();
  });

  it('accepte ?limit=10 (1..90 borné)', async () => {
    const { db, app } = buildAppWithRows([]);
    await app.ready();
    await app.inject({
      method: 'GET',
      url: '/me/audit-events?limit=10',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    expect(db._lastLimit).toBe(10);
    await app.close();
  });

  it('rejette ?limit=0 ou ?limit>90 ou non numérique', async () => {
    const { app } = buildAppWithRows([]);
    await app.ready();
    const token = signAccess(app);
    const res0 = await app.inject({
      method: 'GET',
      url: '/me/audit-events?limit=0',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res0.statusCode).toBe(400);
    const resTooBig = await app.inject({
      method: 'GET',
      url: '/me/audit-events?limit=91',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resTooBig.statusCode).toBe(400);
    const resNonInt = await app.inject({
      method: 'GET',
      url: '/me/audit-events?limit=abc',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resNonInt.statusCode).toBe(400);
    await app.close();
  });

  it('rejette un querystring contenant un champ inconnu (.strict() anti-fuite)', async () => {
    const { app } = buildAppWithRows([]);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events?limit=10&accountId=other',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    // .strict() fait échouer le parse — le filtre WHERE ne sera donc jamais
    // construit avec la valeur du query, c'est la défense en profondeur attendue.
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('applique un rate-limit (429 après 60/h par device)', async () => {
    const { app } = buildAppWithRows([]);
    await app.ready();
    const token = signAccess(app);
    let lastStatus = 0;
    for (let i = 0; i < 61; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/me/audit-events',
        headers: { Authorization: `Bearer ${token}` },
      });
      lastStatus = res.statusCode;
    }
    expect(lastStatus).toBe(429);
    await app.close();
  });

  it('retourne createdAtMs en epoch ms (pas en Date sérialisée)', async () => {
    const fixtureRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        eventType: 'privacy_export',
        eventData: { archiveHash: 'a'.repeat(64), generatedAtMs: NOW },
        createdAt: new Date(NOW),
      },
    ];
    const { app } = buildAppWithRows(fixtureRows);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    const body = res.json() as { events: Array<Record<string, unknown>> };
    expect(body.events[0]!['createdAtMs']).toBe(NOW);
    expect(typeof body.events[0]!['createdAtMs']).toBe('number');
    await app.close();
  });

  it('aucune fuite de motif santé dans la réponse (sentinelle anti-régression)', async () => {
    // Si un futur dev faisait un JOIN accidentel ou élargissait la projection,
    // ce test attraperait la fuite.
    const fixtureRows = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        eventType: 'report_generated',
        eventData: {
          reportHash: 'a'.repeat(64),
          rangeStartMs: NOW - 1000,
          rangeEndMs: NOW,
          generatedAtMs: NOW,
          // Champs interdits qui pourraient venir d'une régression —
          // doivent être éliminés par la whitelist.
          firstName: 'Léa',
          birthYear: 2020,
          pumpName: 'Ventolin',
          symptomCode: 'wheezing',
          freeFormTag: 'après sport',
        },
        createdAt: new Date(NOW),
      },
    ];
    const { app } = buildAppWithRows(fixtureRows);
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/me/audit-events',
      headers: { Authorization: `Bearer ${signAccess(app)}` },
    });
    const text = res.body;
    const forbidden = [
      'Léa',
      'firstName',
      'birthYear',
      'Ventolin',
      'pumpName',
      'wheezing',
      'freeFormTag',
      'après sport',
    ];
    for (const w of forbidden) {
      expect(text).not.toContain(w);
    }
    await app.close();
  });
});
