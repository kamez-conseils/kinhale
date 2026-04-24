import { describe, it, expect, vi } from 'vitest';
import { buildApp } from '../app.js';
import { testEnv } from '../env.js';
import type { DrizzleDb } from '../plugins/db.js';
import type { RedisClients } from '../plugins/redis.js';
import type { Redis } from 'ioredis';

function makeMockDb(): DrizzleDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as unknown as DrizzleDb;
}

function makeMockRedis(): {
  redis: RedisClients;
  store: Map<string, { value: string; ttlSeconds: number | null }>;
  publishSpy: ReturnType<typeof vi.fn>;
} {
  const store = new Map<string, { value: string; ttlSeconds: number | null }>();
  const publishSpy = vi.fn().mockResolvedValue(1);
  const redis: RedisClients = {
    pub: {
      publish: publishSpy,
      // `SET key value EX seconds NX` — retourne 'OK' si posé, null si déjà existant.
      set: vi.fn(
        async (
          key: string,
          value: string,
          ..._args: Array<string | number>
        ): Promise<'OK' | null> => {
          if (store.has(key)) return null;
          store.set(key, { value, ttlSeconds: null });
          return 'OK';
        },
      ),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis,
    sub: {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis,
  };
  return { redis, store, publishSpy };
}

const validMessage = {
  blobJson: '{"nonce":"aabbcc","ciphertext":"ddeeff"}',
  seq: 1,
  sentAtMs: 1_700_000_000_000,
};

describe('POST /sync/batch', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis().redis });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [validMessage] },
      headers: { 'idempotency-key': 'key-001' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 sans header Idempotency-Key', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis().redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [validMessage] },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/idempotency/i);
    await app.close();
  });

  it('retourne 400 si messages est vide', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis().redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [] },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-002' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si plus de 100 messages', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis().redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const tooManyMessages = Array.from({ length: 101 }, (_, i) => ({
      ...validMessage,
      seq: i + 1,
    }));
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: tooManyMessages },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-003' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 202 + insère chaque message + publie sur Redis', async () => {
    const db = makeMockDb();
    const valuesSpy = vi.fn().mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue({
      values: valuesSpy,
    } as unknown as ReturnType<typeof db.insert>);
    const { redis, publishSpy } = makeMockRedis();

    const app = buildApp(testEnv(), { db, redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });

    const messages = [
      { ...validMessage, seq: 1 },
      { ...validMessage, seq: 2 },
      { ...validMessage, seq: 3 },
    ];
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-004' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<{ accepted: number }>().accepted).toBe(3);
    // Insertion batch unique : values([row1, row2, row3]).
    expect(valuesSpy).toHaveBeenCalledTimes(1);
    expect(valuesSpy.mock.calls[0]?.[0]).toHaveLength(3);
    // Broadcast Redis vers le canal du foyer pour que les autres devices reçoivent.
    expect(publishSpy).toHaveBeenCalledTimes(3);
    const firstPublish = publishSpy.mock.calls[0];
    expect(firstPublish?.[0]).toBe('household:hh-001');
    await app.close();
  });

  it('déduplique : même Idempotency-Key → 200 sans ré-insert', async () => {
    const db = makeMockDb();
    const valuesSpy = vi.fn().mockResolvedValue([]);
    vi.mocked(db.insert).mockReturnValue({
      values: valuesSpy,
    } as unknown as ReturnType<typeof db.insert>);
    const { redis, publishSpy } = makeMockRedis();

    const app = buildApp(testEnv(), { db, redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });

    const payload = { messages: [validMessage] };
    const headers = { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-dup' };

    const res1 = await app.inject({ method: 'POST', url: '/sync/batch', payload, headers });
    expect(res1.statusCode).toBe(200);
    expect(res1.json<{ duplicate: boolean }>().duplicate).toBe(false);

    const res2 = await app.inject({ method: 'POST', url: '/sync/batch', payload, headers });
    expect(res2.statusCode).toBe(200);
    expect(res2.json<{ duplicate: boolean }>().duplicate).toBe(true);

    // Le 2e appel ne doit pas ré-insérer ni re-publier.
    expect(valuesSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('valide la forme de chaque message (blobJson string, seq number, sentAtMs number)', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis().redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [{ blobJson: 42, seq: 'not-a-number', sentAtMs: null }] },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-invalid' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 503 si la persistance échoue', async () => {
    const db = makeMockDb();
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as ReturnType<typeof db.insert>);

    const app = buildApp(testEnv(), { db, redis: makeMockRedis().redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [validMessage] },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-503' },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it('retourne 400 si un blobJson dépasse 64 KiB', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis().redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const bigBlob = 'x'.repeat(64 * 1024 + 1);
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [{ ...validMessage, blobJson: bigBlob }] },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-too-big' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("libère l'Idempotency-Key si la persistance échoue (permet un retry propre)", async () => {
    const db = makeMockDb();
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB down')),
    } as unknown as ReturnType<typeof db.insert>);

    // Redis avec del spy + store manuel pour vérifier le cleanup.
    const store = new Map<string, string>();
    const publishSpy = vi.fn().mockResolvedValue(1);
    const delSpy = vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    });
    const setSpy = vi.fn(async (key: string): Promise<'OK' | null> => {
      if (store.has(key)) return null;
      store.set(key, '1');
      return 'OK';
    });
    const redis = {
      pub: { publish: publishSpy, set: setSpy, del: delSpy, quit: vi.fn() },
      sub: { subscribe: vi.fn(), unsubscribe: vi.fn(), on: vi.fn(), quit: vi.fn() },
    } as unknown as RedisClients;

    const app = buildApp(testEnv(), { db, redis });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/sync/batch',
      payload: { messages: [validMessage] },
      headers: { Authorization: `Bearer ${token}`, 'idempotency-key': 'key-del-me' },
    });

    expect(res.statusCode).toBe(503);
    // Key posée puis supprimée → store Redis vide après l'échec.
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(delSpy).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
    await app.close();
  });
});
