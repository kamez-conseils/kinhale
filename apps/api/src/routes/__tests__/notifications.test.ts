import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Transporter } from 'nodemailer';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';
import type { RedisClients } from '../../plugins/redis.js';

function makeMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'ok' }),
  } as unknown as Transporter;
}

/**
 * Pour cette route, on n'a pas besoin d'accès DB : on vérifie surtout
 * l'auth, la validation, l'envoi mail et la forme du lien signé.
 */
function makeMockDb(): DrizzleDb {
  return {} as DrizzleDb;
}

/**
 * Mock Redis in-memory : supporte `incr` + `expire` (rate-limit) et les
 * méthodes event-emitter du sub client requises par `relay.ts`.
 * Pattern calqué sur `invitations.test.ts`.
 */
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

function signAccessToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  overrides: { deviceId?: string } = {},
): string {
  return app.jwt.sign({
    sub: 'account-abc',
    deviceId: overrides.deviceId ?? 'device-xyz',
    householdId: 'household-111',
    type: 'access',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /notifications/missed-dose-email', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: makeMockTransport(),
    });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      payload: { email: 'u@example.com' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si email manquant', async () => {
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: makeMockTransport(),
    });
    await app.ready();
    const token = signAccessToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si email invalide', async () => {
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: makeMockTransport(),
    });
    await app.ready();
    const token = signAccessToken(app);
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 202 et déclenche un envoi mail générique avec token signé court', async () => {
    const transport = makeMockTransport();
    const env = testEnv({ WEB_URL: 'https://app.kinhale.health' });
    const app = buildApp(env, {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'parent@example.com', locale: 'fr' },
    });

    expect(res.statusCode).toBe(202);
    expect(transport.sendMail).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      text: string;
      from: string;
    };
    expect(callArgs.to).toBe('parent@example.com');
    expect(callArgs.subject).toBe('Kinhale — Nouvelle activité');
    // L'URL doit être https://app.kinhale.health/notify?t=<token>
    expect(callArgs.text).toMatch(/https:\/\/app\.kinhale\.health\/notify\?t=[^\s]+/);
    await app.close();
  });

  it('accepte la locale en et renvoie un e-mail en anglais', async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'parent@example.com', locale: 'en' },
    });
    expect(res.statusCode).toBe(202);
    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as {
      subject: string;
    };
    expect(callArgs.subject).toBe('Kinhale — New activity');
    await app.close();
  });

  it('émet un JWT signé de type missed_dose_open avec exp ≤ 2h', async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'u@example.com' },
    });
    expect(res.statusCode).toBe(202);

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as { text: string };
    const match = callArgs.text.match(/\/notify\?t=([^\s]+)/);
    expect(match).not.toBeNull();
    const openToken = match?.[1] ?? '';

    // Le serveur doit pouvoir vérifier sa propre signature (mêmes clés que l'app)
    const decoded = app.jwt.verify<{
      type: string;
      jti: string;
      exp: number;
      iat: number;
    }>(openToken);
    expect(decoded.type).toBe('missed_dose_open');
    // Format unique : 32 chars hex (16 octets aléatoires de @kinhale/crypto).
    expect(decoded.jti).toMatch(/^[a-f0-9]{32}$/);
    // exp - iat ≤ 2h
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(2 * 60 * 60);
    await app.close();
  });

  it('ne contient aucun identifiant (accountId, deviceId, householdId) dans le token signé', async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'u@example.com' },
    });
    expect(res.statusCode).toBe(202);

    const callArgs = vi.mocked(transport.sendMail).mock.calls[0]?.[0] as { text: string };
    const match = callArgs.text.match(/\/notify\?t=([^\s]+)/);
    const openToken = match?.[1] ?? '';
    const decoded = app.jwt.verify<Record<string, unknown>>(openToken);
    expect(decoded).not.toHaveProperty('sub');
    expect(decoded).not.toHaveProperty('deviceId');
    expect(decoded).not.toHaveProperty('householdId');
  });

  it('retourne 202 même si le transport mail échoue (best-effort, log interne)', async () => {
    const failingTransport = {
      sendMail: vi.fn().mockRejectedValue(new Error('SMTP unreachable')),
    } as unknown as Transporter;
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: failingTransport,
    });
    await app.ready();
    const token = signAccessToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'u@example.com' },
    });
    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it('refuse un reminderId qui ressemble à un prénom/chaîne santé (défense en profondeur)', async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app);

    // reminderId doit matcher le format opaque `r:<base36>:<iso>` — cf. projection.
    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'u@example.com', reminderId: 'Léa-matin' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('accepte un reminderId opaque conforme', async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app);

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        email: 'u@example.com',
        reminderId: 'r:abc123:2026-04-24T08:00:00.000Z',
      },
    });
    expect(res.statusCode).toBe(202);
    await app.close();
  });

  it("rate-limit : 5 requêtes dans l'heure passent (202)", async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app, { deviceId: 'device-rl-ok' });

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/notifications/missed-dose-email',
        headers: { Authorization: `Bearer ${token}` },
        payload: { email: `parent-${i}@example.com` },
      });
      expect(res.statusCode).toBe(202);
    }
    expect(transport.sendMail).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it("rate-limit : la 6ᵉ requête dans l'heure retourne 429", async () => {
    const transport = makeMockTransport();
    const app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: transport,
    });
    await app.ready();
    const token = signAccessToken(app, { deviceId: 'device-rl-over' });

    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/notifications/missed-dose-email',
        headers: { Authorization: `Bearer ${token}` },
        payload: { email: `parent-${i}@example.com` },
      });
      expect(res.statusCode).toBe(202);
    }

    // 6ᵉ tentative dans la même fenêtre → 429, aucun mail supplémentaire.
    const over = await app.inject({
      method: 'POST',
      url: '/notifications/missed-dose-email',
      headers: { Authorization: `Bearer ${token}` },
      payload: { email: 'parent-over@example.com' },
    });
    expect(over.statusCode).toBe(429);
    expect(over.json()).toEqual({ error: 'rate_limited' });
    expect(transport.sendMail).toHaveBeenCalledTimes(5);

    await app.close();
  });
});
