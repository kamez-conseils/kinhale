import { describe, it, expect, vi } from 'vitest';
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

describe('POST /auth/magic-link', () => {
  it('retourne 200 avec message de confirmation', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb() });
    await app.ready();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic-link',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ message: string }>().message).toBe('Magic link envoyé');
    await app.close();
  });

  it('retourne 400 si email manquant', async () => {
    const app = buildApp(testEnv(), { db: makeMockDb() });
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
    const app = buildApp(testEnv(), { db: makeMockDb() });
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
    const app = buildApp(testEnv(), { db: makeMockDb() });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/verify',
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 401 si token inconnu (hash non trouvé en DB)', async () => {
    const db = makeMockDb();
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as ReturnType<typeof db.select>);

    const app = buildApp(testEnv(), { db });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/auth/verify?token=unknown-token-64-chars-padding-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
