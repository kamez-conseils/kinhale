import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000002';

vi.mock('expo-server-sdk', () => {
  const MockExpo = vi.fn().mockImplementation(() => ({
    chunkPushNotifications: vi.fn((msgs: unknown[]) => [msgs]),
    sendPushNotificationsAsync: vi.fn().mockResolvedValue([]),
  }));
  (MockExpo as unknown as Record<string, unknown>).isExpoPushToken = vi.fn(
    (t: string) => typeof t === 'string' && t.startsWith('ExponentPushToken['),
  );
  return { Expo: MockExpo };
});

function makeMockDb() {
  // mailboxMessages.insert chain
  const mailboxInsertValues = vi.fn().mockResolvedValue(undefined);
  const mailboxInsert = vi.fn().mockReturnValue({ values: mailboxInsertValues });

  return {
    insert: mailboxInsert,
    // Select ne sera pas consulté par le nouveau relay pour les blobJson
    // (dispatch aveugle supprimé en KIN-082). Laissé en place pour les tests
    // d'initialisation app.
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    _mailboxInsertValues: mailboxInsertValues,
  } as unknown as DrizzleDb & {
    _mailboxInsertValues: ReturnType<typeof vi.fn>;
  };
}

function buildTestApp(db: ReturnType<typeof makeMockDb>) {
  const env = testEnv();
  const redisPub = { publish: vi.fn().mockResolvedValue(undefined) };
  const redisSub = {
    on: vi.fn(),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
  const app = buildApp(env, {
    db: db as unknown as DrizzleDb,
    redis: { pub: redisPub as never, sub: redisSub as never },
  });
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('relay — enregistrement des plugins + stores', () => {
  let db: ReturnType<typeof makeMockDb>;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    db = makeMockDb();
    app = buildTestApp(db);
    await app.ready();
  });

  it("s'initialise sans erreur avec un DrizzleDb mocké (stores prefsStore / quietStore instanciés)", async () => {
    // Si l'instanciation des stores levait une erreur (ex: absence de fonction
    // sur le DrizzleDb mock), `app.ready()` échouerait.
    expect(app).toBeDefined();
    expect(HOUSEHOLD_ID).toMatch(/^[0-9a-f-]+$/u);
    await app.close();
  });
});
