import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import {
  ALWAYS_ENABLED_NOTIFICATION_TYPES,
  NOTIFICATION_TYPES,
  isAlwaysEnabled,
  isNotificationType,
  type NotificationType,
} from '@kinhale/domain/notifications';
import { userNotificationPreferences } from '../db/schema.js';
import type { SessionJwtPayload } from '../plugins/jwt.js';
import type { DrizzleDb } from '../plugins/db.js';
import type { NotificationPreferenceStore } from '../push/push-dispatch.js';

/**
 * Schéma Zod du body PUT — un seul type + un boolean.
 *
 * On accepte **seulement** les types connus (ensemble fermé) pour ne pas
 * permettre au client de persister des types exotiques qui ne seraient
 * jamais filtrés par le dispatcher.
 */
const PutBody = z.object({
  type: z.enum(NOTIFICATION_TYPES as unknown as [NotificationType, ...NotificationType[]]),
  enabled: z.boolean(),
});

/**
 * Réponse GET `/me/notification-preferences`.
 *
 * Convention : les types **absents** de la table sont renvoyés avec
 * `enabled: true` (défaut implicite), **sauf** pour les types absents ET
 * sanctuarisés qui sont également `enabled: true` (logique unifiée côté
 * client : l'UI grise le toggle pour les types sanctuarisés).
 *
 * Cette convention évite au client de « découvrir » les défauts via une
 * absence : la réponse est exhaustive sur `NOTIFICATION_TYPES`.
 */
interface PreferencesResponse {
  readonly preferences: ReadonlyArray<{
    readonly type: NotificationType;
    readonly enabled: boolean;
    readonly alwaysEnabled: boolean;
  }>;
}

const notificationPreferencesRoute: FastifyPluginAsync = async (app) => {
  /**
   * GET /me/notification-preferences
   *
   * Retourne l'intégralité des types avec leur statut calculé :
   * - types sanctuarisés (missed_dose, security_alert) : `enabled: true`
   *   et `alwaysEnabled: true`.
   * - types stockés avec `enabled = false` : `enabled: false`.
   * - types non stockés : `enabled: true` (défaut).
   */
  app.get('/me/notification-preferences', { preHandler: [app.authenticate] }, async (request) => {
    const { sub: accountId } = request.user as SessionJwtPayload;

    const stored = await app.db
      .select({
        type: userNotificationPreferences.notificationType,
        enabled: userNotificationPreferences.enabled,
      })
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.accountId, accountId));

    const storedMap = new Map<string, boolean>();
    for (const row of stored) {
      storedMap.set(row.type, row.enabled);
    }

    const preferences = NOTIFICATION_TYPES.map((type) => {
      const alwaysEnabled = isAlwaysEnabled(type);
      const stored = storedMap.get(type);
      const enabled = alwaysEnabled ? true : (stored ?? true);
      return { type, enabled, alwaysEnabled };
    });

    const response: PreferencesResponse = { preferences };
    return response;
  });

  /**
   * PUT /me/notification-preferences
   *
   * Persiste (ou met à jour) une préférence pour un type donné.
   *
   * - Rejette 400 sur un type sanctuarisé désactivé (`enabled: false` avec
   *   `type in ALWAYS_ENABLED_NOTIFICATION_TYPES`). Retourner 400 plutôt que
   *   422 pour rester cohérent avec le pattern des autres routes (auth,
   *   invitations, notifications).
   * - Accepte silencieusement `enabled: true` sur un type sanctuarisé
   *   (no-op persistant : on ne stocke pas — c'est déjà la valeur par
   *   défaut et le stockage créerait du bruit inutile).
   */
  app.put(
    '/me/notification-preferences',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parse = PutBody.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: 'invalid_body' });
      }
      const { type, enabled } = parse.data;

      // Défense en profondeur : isNotificationType doit renvoyer true ici puisque
      // z.enum a déjà filtré, mais on garde la garde pour tout input pathologique
      // qui contournerait Zod (monkey-patching, future évolution du schéma).
      if (!isNotificationType(type)) {
        return reply.status(400).send({ error: 'invalid_type' });
      }

      if (isAlwaysEnabled(type)) {
        if (enabled === false) {
          // Interdit par SPECS §9 + RM25 : missed_dose et security_alert sont
          // toujours actifs. On renvoie 400 explicite pour que le client
          // frontend puisse afficher le tooltip adéquat.
          return reply.status(400).send({ error: 'type_not_disablable' });
        }
        // `enabled: true` sur un type sanctuarisé → no-op persistant.
        return reply.status(204).send();
      }

      const { sub: accountId } = request.user as SessionJwtPayload;

      await app.db
        .insert(userNotificationPreferences)
        .values({ accountId, notificationType: type, enabled })
        .onConflictDoUpdate({
          target: [
            userNotificationPreferences.accountId,
            userNotificationPreferences.notificationType,
          ],
          set: { enabled, updatedAt: new Date() },
        });

      return reply.status(204).send();
    },
  );
};

export default notificationPreferencesRoute;

/**
 * Store de préférences exposé au dispatcher push. Implémenté ici pour
 * partager la connexion Drizzle avec les routes ; injecté par le scheduler
 * v1.1 (hors périmètre E5-S07) dans `dispatchPush`.
 *
 * Sémantique : retourne l'ensemble des `accountId` du lot donné qui ont
 * **explicitement** désactivé le type. Les autres (absents de la table)
 * sont considérés comme activés (défaut).
 *
 * Optimisé pour le cas d'usage `dispatchPush` : un seul type à la fois,
 * potentiellement beaucoup d'accountIds (tous les aidants d'un foyer).
 * `inArray` est indexé par (`accountId`, `notificationType`).
 */
export function createDrizzleNotificationPreferenceStore(
  db: DrizzleDb,
): NotificationPreferenceStore {
  return {
    async findDisabledAccountIds(accountIds, type) {
      if (accountIds.length === 0 || ALWAYS_ENABLED_NOTIFICATION_TYPES.includes(type)) {
        return new Set();
      }
      // `inArray` attend un array mutable (`string[]`), or le contrat
      // expose `readonly string[]`. On matérialise une copie mutable plutôt
      // que de caster : le coût (O(n) d'un lot de tokens par foyer, ~<10)
      // est négligeable et évite un `as` qui masquerait un futur drift.
      const rows = await db
        .select({ accountId: userNotificationPreferences.accountId })
        .from(userNotificationPreferences)
        .where(
          and(
            inArray(userNotificationPreferences.accountId, [...accountIds]),
            eq(userNotificationPreferences.notificationType, type),
            eq(userNotificationPreferences.enabled, false),
          ),
        );
      return new Set(rows.map((r) => r.accountId));
    },
  };
}
