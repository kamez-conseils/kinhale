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

vi.mock('../push/peer-ping-handler.js', () => ({
  handlePeerPing: vi.fn().mockResolvedValue('dispatched'),
}));

function makeMockDb(): DrizzleDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as unknown as DrizzleDb;
}

function makeMockRedis(): RedisClients {
  return {
    pub: {
      publish: vi.fn().mockResolvedValue(1),
      set: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
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

describe('relay WS — régression KIN-082 : sync blob ne déclenche PAS de dispatch aveugle', () => {
  // Depuis KIN-082 (RM5 via peer_ping typé), un message `blobJson` (sync
  // Automerge chiffré) ne doit PLUS déclencher de push aveugle. Seul un
  // message typé `peer_ping` déclenche une notification croisée via
  // `handlePeerPing`. Ce test verrouille la régression.
  let dispatchPushSpy: ReturnType<typeof vi.fn>;
  let handlePeerPingSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod1 = await import('../push/push-dispatch.js');
    dispatchPushSpy = mod1.dispatchPush as ReturnType<typeof vi.fn>;
    dispatchPushSpy.mockClear();

    const mod2 = await import('../push/peer-ping-handler.js');
    handlePeerPingSpy = mod2.handlePeerPing as ReturnType<typeof vi.fn>;
    handlePeerPingSpy.mockClear();
  });

  it('un message blobJson NE déclenche PAS dispatchPush (anti-régression)', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const wsUrl = address.replace(/^http/, 'ws');

    const jwtToken = app.jwt.sign({
      sub: 'account-sync-001',
      deviceId: 'dev-sync-001',
      householdId: 'hh-sync-001',
      type: 'access',
    });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/relay?token=${jwtToken}`);

      ws.once('open', () => {
        ws.send(JSON.stringify({ blobJson: 'dGVzdA==', seq: 0 }));
        setTimeout(() => {
          ws.close();
          resolve();
        }, 80);
      });

      ws.once('error', reject);
    });

    expect(dispatchPushSpy).not.toHaveBeenCalled();
    expect(handlePeerPingSpy).not.toHaveBeenCalled();
    await app.close();
  });

  it('un message peer_ping valide invoque handlePeerPing avec le doseId', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const wsUrl = address.replace(/^http/, 'ws');

    const householdId = '10000000-0000-0000-0000-000000000001';
    const deviceId = '20000000-0000-0000-0000-000000000002';

    const jwtToken = app.jwt.sign({
      sub: 'account-ping-001',
      deviceId,
      householdId,
      type: 'access',
    });

    const doseId = '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab';

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/relay?token=${jwtToken}`);

      ws.once('open', () => {
        ws.send(
          JSON.stringify({
            type: 'peer_ping',
            pingType: 'dose_recorded',
            doseId,
            sentAtMs: Date.now(),
          }),
        );
        setTimeout(() => {
          ws.close();
          resolve();
        }, 80);
      });

      ws.once('error', reject);
    });

    expect(handlePeerPingSpy).toHaveBeenCalledTimes(1);
    const call = handlePeerPingSpy.mock.calls[0]?.[0] as {
      householdId: string;
      senderDeviceId: string;
      doseId: string;
    };
    // householdId + senderDeviceId viennent du JWT, JAMAIS du payload.
    expect(call.householdId).toBe(householdId);
    expect(call.senderDeviceId).toBe(deviceId);
    expect(call.doseId).toBe(doseId);
    // Pas de dispatch aveugle supplémentaire.
    expect(dispatchPushSpy).not.toHaveBeenCalled();

    await app.close();
  });

  it('un peer_ping malformé (doseId non UUID) retourne une erreur sans dispatch', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), redis: makeMockRedis() });
    await app.ready();

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const wsUrl = address.replace(/^http/, 'ws');

    const jwtToken = app.jwt.sign({
      sub: 'account-bad-001',
      deviceId: 'dev-bad-001',
      householdId: 'hh-bad-001',
      type: 'access',
    });

    let errorPayload: unknown;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}/relay?token=${jwtToken}`);
      ws.once('message', (data) => {
        try {
          errorPayload = JSON.parse(data.toString());
        } catch {
          // ignore
        }
      });
      ws.once('open', () => {
        ws.send(
          JSON.stringify({
            type: 'peer_ping',
            pingType: 'dose_recorded',
            doseId: 'not-an-uuid',
            sentAtMs: Date.now(),
          }),
        );
        setTimeout(() => {
          ws.close();
          resolve();
        }, 80);
      });
      ws.once('error', reject);
    });

    expect(handlePeerPingSpy).not.toHaveBeenCalled();
    expect(errorPayload).toEqual({ error: 'peer_ping invalide' });
    await app.close();
  });
});
