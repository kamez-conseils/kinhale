import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Expo } from 'expo-server-sdk';
import type { Redis } from 'ioredis';
import type { DrizzleDb } from '../../plugins/db.js';
import { handlePeerPing, PEER_PING_RATE_LIMIT_MAX, _internals } from '../peer-ping-handler.js';
import type { NotificationPreferenceStore, QuietHoursStore } from '../push-dispatch.js';

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

interface RedisMock {
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

function makeRedis(overrides: Partial<RedisMock> = {}): Redis {
  const mock: RedisMock = {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  return mock as unknown as Redis;
}

function makeDb(rows: Array<{ token: string; accountId: string }>): DrizzleDb {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as unknown as DrizzleDb;
}

function makePrefs(disabled: Set<string> = new Set()): NotificationPreferenceStore {
  return {
    findDisabledAccountIds: vi.fn().mockResolvedValue(disabled),
  };
}

function makeQuiet(): QuietHoursStore {
  return {
    findQuietHoursByAccount: vi.fn().mockResolvedValue(new Map()),
  };
}

const HOUSEHOLD_A = 'hh-aaa';
const SENDER_DEVICE = 'dev-sender';
const DOSE_ID = '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handlePeerPing', () => {
  it('dispatche un push typé peer_dose_recorded aux autres devices du foyer', async () => {
    const expo = new Expo();
    const redis = makeRedis();
    const db = makeDb([
      { token: 'ExponentPushToken[peer1]', accountId: 'acc-1' },
      { token: 'ExponentPushToken[peer2]', accountId: 'acc-2' },
    ]);
    const prefsStore = makePrefs();
    const quietStore = makeQuiet();

    const result = await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
    });

    expect(result).toBe('dispatched');
    // Le prefsStore reçoit bien le type `peer_dose_recorded`.
    expect(prefsStore.findDisabledAccountIds).toHaveBeenCalledWith(
      expect.arrayContaining(['acc-1', 'acc-2']),
      'peer_dose_recorded',
    );
    // 2 targets → 1 appel SDK.
    expect(expo.sendPushNotificationsAsync).toHaveBeenCalledOnce();
    const call = (expo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toHaveLength(2);
    const msgs = call?.[0] as Array<{ title: string; body: string }>;
    for (const m of msgs) {
      // RM16 : payload opaque.
      expect(m.title).toBe('Kinhale');
      expect(m.body).toBe('Nouvelle activité');
    }
  });

  it('est idempotent : un second ping avec le même doseId est dédoublonné (Redis SET NX)', async () => {
    const expo = new Expo();
    // 1er appel SET NX → 'OK', 2e → null
    const redis = makeRedis({
      set: vi.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null),
    });
    const db = makeDb([{ token: 'ExponentPushToken[peer1]', accountId: 'acc-1' }]);
    const prefsStore = makePrefs();
    const quietStore = makeQuiet();

    const first = await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
    });
    expect(first).toBe('dispatched');

    const second = await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
    });
    expect(second).toBe('deduped');
    // Le 2e appel n'a pas déclenché d'envoi push.
    expect(expo.sendPushNotificationsAsync).toHaveBeenCalledOnce();
  });

  it('rate-limit le device émetteur quand le compteur dépasse le quota', async () => {
    const expo = new Expo();
    // INCR retourne 61 (> 60) → rate-limited.
    const redis = makeRedis({
      incr: vi.fn().mockResolvedValue(PEER_PING_RATE_LIMIT_MAX + 1),
    });
    const db = makeDb([{ token: 'ExponentPushToken[peer1]', accountId: 'acc-1' }]);
    const prefsStore = makePrefs();
    const quietStore = makeQuiet();

    const result = await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
    });
    expect(result).toBe('rate_limited');
    // Ni dédup posée, ni push envoyé.
    expect(redis.set).not.toHaveBeenCalled();
    expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it("retourne `no_targets` si aucun autre device n'est enregistré dans le foyer", async () => {
    const expo = new Expo();
    const redis = makeRedis();
    const db = makeDb([]); // 0 tokens
    const prefsStore = makePrefs();
    const quietStore = makeQuiet();

    const result = await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
    });

    expect(result).toBe('no_targets');
    expect(expo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('applique le filtrage préférences : écarte les comptes ayant désactivé peer_dose_recorded', async () => {
    const expo = new Expo();
    const redis = makeRedis();
    const db = makeDb([
      { token: 'ExponentPushToken[peer1]', accountId: 'acc-1' },
      { token: 'ExponentPushToken[peer2]', accountId: 'acc-2' },
    ]);
    // acc-2 a désactivé peer_dose_recorded.
    const prefsStore = makePrefs(new Set(['acc-2']));
    const quietStore = makeQuiet();

    await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
    });

    // Seul acc-1 reçoit le push (1 message envoyé).
    const call = (expo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toHaveLength(1);
    const msg = (call?.[0] as Array<{ to: string }>)[0];
    expect(msg?.to).toBe('ExponentPushToken[peer1]');
  });

  it('silence (priority=normal, sound=null) les destinataires en quiet hours', async () => {
    const expo = new Expo();
    const redis = makeRedis();
    const db = makeDb([{ token: 'ExponentPushToken[peer1]', accountId: 'acc-1' }]);
    const prefsStore = makePrefs();
    const quietStore: QuietHoursStore = {
      findQuietHoursByAccount: vi.fn().mockResolvedValue(
        new Map([
          [
            'acc-1',
            {
              enabled: true,
              startLocalTime: '22:00',
              endLocalTime: '07:00',
              timezone: 'America/Toronto',
            },
          ],
        ]),
      ),
    };

    // 03:00 UTC = 22:00 Toronto → dans la plage.
    await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
      now: new Date('2026-01-16T03:00:00Z'),
    });

    const call = (expo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls[0];
    const msg = (call?.[0] as Array<{ priority?: string; sound?: unknown }>)[0];
    expect(msg?.priority).toBe('normal');
    expect(msg?.sound).toBeNull();
  });

  it('fail-open : si Redis plante sur la dédup, dispatche quand même (ne perd pas de notif)', async () => {
    const expo = new Expo();
    const redis = makeRedis({
      set: vi.fn().mockRejectedValue(new Error('redis timeout')),
    });
    const db = makeDb([{ token: 'ExponentPushToken[peer1]', accountId: 'acc-1' }]);
    const prefsStore = makePrefs();
    const quietStore = makeQuiet();
    const logger = { warn: vi.fn() };

    const result = await handlePeerPing({
      db,
      redis,
      expo,
      householdId: HOUSEHOLD_A,
      senderDeviceId: SENDER_DEVICE,
      doseId: DOSE_ID,
      prefsStore,
      quietStore,
      logger,
    });
    expect(result).toBe('dispatched');
    expect(expo.sendPushNotificationsAsync).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('dedupKey et rateLimitKey respectent un format prévisible (aide debug ops)', () => {
    expect(_internals.dedupKey('hh-xyz', 'dose-abc')).toBe('peer_ping:dose:hh-xyz:dose-abc');
    expect(_internals.rateLimitKey('dev-xyz')).toBe('peer_ping:rl:dev-xyz');
  });
});
