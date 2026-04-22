import { describe, it, expect } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { RedisClients } from '../../plugins/redis.js';
import type { DrizzleDb } from '../../plugins/db.js';

// ── Mock Redis (in-memory, same pattern as store.test.ts) ──────────────────

function makeMockRedis(): RedisClients {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  const pubClient = {
    async get(k: string) {
      return kv.get(k) ?? null;
    },
    async setex(k: string, _ttl: number, v: string) {
      kv.set(k, v);
      return 'OK';
    },
    async del(k: string) {
      const existed = kv.has(k);
      kv.delete(k);
      return existed ? 1 : 0;
    },
    async sadd(k: string, v: string) {
      const s = sets.get(k) ?? new Set<string>();
      const had = s.has(v);
      s.add(v);
      sets.set(k, s);
      return had ? 0 : 1;
    },
    async srem(k: string, v: string) {
      const s = sets.get(k);
      if (s === undefined) return 0;
      const removed = s.delete(v);
      return removed ? 1 : 0;
    },
    async scard(k: string) {
      return sets.get(k)?.size ?? 0;
    },
    async smembers(k: string) {
      return Array.from(sets.get(k) ?? []);
    },
    async incr(k: string) {
      const n = (Number(kv.get(k) ?? '0') || 0) + 1;
      kv.set(k, String(n));
      return n;
    },
    async expire(_k: string, _ttl: number) {
      return 1;
    },
    async publish(_channel: string, _msg: string) {
      return 0;
    },
  };

  // Sub client needs event emitter methods for relay route registration
  const subClient = {
    on: () => undefined,
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
  };

  return { pub: pubClient, sub: subClient } as unknown as RedisClients;
}

// ── Mock DB (invitations routes ne touchent pas la DB) ────────────────────

function makeMockDb(): DrizzleDb {
  return {} as unknown as DrizzleDb;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildTestApp(redis: RedisClients) {
  const env = testEnv();
  return buildApp(env, { db: makeMockDb(), redis });
}

const HOUSEHOLD_ID = 'hh-test-0001';
const ACCOUNT_ID = 'acc-test-0001';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /invitations', () => {
  it('retourne 401 sans authentification', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/invitations',
      payload: { targetRole: 'contributor', displayName: 'Mamie' },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 201 avec token, pin et expiresAtMs pour un body valide', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const jwt = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const before = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { targetRole: 'restricted_contributor', displayName: 'Garderie Les Lucioles' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<{
      token: string;
      pin: string;
      expiresAtMs: number;
      targetRole: string;
    }>();
    expect(body.token).toMatch(/^[0-9a-f]{64}$/u);
    expect(body.pin).toMatch(/^\d{6}$/u);
    expect(body.expiresAtMs).toBeGreaterThanOrEqual(before + 600_000 - 100);
    expect(body.targetRole).toBe('restricted_contributor');
    await app.close();
  });

  it('retourne 429 si 10 invitations actives pour le foyer (RM21)', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    // Pre-populate 10 tokens in the household set
    for (let i = 0; i < 10; i++) {
      await redis.pub.sadd(`inv:hh:${HOUSEHOLD_ID}`, `token-${i}`);
    }

    const jwt = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { targetRole: 'contributor', displayName: 'Papy' },
    });

    expect(res.statusCode).toBe(429);
    expect(res.json<{ error: string }>().error).toBe('invitation_quota_exceeded');
    await app.close();
  });
});

describe('GET /invitations/:token', () => {
  it('retourne 404 pour un token inconnu', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/invitations/unknowntokenvalue',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json<{ error: string }>().error).toBe('not_found_or_expired');
    await app.close();
  });

  it('retourne 200 avec targetRole et displayName (sans secret)', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    // Create an invitation first
    const jwt = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { targetRole: 'contributor', displayName: 'Nounou Marie' },
    });
    expect(createRes.statusCode).toBe(201);
    const { token } = createRes.json<{ token: string }>();

    const res = await app.inject({
      method: 'GET',
      url: `/invitations/${token}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ targetRole: string; displayName: string }>();
    expect(body.targetRole).toBe('contributor');
    expect(body.displayName).toBe('Nounou Marie');
    // Must not expose secrets
    expect(Object.keys(body)).not.toContain('pinHash');
    expect(Object.keys(body)).not.toContain('pin');
    await app.close();
  });

  it('retourne 423 pour un token verrouillé', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const token = 'locked-token-abc';
    await redis.pub.setex(`inv:lock:${token}`, 900, '1');

    const res = await app.inject({
      method: 'GET',
      url: `/invitations/${token}`,
    });

    expect(res.statusCode).toBe(423);
    expect(res.json<{ error: string }>().error).toBe('locked');
    await app.close();
  });
});

describe('POST /invitations/:token/accept', () => {
  it('retourne 400 si consentAccepted est absent (RM22)', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/invitations/sometoken/accept',
      payload: { pin: '123456' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe('consent_required');
    await app.close();
  });

  it('retourne 400 si consentAccepted est false (RM22)', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/invitations/sometoken/accept',
      payload: { pin: '123456', consentAccepted: false },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toBe('consent_required');
    await app.close();
  });

  it(
    'retourne 401 pour un PIN incorrect, puis 423 après 3 échecs',
    { timeout: 20_000 },
    async () => {
      const redis = makeMockRedis();
      const app = buildTestApp(redis);
      await app.ready();

      // Create an invitation
      const jwt = app.jwt.sign({
        sub: ACCOUNT_ID,
        deviceId: 'dev-001',
        householdId: HOUSEHOLD_ID,
        type: 'access',
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/invitations',
        headers: { Authorization: `Bearer ${jwt}` },
        payload: { targetRole: 'restricted_contributor', displayName: 'Tata Sylvie' },
      });
      const { token } = createRes.json<{ token: string }>();

      // 1st wrong PIN → 401
      const res1 = await app.inject({
        method: 'POST',
        url: `/invitations/${token}/accept`,
        payload: { pin: '000000', consentAccepted: true },
      });
      expect(res1.statusCode).toBe(401);
      expect(res1.json<{ error: string }>().error).toBe('pin_mismatch');

      // 2nd wrong PIN → 401
      const res2 = await app.inject({
        method: 'POST',
        url: `/invitations/${token}/accept`,
        payload: { pin: '000000', consentAccepted: true },
      });
      expect(res2.statusCode).toBe(401);

      // 3rd wrong PIN → 423 locked
      const res3 = await app.inject({
        method: 'POST',
        url: `/invitations/${token}/accept`,
        payload: { pin: '000000', consentAccepted: true },
      });
      expect(res3.statusCode).toBe(423);
      expect(res3.json<{ error: string }>().error).toBe('locked');
      await app.close();
    },
  );

  it('retourne 200 avec sessionToken pour un PIN correct + consentement (RM22)', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    // Create an invitation
    const jwt = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { targetRole: 'contributor', displayName: 'Grand-père Paul' },
    });
    expect(createRes.statusCode).toBe(201);
    const { token, pin } = createRes.json<{ token: string; pin: string }>();

    const res = await app.inject({
      method: 'POST',
      url: `/invitations/${token}/accept`,
      payload: { pin, consentAccepted: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ sessionToken: string; targetRole: string; displayName: string }>();
    expect(body.sessionToken).toBeDefined();
    expect(body.targetRole).toBe('contributor');
    expect(body.displayName).toBe('Grand-père Paul');
    await app.close();
  });
});

describe('DELETE /invitations/:token', () => {
  it('retourne 204 et le GET suivant retourne 404 (révocation Admin)', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const jwt = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwt}` },
      payload: { targetRole: 'restricted_contributor', displayName: 'Ecole maternelle' },
    });
    expect(createRes.statusCode).toBe(201);
    const { token } = createRes.json<{ token: string }>();

    // DELETE
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/invitations/${token}`,
      headers: { Authorization: `Bearer ${jwt}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    // GET should now return 404
    const getRes = await app.inject({
      method: 'GET',
      url: `/invitations/${token}`,
    });
    expect(getRes.statusCode).toBe(404);
    await app.close();
  });

  it('retourne 404 si le token appartient à un autre foyer', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    // Create with household A
    const jwtA = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const createRes = await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwtA}` },
      payload: { targetRole: 'contributor', displayName: 'Maman' },
    });
    const { token } = createRes.json<{ token: string }>();

    // Try DELETE with household B
    const jwtB = app.jwt.sign({
      sub: 'acc-other',
      deviceId: 'dev-002',
      householdId: 'hh-other-household',
      type: 'access',
    });

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/invitations/${token}`,
      headers: { Authorization: `Bearer ${jwtB}` },
    });
    expect(deleteRes.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /invitations (liste Admin)', () => {
  it('liste uniquement les invitations du foyer authentifié', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const jwtA = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: 'dev-001',
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    // Create 2 invitations for household A
    await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwtA}` },
      payload: { targetRole: 'contributor', displayName: 'Papa' },
    });
    await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwtA}` },
      payload: { targetRole: 'restricted_contributor', displayName: 'Crèche' },
    });

    // Create 1 invitation for household B
    const jwtB = app.jwt.sign({
      sub: 'acc-other',
      deviceId: 'dev-002',
      householdId: 'hh-other',
      type: 'access',
    });
    await app.inject({
      method: 'POST',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwtB}` },
      payload: { targetRole: 'contributor', displayName: 'Externe' },
    });

    // List for household A
    const res = await app.inject({
      method: 'GET',
      url: '/invitations',
      headers: { Authorization: `Bearer ${jwtA}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<{
      invitations: {
        token: string;
        targetRole: string;
        displayName: string;
        createdAtMs: number;
      }[];
    }>();
    expect(body.invitations).toHaveLength(2);
    // Must not expose secrets
    for (const inv of body.invitations) {
      expect(Object.keys(inv)).not.toContain('pinHash');
      expect(Object.keys(inv)).not.toContain('pinAttempts');
    }
    await app.close();
  });

  it('retourne 401 sans authentification', async () => {
    const redis = makeMockRedis();
    const app = buildTestApp(redis);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/invitations',
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
