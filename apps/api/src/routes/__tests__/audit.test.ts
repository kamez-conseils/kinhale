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
