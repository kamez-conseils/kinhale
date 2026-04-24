import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Expo } from 'expo-server-sdk';

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

import {
  dispatchPush,
  type NotificationPreferenceStore,
  type QuietHoursStore,
} from '../push-dispatch.js';
import type { QuietHours } from '@kinhale/domain/quiet-hours';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dispatchPush — API rétrocompatible (tokens simples)', () => {
  it('envoie une notification opaque à chaque token valide', async () => {
    const mockExpo = new Expo();
    const tokens = ['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'];
    await dispatchPush(mockExpo, tokens, undefined);
    expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'ExponentPushToken[aaa]',
          title: 'Kinhale',
          body: 'Nouvelle activité',
        }),
        expect.objectContaining({
          to: 'ExponentPushToken[bbb]',
          title: 'Kinhale',
          body: 'Nouvelle activité',
        }),
      ]),
    );
  });

  it('filtre les tokens invalides', async () => {
    const mockExpo = new Expo();
    const tokens = ['invalid-token', 'ExponentPushToken[valid]'];
    await dispatchPush(mockExpo, tokens);
    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toHaveLength(1);
    expect(calls[0][0][0]).toMatchObject({ to: 'ExponentPushToken[valid]' });
  });

  it('ne crash pas si la liste de tokens est vide', async () => {
    const mockExpo = new Expo();
    await expect(dispatchPush(mockExpo, [])).resolves.toBeUndefined();
    expect(mockExpo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('payload ne contient pas de donnée santé', async () => {
    const mockExpo = new Expo();
    await dispatchPush(mockExpo, ['ExponentPushToken[x]']);
    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as { title: string; body: string; data?: unknown };
    expect(msg.title).toBe('Kinhale');
    expect(msg.body).toBe('Nouvelle activité');
    expect(msg.data).toBeUndefined();
  });

  it('appelle logger.warn quand le SDK lance une erreur', async () => {
    const mockExpo = new Expo();
    const sendError = new Error('SDK error');
    (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      sendError,
    );

    const logger = { warn: vi.fn() };
    await dispatchPush(mockExpo, ['ExponentPushToken[aaa]'], logger);

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: sendError }),
      'Échec envoi push chunk (ignoré)',
    );
  });
});

describe('dispatchPush — filtrage granulaire E5-S07', () => {
  const makeStore = (disabled: Set<string> = new Set()): NotificationPreferenceStore => ({
    findDisabledAccountIds: vi.fn().mockResolvedValue(disabled),
  });

  it("n'envoie pas de push aux comptes ayant désactivé le type", async () => {
    const mockExpo = new Expo();
    const store = makeStore(new Set(['acc-2']));
    const targets = [
      { token: 'ExponentPushToken[a]', accountId: 'acc-1' },
      { token: 'ExponentPushToken[b]', accountId: 'acc-2' },
      { token: 'ExponentPushToken[c]', accountId: 'acc-3' },
    ];

    await dispatchPush(mockExpo, targets, undefined, {
      type: 'peer_dose_recorded',
      prefsStore: store,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const sent = (calls[0][0] as Array<{ to: string }>).map((m) => m.to);
    expect(sent).toEqual(['ExponentPushToken[a]', 'ExponentPushToken[c]']);
    expect(store.findDisabledAccountIds).toHaveBeenCalledWith(
      ['acc-1', 'acc-2', 'acc-3'],
      'peer_dose_recorded',
    );
  });

  it('envoie quand même les types sanctuarisés missed_dose même si désactivés (défense en profondeur)', async () => {
    const mockExpo = new Expo();
    const store = makeStore(new Set(['acc-1', 'acc-2']));
    const targets = [
      { token: 'ExponentPushToken[a]', accountId: 'acc-1' },
      { token: 'ExponentPushToken[b]', accountId: 'acc-2' },
    ];

    await dispatchPush(mockExpo, targets, undefined, {
      type: 'missed_dose',
      prefsStore: store,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toHaveLength(2);
    // Le store ne doit même pas être consulté pour les types sanctuarisés.
    expect(store.findDisabledAccountIds).not.toHaveBeenCalled();
  });

  it('envoie quand même les security_alert même si désactivés', async () => {
    const mockExpo = new Expo();
    const store = makeStore(new Set(['acc-1']));
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, undefined, {
      type: 'security_alert',
      prefsStore: store,
    });

    expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledOnce();
    expect(store.findDisabledAccountIds).not.toHaveBeenCalled();
  });

  it('ne consulte pas le store quand tous les accountIds sont vides (rétrocompat)', async () => {
    const mockExpo = new Expo();
    const store = makeStore(new Set());
    await dispatchPush(mockExpo, ['ExponentPushToken[a]'], undefined, {
      type: 'reminder',
      prefsStore: store,
    });
    expect(store.findDisabledAccountIds).not.toHaveBeenCalled();
    expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledOnce();
  });

  it('écarte tous les tokens si tous les comptes ont désactivé le type', async () => {
    const mockExpo = new Expo();
    const store = makeStore(new Set(['acc-1', 'acc-2']));
    const targets = [
      { token: 'ExponentPushToken[a]', accountId: 'acc-1' },
      { token: 'ExponentPushToken[b]', accountId: 'acc-2' },
    ];

    await dispatchPush(mockExpo, targets, undefined, {
      type: 'pump_low',
      prefsStore: store,
    });

    expect(mockExpo.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });
});

describe('dispatchPush — quiet hours E5-S08', () => {
  const makeQuietStore = (map: Map<string, QuietHours> = new Map()): QuietHoursStore => ({
    findQuietHoursByAccount: vi.fn().mockResolvedValue(map),
  });

  const NIGHT_QH: QuietHours = {
    enabled: true,
    startLocalTime: '22:00',
    endLocalTime: '07:00',
    timezone: 'America/Toronto',
  };

  // 03:00 UTC = 22:00 Toronto (EST = UTC-5) ; pile dans la plage nuit.
  const INSIDE_NIGHT = new Date('2026-01-16T03:00:00Z');
  // 15:00 UTC = 10:00 Toronto ; hors plage.
  const DAYTIME = new Date('2026-01-15T15:00:00Z');

  it('silence (sound:null, priority:normal, interruptionLevel:passive) le push si le compte est en quiet hours', async () => {
    const mockExpo = new Expo();
    const quietStore = makeQuietStore(new Map([['acc-1', NIGHT_QH]]));
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, undefined, undefined, {
      type: 'peer_dose_recorded',
      quietStore,
      now: INSIDE_NIGHT,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as {
      priority?: string;
      sound?: unknown;
      interruptionLevel?: string;
    };
    expect(msg.priority).toBe('normal');
    expect(msg.sound).toBeNull();
    expect(msg.interruptionLevel).toBe('passive');
  });

  it('envoie en payload normal (priority par défaut) hors quiet hours', async () => {
    const mockExpo = new Expo();
    const quietStore = makeQuietStore(new Map([['acc-1', NIGHT_QH]]));
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, undefined, undefined, {
      type: 'peer_dose_recorded',
      quietStore,
      now: DAYTIME,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as { priority?: string; sound?: unknown };
    expect(msg.priority).toBeUndefined();
    expect(msg.sound).toBeUndefined();
  });

  it('missed_dose : push normal MÊME dans la plage quiet hours (exception RM25)', async () => {
    const mockExpo = new Expo();
    const quietStore = makeQuietStore(new Map([['acc-1', NIGHT_QH]]));
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, undefined, undefined, {
      type: 'missed_dose',
      quietStore,
      now: INSIDE_NIGHT,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as { priority?: string; sound?: unknown };
    expect(msg.priority).toBeUndefined();
    expect(msg.sound).toBeUndefined();
    // Le store ne doit même pas être consulté pour les types override.
    expect(quietStore.findQuietHoursByAccount).not.toHaveBeenCalled();
  });

  it('security_alert : push normal MÊME dans la plage quiet hours (exception sécurité)', async () => {
    const mockExpo = new Expo();
    const quietStore = makeQuietStore(new Map([['acc-1', NIGHT_QH]]));
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, undefined, undefined, {
      type: 'security_alert',
      quietStore,
      now: INSIDE_NIGHT,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as { priority?: string; sound?: unknown };
    expect(msg.priority).toBeUndefined();
    expect(msg.sound).toBeUndefined();
    expect(quietStore.findQuietHoursByAccount).not.toHaveBeenCalled();
  });

  it('mixte : un compte silencié, un compte normal dans le même lot', async () => {
    const mockExpo = new Expo();
    const quietStore = makeQuietStore(new Map([['acc-1', NIGHT_QH]]));
    const targets = [
      { token: 'ExponentPushToken[a]', accountId: 'acc-1' }, // en plage nuit → silencié
      { token: 'ExponentPushToken[b]', accountId: 'acc-2' }, // pas de config → normal
    ];

    await dispatchPush(mockExpo, targets, undefined, undefined, {
      type: 'reminder',
      quietStore,
      now: INSIDE_NIGHT,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const messages = calls[0][0] as Array<{ to: string; priority?: string; sound?: unknown }>;
    const byTo = new Map(messages.map((m) => [m.to, m]));
    expect(byTo.get('ExponentPushToken[a]')?.priority).toBe('normal');
    expect(byTo.get('ExponentPushToken[a]')?.sound).toBeNull();
    expect(byTo.get('ExponentPushToken[b]')?.priority).toBeUndefined();
    expect(byTo.get('ExponentPushToken[b]')?.sound).toBeUndefined();
  });

  it('ne silence pas si quiet hours est enabled=false (désactivé)', async () => {
    const mockExpo = new Expo();
    const disabledQH: QuietHours = { ...NIGHT_QH, enabled: false };
    const quietStore = makeQuietStore(new Map([['acc-1', disabledQH]]));
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, undefined, undefined, {
      type: 'peer_dose_recorded',
      quietStore,
      now: INSIDE_NIGHT,
    });

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as { priority?: string; sound?: unknown };
    expect(msg.priority).toBeUndefined();
    expect(msg.sound).toBeUndefined();
  });

  it("fail-safe : si le store lève, on n'écrase pas l'envoi (push normal + log warn)", async () => {
    const mockExpo = new Expo();
    const quietStore: QuietHoursStore = {
      findQuietHoursByAccount: vi.fn().mockRejectedValue(new Error('DB down')),
    };
    const logger = { warn: vi.fn() };
    const targets = [{ token: 'ExponentPushToken[a]', accountId: 'acc-1' }];

    await dispatchPush(mockExpo, targets, logger, undefined, {
      type: 'peer_dose_recorded',
      quietStore,
      now: INSIDE_NIGHT,
    });

    // Envoi normal (pas silencié).
    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const msg = calls[0][0][0] as { priority?: string };
    expect(msg.priority).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      expect.stringContaining('quiet hours'),
    );
  });

  it('combinaison préférences granulaires + quiet hours : accounts désactivés écartés AVANT silenciage', async () => {
    const mockExpo = new Expo();
    const prefsStore: NotificationPreferenceStore = {
      findDisabledAccountIds: vi.fn().mockResolvedValue(new Set(['acc-1'])),
    };
    const quietStore = makeQuietStore(new Map([['acc-2', NIGHT_QH]]));
    const targets = [
      { token: 'ExponentPushToken[a]', accountId: 'acc-1' }, // désactivé → écarté
      { token: 'ExponentPushToken[b]', accountId: 'acc-2' }, // silencié
      { token: 'ExponentPushToken[c]', accountId: 'acc-3' }, // normal
    ];

    await dispatchPush(
      mockExpo,
      targets,
      undefined,
      { type: 'peer_dose_recorded', prefsStore },
      { type: 'peer_dose_recorded', quietStore, now: INSIDE_NIGHT },
    );

    const calls = (mockExpo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>).mock.calls;
    const messages = calls[0][0] as Array<{ to: string; priority?: string }>;
    // Seulement acc-2 (silencié) et acc-3 (normal) — acc-1 est hors du lot.
    expect(messages.map((m) => m.to).sort()).toEqual(
      ['ExponentPushToken[b]', 'ExponentPushToken[c]'].sort(),
    );
    const byTo = new Map(messages.map((m) => [m.to, m]));
    expect(byTo.get('ExponentPushToken[b]')?.priority).toBe('normal');
    expect(byTo.get('ExponentPushToken[c]')?.priority).toBeUndefined();
  });
});
