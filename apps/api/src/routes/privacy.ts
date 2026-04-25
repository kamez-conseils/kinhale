/**
 * Route relais pour l'export de portabilité RGPD/Loi 25 (KIN-085, ADR-D14).
 *
 * Expose deux endpoints :
 * - `GET /me/privacy/export/metadata` : retourne les métadonnées non-santé
 *   du compte courant (devices, audit events, préférences notifs, quiet
 *   hours, comptage push tokens). **Scope-isolé strictement** par `sub` JWT —
 *   un utilisateur ne voit JAMAIS les données d'un autre utilisateur.
 * - `POST /audit/privacy-export` : trace localement la génération d'une
 *   archive de portabilité côté client (pattern strict identique à
 *   `/audit/report-generated`).
 *
 * Le second endpoint vit dans `audit.ts` (cohérence du module audit).
 *
 * **Zero-knowledge** :
 * - Aucune donnée santé n'est jamais exposée par le relais.
 * - Le payload retourné contient uniquement des métadonnées techniques
 *   produites par le relais lui-même (pas de relai de blob mailbox).
 * - Le `pushTokensCount` est un nombre — pas le contenu des tokens (RM16
 *   minimisation).
 *
 * Refs: ADR-D14, KIN-085, RGPD art. 20, Loi 25 art. 30.
 */

import type { FastifyPluginAsync } from 'fastify';
import { eq, count } from 'drizzle-orm';
import {
  auditEvents,
  devices,
  pushTokens,
  userNotificationPreferences,
  userQuietHours,
} from '../db/schema.js';
import type { SessionJwtPayload } from '../plugins/jwt.js';

/**
 * Quota de fetch metadata par device et par heure.
 *
 * 5/h est strict — un utilisateur normal n'exerce son droit à la portabilité
 * qu'occasionnellement. Un quota plus haut ouvrirait une porte à un device
 * compromis pour exfiltrer répétitivement les métadonnées et corréler les
 * réponses dans le temps.
 */
const PRIVACY_METADATA_MAX_PER_HOUR = 5;
const PRIVACY_METADATA_WINDOW_SECONDS = 3600;

/**
 * Borne supérieure du nombre d'audit events retournés dans un export.
 *
 * Motivation : la table `audit_events` est rate-limitée en écriture (5/h
 * `report_generated`, 20/h `report_shared`, 5/h `privacy_export`) et un
 * compte normal cumulera < 1000 events sur 5 ans. Mais un compte attaqué
 * pendant l'incubation des rate-limits pourrait stocker beaucoup plus.
 * 10 000 borne le payload à ~3 MB max et 14 ans à 2 events/jour.
 *
 * Pas de pagination en v1.0 (l'export est un acte rare et exhaustif). Si
 * un compte dépasse cette borne, ajouter cursor + limit en v1.1.
 */
const AUDIT_EVENTS_MAX_PER_EXPORT = 10_000;

const rateLimitKey = (deviceId: string): string => `rl:privacy-export-metadata:${deviceId}`;

/**
 * Réponse `GET /me/privacy/export/metadata`. Cohérent avec
 * `RelayExportMetadata` côté `@kinhale/reports`.
 */
interface ExportMetadataResponse {
  readonly accountId: string;
  readonly exportedAtMs: number;
  readonly devices: ReadonlyArray<{
    readonly deviceId: string;
    readonly registeredAtMs: number;
    readonly lastSeenMs: number | null;
  }>;
  readonly auditEvents: ReadonlyArray<{
    readonly eventType: string;
    readonly eventData: unknown;
    readonly createdAtMs: number;
  }>;
  readonly notificationPreferences: ReadonlyArray<{
    readonly notificationType: string;
    readonly enabled: boolean;
    readonly updatedAtMs: number;
  }>;
  readonly quietHours: {
    readonly enabled: boolean;
    readonly startLocalTime: string;
    readonly endLocalTime: string;
    readonly timezone: string;
    readonly updatedAtMs: number;
  } | null;
  readonly pushTokensCount: number;
}

const privacyRoute: FastifyPluginAsync = async (app) => {
  /**
   * GET /me/privacy/export/metadata
   *
   * Retourne strictement les métadonnées techniques que le relais détient
   * sur l'utilisateur courant. **Authz** : `sub` du JWT scope les filtres
   * `WHERE accountId = sub` sur **toutes** les tables interrogées — un
   * utilisateur ne peut JAMAIS exfiltrer les données d'un autre.
   *
   * **Aucune donnée santé.** Mailbox (`mailbox_messages`) est volontairement
   * exclue : (a) le contenu est chiffré opaque, le client peut le restituer
   * via la sync ; (b) la mailbox est indexée par `householdId`, pas par
   * `accountId` — un endpoint qui exposerait la mailbox d'un foyer divulguerait
   * potentiellement des données concernant d'autres aidants.
   */
  app.get(
    '/me/privacy/export/metadata',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { sub: accountId, deviceId } = request.user as SessionJwtPayload;

      // Rate-limit Redis (pattern identique à audit.ts).
      const key = rateLimitKey(deviceId);
      const counter = await app.redis.pub.incr(key);
      if (counter === 1) {
        await app.redis.pub.expire(key, PRIVACY_METADATA_WINDOW_SECONDS);
      }
      if (counter > PRIVACY_METADATA_MAX_PER_HOUR) {
        app.log.warn(
          { event: 'privacy.export.metadata.rate_limited', deviceId },
          'Rate-limit atteint sur /me/privacy/export/metadata',
        );
        return reply.status(429).send({ error: 'rate_limited' });
      }

      // 1) Devices du compte courant. Filtre WHERE strict.
      const deviceRows = await app.db
        .select({
          id: devices.id,
          createdAt: devices.createdAt,
        })
        .from(devices)
        .where(eq(devices.accountId, accountId));

      // 2) Audit events du compte courant. `limit` pose une borne mémoire
      //    explicite (10 000 events ≈ 14 ans à 2 events/jour) — défense en
      //    profondeur contre un compte avec un trail anormalement volumineux,
      //    même si les routes /audit/* sont déjà rate-limitées en upload.
      const auditRows = await app.db
        .select({
          eventType: auditEvents.eventType,
          eventData: auditEvents.eventData,
          createdAt: auditEvents.createdAt,
        })
        .from(auditEvents)
        .where(eq(auditEvents.accountId, accountId))
        .limit(AUDIT_EVENTS_MAX_PER_EXPORT);

      // 3) Préférences de notifications matérialisées du compte courant.
      const prefRows = await app.db
        .select({
          notificationType: userNotificationPreferences.notificationType,
          enabled: userNotificationPreferences.enabled,
          updatedAt: userNotificationPreferences.updatedAt,
        })
        .from(userNotificationPreferences)
        .where(eq(userNotificationPreferences.accountId, accountId));

      // 4) Quiet hours du compte courant (0 ou 1 ligne).
      const qhRows = await app.db
        .select({
          enabled: userQuietHours.enabled,
          startLocalTime: userQuietHours.startLocalTime,
          endLocalTime: userQuietHours.endLocalTime,
          timezone: userQuietHours.timezone,
          updatedAt: userQuietHours.updatedAt,
        })
        .from(userQuietHours)
        .where(eq(userQuietHours.accountId, accountId));

      // 5) Nombre de push tokens. On ne renvoie pas les tokens eux-mêmes
      //    (RM16 minimisation : un token APNs / FCM est une donnée techn-
      //    iquement réutilisable par un attaquant ; le renvoyer en clair
      //    crée une fenêtre d'exfiltration). Un comptage suffit pour la
      //    portabilité.
      const tokenCountRows = await app.db
        .select({ count: count(pushTokens.id) })
        .from(pushTokens)
        .innerJoin(devices, eq(pushTokens.deviceId, devices.id))
        .where(eq(devices.accountId, accountId));
      const pushTokensCount = tokenCountRows[0]?.count ?? 0;

      const qhRow = qhRows[0];
      const response: ExportMetadataResponse = {
        accountId,
        exportedAtMs: Date.now(),
        devices: deviceRows.map((d) => ({
          deviceId: d.id,
          registeredAtMs: d.createdAt.getTime(),
          // v1.0 : pas de tracking de last_seen — le champ est exposé pour
          // forward-compat (cf. RelayDeviceInfo).
          lastSeenMs: null,
        })),
        auditEvents: auditRows.map((a) => ({
          eventType: a.eventType,
          eventData: a.eventData,
          createdAtMs: a.createdAt.getTime(),
        })),
        notificationPreferences: prefRows.map((p) => ({
          notificationType: p.notificationType,
          enabled: p.enabled,
          updatedAtMs: p.updatedAt.getTime(),
        })),
        quietHours:
          qhRow !== undefined
            ? {
                enabled: qhRow.enabled,
                startLocalTime: qhRow.startLocalTime,
                endLocalTime: qhRow.endLocalTime,
                timezone: qhRow.timezone,
                updatedAtMs: qhRow.updatedAt.getTime(),
              }
            : null,
        pushTokensCount: Number(pushTokensCount),
      };

      return response;
    },
  );
};

export default privacyRoute;
