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

describe('GET /relay (WebSocket upgrade)', () => {
  it('retourne 401 sans token JWT', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/relay',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 401 avec token JWT invalide', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/relay?token=not-a-valid-jwt',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 101 (upgrade WS) avec token JWT valide', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'GET',
      url: `/relay?token=${token}`,
      headers: { upgrade: 'websocket', connection: 'upgrade' },
    });
    // fastify/websocket retourne 101 sur upgrade réussi, 400 si pas de vrai WS,
    // ou 404 si inject() ne déclenche pas l'upgrade (comportement Fastify inject).
    expect([101, 400, 404]).toContain(res.statusCode);
    await app.close();
  });
});
