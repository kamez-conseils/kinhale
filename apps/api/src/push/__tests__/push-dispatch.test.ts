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

import { dispatchPush } from '../push-dispatch.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dispatchPush', () => {
  it('envoie une notification opaque à chaque token valide', async () => {
    const mockExpo = new Expo();
    const tokens = ['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'];
    await dispatchPush(mockExpo, tokens);
    expect(mockExpo.sendPushNotificationsAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ to: 'ExponentPushToken[aaa]', title: 'Kinhale', body: 'Nouvelle activité' }),
        expect.objectContaining({ to: 'ExponentPushToken[bbb]', title: 'Kinhale', body: 'Nouvelle activité' }),
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
});
