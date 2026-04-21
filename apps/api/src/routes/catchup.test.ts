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

function makeMockRedis(): RedisClients {
  return {
    pub: {
      publish: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis,
    sub: {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as Redis,
  };
}

describe('GET /relay/catchup', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/relay/catchup' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si since est non numérique', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001', deviceId: 'dev-001', householdId: 'hh-001', type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/relay/catchup?since=abc',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 200 avec liste vide si aucun message depuis since', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001', deviceId: 'dev-001', householdId: 'hh-001', type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/relay/catchup?since=0',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ messages: unknown[] }>().messages).toHaveLength(0);
    await app.close();
  });

  it('retourne 200 avec les messages depuis le seq demandé', async () => {
    const env = testEnv();
    const mockMessages = [
      {
        id: 'msg-001',
        householdId: 'hh-001',
        senderDeviceId: 'dev-002',
        blobJson: '{"nonce":"aabbcc","ciphertext":"ddeeff"}',
        seq: 5,
        sentAtMs: 1_700_000_000_000,
        expiresAt: new Date(),
        ackedAt: null,
      },
    ];
    const db = makeMockDb();
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockMessages),
      }),
    } as ReturnType<typeof db.select>);

    const app = buildApp(env, { db, redis: makeMockRedis() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001', deviceId: 'dev-001', householdId: 'hh-001', type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/relay/catchup?since=3',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ messages: Array<{ seq: number; senderDeviceId: string }> }>();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]!.seq).toBe(5);
    expect(body.messages[0]!.senderDeviceId).toBe('dev-002');
    await app.close();
  });

  it('retourne 200 avec since=0 par défaut si absent', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001', deviceId: 'dev-001', householdId: 'hh-001', type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/relay/catchup',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
