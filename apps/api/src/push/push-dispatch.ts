import { Expo } from 'expo-server-sdk';
import type { NotificationType } from '@kinhale/domain/notifications';
import {
  isQuietHoursOverrideType,
  isWithinQuietHours,
  type QuietHours,
} from '@kinhale/domain/quiet-hours';
import { PushPayloadSchema } from './push-payload-schema.js';

/**
 * Cible d'un push : un token Expo associé à un compte utilisateur. Le compte
 * sert à filtrer selon les préférences granulaires (E5-S07) et les quiet
 * hours (E5-S08). Dès qu'un type est fourni, les cibles dont l'utilisateur a
 * désactivé ce type ou est en quiet hours sont filtrées avant l'appel Expo.
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
 * Contrat minimal d'un store de quiet hours (E5-S08). Rend une map indexée
 * par accountId. Les comptes absents sont traités comme n'ayant pas de
 * config quiet hours (aucun filtrage silencieux appliqué).
 */
export interface QuietHoursStore {
  findQuietHoursByAccount(accountIds: readonly string[]): Promise<Map<string, QuietHours>>;
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
 * les préférences granulaires (E5-S07) et les quiet hours (E5-S08).
 *
 * **Ordre de filtrage critique** :
 * 1. Tokens invalides (format Expo) → écartés en premier.
 * 2. Préférences granulaires (si `filter` fourni et type non sanctuarisé) :
 *    les comptes ayant désactivé ce type sont retirés.
 * 3. Quiet hours (si `quietFilter` fourni et type non-override) : les comptes
 *    en plage « ne pas déranger » reçoivent un payload **silencieux**
 *    (`sound: null`, `priority: 'normal'`, `interruptionLevel: 'passive'`) au
 *    lieu d'être écartés, pour que la notification reste visible dans le
 *    centre de notifications du device au réveil de l'utilisateur (UX
 *    cohérente iOS/Android).
 *
 * **Exception sécurité (RM25 + §9)** : `missed_dose` et `security_alert` ne
 * sont **jamais** silenciés par les quiet hours — `isQuietHoursOverrideType`
 * les identifie et court-circuite la lecture du store.
 *
 * Payload strictement conforme à RM16 : `title: "Kinhale"`,
 * `body: "Nouvelle activité"`, **aucune** donnée santé, aucun identifiant
 * métier dans le payload (le `notification_id` et le `household_id` opaques
 * seront ajoutés par le scheduler v1.1, cf. SPECS §9).
 *
 * **Verrouillage structurel (KIN-087, E9-S07)** : chaque message est validé
 * via {@link PushPayloadSchema} **avant** l'appel Expo. Ce schéma
 * `.strict()` rejette toute clé inattendue, toute valeur de `title` / `body`
 * non-conforme, et toute combinaison de flags QoS non-autorisée. En cas de
 * violation, le chunk est jeté (log warn) — **mieux vaut une notification
 * perdue qu'une fuite santé**. Test anti-régression :
 * `push/__tests__/payload-anti-leak.test.ts`.
 */
export async function dispatchPush(
  expo: Expo,
  targets: readonly (PushTarget | string)[],
  logger?: { warn: (obj: Record<string, unknown>, msg: string) => void },
  filter?: { type: NotificationType; prefsStore: NotificationPreferenceStore },
  quietFilter?: { type: NotificationType; quietStore: QuietHoursStore; now?: Date },
): Promise<void> {
  // Normalise en PushTarget (rétrocompat : on accepte les simples strings sans
  // accountId — dans ce cas, aucun filtrage de préférences n'est possible).
  const normalized: PushTarget[] = targets.map((t) =>
    typeof t === 'string' ? { token: t, accountId: '' } : t,
  );

  let kept = normalized.filter((t) => Expo.isExpoPushToken(t.token));

  // Filtrage préférences granulaires (E5-S07).
  if (filter !== undefined && !ALWAYS_ENABLED.has(filter.type)) {
    const accountIds = Array.from(new Set(kept.map((t) => t.accountId).filter((a) => a !== '')));
    if (accountIds.length > 0) {
      const disabled = await filter.prefsStore.findDisabledAccountIds(accountIds, filter.type);
      kept = kept.filter((t) => !disabled.has(t.accountId));
    }
  }

  if (kept.length === 0) return;

  // Détermination des comptes en quiet hours (E5-S08).
  // Si le type est override (missed_dose / security_alert), on skip tout le
  // bloc sans interroger le store — défense en profondeur identique à §9.
  const silencedAccountIds = new Set<string>();
  if (quietFilter !== undefined && !isQuietHoursOverrideType(quietFilter.type)) {
    const accountIds = Array.from(new Set(kept.map((t) => t.accountId).filter((a) => a !== '')));
    if (accountIds.length > 0) {
      const now = quietFilter.now ?? new Date();
      try {
        const map = await quietFilter.quietStore.findQuietHoursByAccount(accountIds);
        for (const [accountId, qh] of map.entries()) {
          if (isWithinQuietHours(now, qh)) {
            silencedAccountIds.add(accountId);
          }
        }
      } catch (err) {
        // Fail-safe : en cas d'erreur du store, on laisse passer (pas de
        // silenciage) plutôt que de bloquer l'envoi. La visibilité de la
        // notification est prioritaire sur la politesse.
        logger?.warn({ err }, 'Lecture quiet hours échouée (fallback: pas de silenciage)');
      }
    }
  }

  const messages = kept.map((t) => {
    const silenced = silencedAccountIds.has(t.accountId);
    // Mode silencieux : `sound: null` coupe le son côté APNs/FCM,
    // `priority: 'normal'` (plus basse que `default`) et `interruptionLevel:
    // 'passive'` (iOS ≥ 15) font en sorte que la notif apparaît dans le
    // centre de notifs **sans** vibration ni bannière d'alerte. La notif
    // reste donc visible au réveil de l'utilisateur — pas une suppression.
    return silenced
      ? ({
          to: t.token,
          title: 'Kinhale',
          body: 'Nouvelle activité',
          sound: null,
          priority: 'normal' as const,
          interruptionLevel: 'passive' as const,
        } as const)
      : ({
          to: t.token,
          title: 'Kinhale',
          body: 'Nouvelle activité',
        } as const);
  });

  // Défense en profondeur (RM16 / KIN-087) : valider chaque message via Zod
  // strict **avant** l'appel Expo. Si un contributeur ajoute par inadvertance
  // un champ santé (data, subtitle, sound custom, …), le parse échoue et on
  // écarte le chunk — mieux vaut perdre une notif qu'exfiltrer une dose.
  const lockedMessages: typeof messages = [];
  for (const msg of messages) {
    const parsed = PushPayloadSchema.safeParse(msg);
    if (!parsed.success) {
      logger?.warn(
        { issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })) },
        'Payload push rejeté par PushPayloadSchema (KIN-087 RM16)',
      );
      continue;
    }
    lockedMessages.push(msg);
  }
  if (lockedMessages.length === 0) return;

  const chunks = expo.chunkPushNotifications(lockedMessages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      logger?.warn({ err }, 'Échec envoi push chunk (ignoré)');
    }
  }
}
