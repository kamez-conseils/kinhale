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

import { dispatchPush, type NotificationPreferenceStore } from '../push-dispatch.js';

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
