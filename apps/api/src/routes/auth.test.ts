import { describe, it, expect, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { buildApp } from '../app.js';
import { testEnv } from '../env.js';
import type { DrizzleDb } from '../plugins/db.js';

function makeMockDb(): DrizzleDb {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 'account-001',
            emailHash: 'hash-of-test@example.com',
            createdAt: new Date(),
          },
        ]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  } as unknown as DrizzleDb;
}

function makeMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  } as unknown as Transporter;
}

describe('POST /auth/magic-link', () => {
  it('retourne 200 avec message de confirmation et envoie un email', async () => {
    const mockTransport = makeMockTransport();
    const app = buildApp(testEnv(), { db: makeMockDb(), mailTransport: mockTransport });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ message: string }>().message).toBe('Magic link envoyé');
    expect(mockTransport.sendMail).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(mockTransport.sendMail).mock.calls[0]?.[0];
    expect(callArgs).toMatchObject({
      to: 'test@example.com',
      from: 'no-reply@kinhale.health',
      subject: 'Votre lien de connexion Kinhale',
    });
    await app.close();
  });

  it('retourne 200 même si le transport mail échoue', async () => {
    const failingTransport = {
      sendMail: vi.fn().mockRejectedValue(new Error('SMTP unavailable')),
    } as unknown as Transporter;
    const app = buildApp(testEnv(), { db: makeMockDb(), mailTransport: failingTransport });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'test@example.com' },
    });
    // L'échec mail ne doit pas bloquer la réponse HTTP
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('retourne 400 si email manquant', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), mailTransport: makeMockTransport() });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 400 si email invalide', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), mailTransport: makeMockTransport() });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('GET /auth/verify', () => {
  it('retourne 400 si token absent', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), mailTransport: makeMockTransport() });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/verify',
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 401 si token inconnu (hash non trouvé en DB)', async () => {
    // Le verify utilise désormais un UPDATE atomique avec RETURNING (anti-race
    // condition, cf. kz-securite AUDIT-TRANSVERSE M3). Le mock doit donc
    // simuler `db.update().set().where().returning()` qui renvoie [] quand
    // aucune row ne match (token inconnu / expiré / déjà utilisé).
    const db = makeMockDb();
    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as ReturnType<typeof db.update>);

    const app = buildApp(testEnv(), { db, mailTransport: makeMockTransport() });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/verify?token=unknown-token-64-chars-padding-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('POST /auth/register-device', () => {
  it('retourne 401 sans JWT', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb(), mailTransport: makeMockTransport() });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register-device',
      payload: { publicKeyHex: 'a'.repeat(64) },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('retourne 400 si publicKeyHex absent', async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), mailTransport: makeMockTransport() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register-device',
      headers: { Authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("retourne 400 si publicKeyHex n'est pas 64 hex chars", async () => {
    const env = testEnv();
    const app = buildApp(env, { db: makeMockDb(), mailTransport: makeMockTransport() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register-device',
      headers: { Authorization: `Bearer ${token}` },
      payload: { publicKeyHex: 'not-hex' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 201 avec deviceId après enregistrement valide', async () => {
    const env = testEnv();
    const db = {
      ...makeMockDb(),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'device-new-001',
                accountId: 'account-001',
                publicKeyHex: 'a'.repeat(64),
                householdId: 'hh-001',
                createdAt: new Date(),
              },
            ]),
          }),
        }),
      }),
    } as unknown as DrizzleDb;

    const app = buildApp(env, { db, mailTransport: makeMockTransport() });
    await app.ready();
    const token = app.jwt.sign({
      sub: 'account-001',
      deviceId: 'dev-001',
      householdId: 'hh-001',
      type: 'access',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register-device',
      headers: { Authorization: `Bearer ${token}` },
      payload: { publicKeyHex: 'a'.repeat(64) },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ deviceId: string }>();
    expect(body.deviceId).toBe('device-new-001');
    await app.close();
  });
});
