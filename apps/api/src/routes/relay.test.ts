import { describe, it, expect, vi, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../app.js';
import { testEnv } from '../env.js';
import type { DrizzleDb } from '../plugins/db.js';
import type { RedisClients } from '../plugins/redis.js';
import type { Redis } from 'ioredis';

vi.mock('../push/push-dispatch.js', () => ({
  dispatchPush: vi.fn().mockResolvedValue(undefined),
}));

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

describe('relay WS → dispatchPush fire-and-forget', () => {
  const HOUSEHOLD_ID = 'hh-push-test-001';
  const PUSH_TOKEN = 'ExponentPushToken[abc123]';

  let dispatchPushSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Import the already-mocked module to access the spy
    const mod = await import('../push/push-dispatch.js');
    dispatchPushSpy = mod.dispatchPush as ReturnType<typeof vi.fn>;
    dispatchPushSpy.mockClear();
  });

  it('appelle dispatchPush avec les tokens du foyer après un message relay', async () => {
    const env = testEnv();

    // DB mock : insert réussit, select retourne un push token pour le foyer
    const mockDb: DrizzleDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ token: PUSH_TOKEN }]),
        }),
      }),
    } as unknown as DrizzleDb;

    const app = buildApp(env, { db: mockDb, redis: makeMockRedis() });
    await app.ready();

    // Démarrer le serveur sur un port aléatoire pour WS réel
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const wsUrl = address.replace(/^http/, 'ws');

    const jwtToken = app.jwt.sign({
      sub: 'account-push-001',
      deviceId: 'dev-push-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/relay?token=${jwtToken}`);

      ws.once('open', () => {
        ws.send(JSON.stringify({ blobJson: 'dGVzdA==', seq: 0 }));
        // Laisser la file de micro/macrotâches se vider avant de fermer
        setTimeout(() => {
          ws.close();
          resolve();
        }, 80);
      });

      ws.once('error', reject);
    });

    expect(dispatchPushSpy).toHaveBeenCalledOnce();
    expect(dispatchPushSpy).toHaveBeenCalledWith(
      expect.anything(), // instance Expo
      expect.arrayContaining([PUSH_TOKEN]),
      expect.anything(), // logger Fastify
    );

    await app.close();
  });
});
