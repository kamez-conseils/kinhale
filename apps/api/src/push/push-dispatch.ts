import { Expo } from 'expo-server-sdk';

export async function dispatchPush(
  expo: Expo,
  tokens: string[],
  logger?: { warn: (obj: Record<string, unknown>, msg: string) => void },
): Promise<void> {
  const valid = tokens.filter((t) => Expo.isExpoPushToken(t));
  if (valid.length === 0) return;

  const messages = valid.map((to) => ({
    to,
    title: 'Kinhale',
    body: 'Nouvelle activité',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      logger?.warn({ err }, 'Échec envoi push chunk (ignoré)');
    }
  }
}
