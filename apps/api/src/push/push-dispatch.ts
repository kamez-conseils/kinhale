import { Expo } from 'expo-server-sdk';
import type { NotificationType } from '@kinhale/domain/notifications';

/**
 * Cible d'un push : un token Expo associé à un compte utilisateur. Le compte
 * sert à filtrer selon les préférences granulaires (E5-S07). Dès qu'un type
 * est fourni, les cibles dont l'utilisateur a désactivé ce type sont écartées
 * avant d'appeler Expo.
 */
export interface PushTarget {
  readonly token: string;
  readonly accountId: string;
}

/**
 * Contrat minimal d'un store de préférences. Injecté par la route appelante
 * (qui possède la connexion Drizzle) pour garder `push-dispatch` découplé
 * de la DB — facilite les tests et isole la logique de dispatch.
 *
 * Sémantique : retourne l'ensemble des comptes pour lesquels le `type` donné
 * est **désactivé**. Les comptes absents sont considérés `enabled = true`
 * (convention §9 : opt-out explicite uniquement).
 */
export interface NotificationPreferenceStore {
  findDisabledAccountIds(
    accountIds: readonly string[],
    type: NotificationType,
  ): Promise<Set<string>>;
}

/**
 * Types **toujours actifs** côté dispatch — doublent la garantie domaine
 * (`ALWAYS_ENABLED_NOTIFICATION_TYPES`) par défense en profondeur. Si une
 * préférence parasite devait se retrouver persistée pour ces types, le
 * dispatcher ignorerait quand même les désactivations.
 */
const ALWAYS_ENABLED: ReadonlySet<NotificationType> = new Set(['missed_dose', 'security_alert']);

/**
 * Envoie une notification opaque (RM16) aux tokens fournis, filtrée selon
 * les préférences granulaires de l'utilisateur (E5-S07).
 *
 * - Sans `type` ni `prefsStore` : compatibilité — tous les tokens sont pris.
 * - Avec `type` + `prefsStore` : les tokens dont le compte a désactivé `type`
 *   sont écartés **avant** l'appel à Expo.
 * - Les tokens invalides (format Expo) sont toujours filtrés.
 *
 * Payload strictement conforme à RM16 : `title: "Kinhale"`,
 * `body: "Nouvelle activité"`, **aucune** donnée santé, aucun identifiant
 * métier dans le payload (le `notification_id` et le `household_id` opaques
 * seront ajoutés par le scheduler v1.1, cf. SPECS §9).
 */
export async function dispatchPush(
  expo: Expo,
  targets: readonly (PushTarget | string)[],
  logger?: { warn: (obj: Record<string, unknown>, msg: string) => void },
  filter?: { type: NotificationType; prefsStore: NotificationPreferenceStore },
): Promise<void> {
  // Normalise en PushTarget (rétrocompat : on accepte les simples strings sans
  // accountId — dans ce cas, aucun filtrage de préférences n'est possible).
  const normalized: PushTarget[] = targets.map((t) =>
    typeof t === 'string' ? { token: t, accountId: '' } : t,
  );

  let kept = normalized.filter((t) => Expo.isExpoPushToken(t.token));

  if (filter !== undefined && !ALWAYS_ENABLED.has(filter.type)) {
    const accountIds = Array.from(new Set(kept.map((t) => t.accountId).filter((a) => a !== '')));
    if (accountIds.length > 0) {
      const disabled = await filter.prefsStore.findDisabledAccountIds(accountIds, filter.type);
      kept = kept.filter((t) => !disabled.has(t.accountId));
    }
  }

  if (kept.length === 0) return;

  const messages = kept.map((t) => ({
    to: t.token,
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
