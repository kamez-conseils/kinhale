import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEVICE_ID = '00000000-0000-0000-0000-000000000001';
const HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000002';
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000003';
const PUSH_TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

function makeMockDb() {
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const insertValues = vi.fn().mockReturnValue({ onConflictDoNothing });
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere });

  return {
    insert,
    delete: deleteFn,
    _insertValues: insertValues,
    _onConflictDoNothing: onConflictDoNothing,
    _deleteWhere: deleteWhere,
  } as unknown as DrizzleDb & {
    _insertValues: ReturnType<typeof vi.fn>;
    _onConflictDoNothing: ReturnType<typeof vi.fn>;
    _deleteWhere: ReturnType<typeof vi.fn>;
  };
}

function buildTestApp(db: ReturnType<typeof makeMockDb>) {
  const env = testEnv();
  const app = buildApp(env, {
    db: db as unknown as DrizzleDb,
    redis: {
      pub: { publish: vi.fn() } as never,
      sub: { on: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() } as never,
    },
  });
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /push/register-token', () => {
  let db: ReturnType<typeof makeMockDb>;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    db = makeMockDb();
    app = buildTestApp(db);
    await app.ready();
  });

  it('retourne 201 quand le token est enregistré (authentifié)', async () => {
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/push/register-token',
      headers: { authorization: `Bearer ${token}` },
      payload: { pushToken: PUSH_TOKEN },
    });

    expect(res.statusCode).toBe(201);
    expect(db.insert).toHaveBeenCalledOnce();
    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: DEVICE_ID,
        householdId: HOUSEHOLD_ID,
        token: PUSH_TOKEN,
      }),
    );
    expect(db._onConflictDoNothing).toHaveBeenCalledOnce();
    await app.close();
  });

  it('retourne 400 si pushToken est absent du body', async () => {
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/push/register-token',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 401 sans JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/push/register-token',
      payload: { pushToken: PUSH_TOKEN },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('DELETE /push/register-token', () => {
  let db: ReturnType<typeof makeMockDb>;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    db = makeMockDb();
    app = buildTestApp(db);
    await app.ready();
  });

  it('retourne 204 quand le token est supprimé (authentifié)', async () => {
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/push/register-token',
      headers: { authorization: `Bearer ${token}` },
      payload: { pushToken: PUSH_TOKEN },
    });

    expect(res.statusCode).toBe(204);
    expect(db.delete).toHaveBeenCalledOnce();
    expect(db._deleteWhere).toHaveBeenCalledOnce();
    await app.close();
  });

  it('retourne 400 si pushToken est absent du body (DELETE)', async () => {
    const token = app.jwt.sign({
      sub: ACCOUNT_ID,
      deviceId: DEVICE_ID,
      householdId: HOUSEHOLD_ID,
      type: 'access',
    });

    const res = await app.inject({
      method: 'DELETE',
      url: '/push/register-token',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('retourne 401 sans JWT (DELETE)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/push/register-token',
      payload: { pushToken: PUSH_TOKEN },
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
