import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { auditEvents } from '../db/schema.js';
import type { SessionJwtPayload } from '../plugins/jwt.js';

/**
 * Nombre max de `report_generated` par device et par heure.
 *
 * Motivation : la route est authentifiée par JWT mais un device compromis
 * pourrait spammer le store d'audit ou saturer l'infra (écritures Postgres
 * répétées). On applique un seuil conservateur — un usage normal (usage
 * consultation médicale) ne génère pas plus de 2-3 rapports par jour.
 *
 * Même pattern que `notifications.ts` (E-mail fallback) et aligné sur le
 * quota anti-spam RM9.
 */
const AUDIT_REPORT_MAX_PER_HOUR = 10;
const AUDIT_REPORT_WINDOW_SECONDS = 3600;

/**
 * Nombre max de `report_shared` par device et par heure (KIN-084, E8-S04).
 *
 * Rationale : un même rapport peut légitimement être partagé plusieurs fois
 * (PDF à deux pneumo-pédiatres + CSV d'archive). Un quota un peu plus
 * généreux que `report_generated` est adapté — l'acte de partage est plus
 * répété que l'acte de génération. 20/h couvre large sans ouvrir la porte
 * à un spam audit-store.
 */
const AUDIT_REPORT_SHARED_MAX_PER_HOUR = 20;
const AUDIT_REPORT_SHARED_WINDOW_SECONDS = 3600;

/**
 * Nombre max de `privacy_export` par device et par heure (KIN-085, E9-S02).
 *
 * Quota strict : un export RGPD/Loi 25 est une action rare (1-2/an pour un
 * usage normal). Limiter à 5/h freine un device compromis qui voudrait
 * polluer l'audit ou tester massivement la pipeline.
 */
const AUDIT_PRIVACY_EXPORT_MAX_PER_HOUR = 5;
const AUDIT_PRIVACY_EXPORT_WINDOW_SECONDS = 3600;

/**
 * Quota de lecture du journal d'audit (KIN-093, E9-S09).
 *
 * 60/h/device — cohérent avec les autres routes self-scoped authentifiées
 * (notification-preferences, quiet-hours). La lecture est rare (l'écran est
 * consulté ponctuellement), un quota plus haut ouvrirait une fenêtre
 * d'exfiltration répétée pour un device compromis.
 */
const AUDIT_LIST_MAX_PER_HOUR = 60;
const AUDIT_LIST_WINDOW_SECONDS = 3600;

/**
 * Borne supérieure du nombre d'événements retournés par `GET /me/audit-events`.
 *
 * 90 derniers événements (cf. E9-S09 — « 90 derniers évts »). Suffisant pour
 * couvrir plusieurs mois d'activité d'un foyer normal sans exposer un trail
 * volumineux d'un coup.
 */
const AUDIT_LIST_DEFAULT_LIMIT = 90;
const AUDIT_LIST_MAX_LIMIT = 90;

const rateLimitKey = (deviceId: string): string => `rl:audit-report-generated:${deviceId}`;
const rateLimitSharedKey = (deviceId: string): string => `rl:audit-report-shared:${deviceId}`;
const rateLimitPrivacyExportKey = (deviceId: string): string =>
  `rl:audit-privacy-export:${deviceId}`;
const rateLimitListKey = (deviceId: string): string => `rl:audit-list:${deviceId}`;

/**
 * Borne supérieure de timestamp acceptée (année 3000). Protège contre des
 * overflow JS ou des valeurs farfelues qui pollueraient les index Postgres.
 * Les valeurs au-delà sont presque certainement des bugs côté client.
 */
const MAX_ACCEPTABLE_MS = 32_503_680_000_000; // 3000-01-01T00:00:00Z

/**
 * Schéma Zod **strict** du body `POST /audit/report-generated`.
 *
 * Les champs autorisés sont **exclusivement** :
 * - `reportHash` : hash SHA-256 hex minuscule 64 chars (RM24 — vérifiable
 *   côté client, opaque côté relais).
 * - `rangeStartMs` / `rangeEndMs` : bornes UTC ms de la plage du rapport.
 *   `endMs > startMs` enforced par `refine`.
 * - `generatedAtMs` : horodatage de génération côté client.
 *
 * `.strict()` rejette explicitement tout champ supplémentaire (défense en
 * profondeur contre un client compromis qui tenterait d'exfiltrer vers l'audit :
 * une propriété `childName`, `pumpName`, `freeFormTag`, etc. serait interceptée
 * à la porte d'entrée sans jamais toucher la DB).
 *
 * Refs: ADR-D12, RM24, PRD §4 (pas de donnée santé côté relais), zero-knowledge.
 */
const ReportGeneratedBody = z
  .object({
    reportHash: z.string().regex(/^[0-9a-f]{64}$/, 'invalid_hash'),
    rangeStartMs: z.number().int().min(0).max(MAX_ACCEPTABLE_MS),
    rangeEndMs: z.number().int().min(0).max(MAX_ACCEPTABLE_MS),
    generatedAtMs: z.number().int().min(0).max(MAX_ACCEPTABLE_MS),
  })
  .strict()
  .refine((b) => b.rangeEndMs > b.rangeStartMs, { message: 'invalid_range_order' });

type ReportGeneratedData = z.infer<typeof ReportGeneratedBody>;

/**
 * Enum fermée des méthodes de partage autorisées (E8-S04).
 *
 * Valeurs :
 * - `download` : téléchargement PDF via bouton natif (web blob / mobile
 *   `FileSystem` → partage OS sans share sheet explicite).
 * - `system_share` : partage PDF via share sheet OS / `navigator.share`
 *   (l'utilisateur choisit Mail / iMessage / WhatsApp / AirDrop).
 * - `csv_download` : téléchargement CSV.
 * - `csv_system_share` : partage CSV via share sheet OS.
 *
 * Toute autre valeur est rejetée par Zod. Si une v1.1 introduit le lien
 * signé 7j (ADR-D13), une valeur `signed_link` sera ajoutée ici — la
 * migration audit_events n'a pas besoin d'évoluer (jsonb opaque).
 */
const ShareMethod = z.enum(['download', 'system_share', 'csv_download', 'csv_system_share']);

/**
 * Schéma Zod **strict** du body `POST /audit/report-shared` (E8-S04).
 *
 * Même pattern que `ReportGeneratedBody` :
 * - `.strict()` bloque tout champ supplémentaire (défense anti-fuite santé).
 * - `reportHash` en hex minuscule 64 chars (chaîne avec le rapport généré).
 * - `shareMethod` enum fermée.
 * - `sharedAtMs` borné pour protéger les index Postgres.
 *
 * **Zero-knowledge** : aucun des champs n'expose de contenu santé. Le hash
 * est opaque, la méthode est un identifiant d'action, le timestamp est
 * fonctionnellement public (l'horloge serveur en a une copie).
 */
const ReportSharedBody = z
  .object({
    reportHash: z.string().regex(/^[0-9a-f]{64}$/, 'invalid_hash'),
    shareMethod: ShareMethod,
    sharedAtMs: z.number().int().min(0).max(MAX_ACCEPTABLE_MS),
  })
  .strict();

type ReportSharedData = z.infer<typeof ReportSharedBody>;

/**
 * Schéma Zod **strict** du body `POST /audit/privacy-export` (E9-S02, KIN-085).
 *
 * Trace la génération **locale** d'une archive de portabilité RGPD/Loi 25.
 * Seuls 2 champs autorisés :
 * - `archiveHash` : SHA-256 hex du ZIP entier — opaque côté relais, vérifiable
 *   côté client.
 * - `generatedAtMs` : horodatage de génération côté client.
 *
 * `.strict()` rejette tout champ supplémentaire — défense en profondeur
 * contre un client compromis qui tenterait d'exfiltrer une donnée santé
 * (ex. `childName`, `pumpName`) via le canal audit.
 *
 * **Zero-knowledge** :
 * - `archiveHash` est un digest non réversible.
 * - `generatedAtMs` est équivalent à l'horloge serveur à la milliseconde.
 *
 * Refs: ADR-D14, KIN-085, RGPD art. 20, Loi 25 art. 30.
 */
const PrivacyExportBody = z
  .object({
    archiveHash: z.string().regex(/^[0-9a-f]{64}$/, 'invalid_hash'),
    generatedAtMs: z.number().int().min(0).max(MAX_ACCEPTABLE_MS),
  })
  .strict();

type PrivacyExportData = z.infer<typeof PrivacyExportBody>;

/**
 * Schéma Zod du querystring `GET /me/audit-events` (KIN-093, E9-S09).
 *
 * Pagination v1 minimaliste : un simple `limit` borné par
 * {@link AUDIT_LIST_MAX_LIMIT}. La spec parle de pagination cursor-based
 * « optionnelle pour le futur » — en v1.0 on retourne juste les N plus
 * récents, ordre antéchronologique. Si > 90 events s'avèrent nécessaires
 * un jour, ajouter un curseur `before` (timestamp d'un event observé) sans
 * changer le format actuel.
 */
const ListEventsQuery = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(AUDIT_LIST_MAX_LIMIT)
      .default(AUDIT_LIST_DEFAULT_LIMIT),
  })
  .strict();

/**
 * Whitelists **explicites** des champs `event_data` retournés au client par
 * type d'événement (KIN-093, défense en profondeur anti-fuite).
 *
 * Motivation : la table `audit_events` accepte n'importe quel JSONB. Les
 * routes d'écriture (`POST /audit/*`) protègent à l'entrée via Zod `.strict()`,
 * mais un dev pourrait :
 * - écrire un nouvel événement sans schéma strict côté insert,
 * - faire un JOIN par accident qui ramènerait une colonne d'une autre table,
 * - patcher une ligne existante avec des champs supplémentaires.
 *
 * La sortie est donc filtrée par une **deuxième barrière** : seul les champs
 * documentés ici remontent au client. Tout champ inconnu est silencieusement
 * écarté (pas d'erreur — l'API reste tolérante aux données legacy).
 *
 * Aligné sur les schémas Zod d'écriture déclarés plus haut. Si un nouveau
 * type est introduit, il faut y ajouter son entrée ; sinon ses event_data
 * sortiront vides (`{}`), ce qui est le comportement le plus sûr par défaut.
 *
 * **Aucune donnée santé** ici par construction — uniquement hashes opaques
 * et timestamps.
 */
type AuditEventDataPlain = Readonly<Record<string, unknown>>;

const AUDIT_EVENT_DATA_WHITELIST: Readonly<Record<string, ReadonlyArray<string>>> = {
  report_generated: ['reportHash', 'rangeStartMs', 'rangeEndMs', 'generatedAtMs'],
  report_shared: ['reportHash', 'shareMethod', 'sharedAtMs'],
  privacy_export: ['archiveHash', 'generatedAtMs'],
  // E9-S03 / KIN-086 — payloads écrits par account-deletion.ts.
  account_deletion_requested: ['scheduledAtMs', 'requestedAtMs'],
  account_deletion_cancelled: ['cancelledAtMs'],
  // Worker `account-purge` — l'événement est inséré avec `account_id = NULL`
  // (FK ON DELETE SET NULL) et un `pseudoId` pour corrélation post-purge.
  // Ce type ne devrait jamais apparaître dans `GET /me/audit-events` (le
  // compte est purgé), mais on déclare la whitelist par sécurité.
  account_deleted: ['pseudoId', 'deletedAtMs'],
};

/**
 * Filtre une valeur `event_data` brute en ne gardant que les clés autorisées
 * pour le type donné. Tout type inconnu retourne `{}` (fail-closed).
 */
function pickWhitelistedEventData(eventType: string, raw: unknown): AuditEventDataPlain {
  const allowed = AUDIT_EVENT_DATA_WHITELIST[eventType];
  if (allowed === undefined) {
    return {};
  }
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  const out: Record<string, unknown> = {};
  const obj = raw as Record<string, unknown>;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      out[key] = obj[key];
    }
  }
  return out;
}

/**
 * Format de réponse `GET /me/audit-events`.
 *
 * **Aucune fuite de scope** : `accountId` est *volontairement* absent —
 * le client connaît son propre `sub` via le JWT, pas besoin de lui répéter,
 * et son absence évite qu'un futur dev introduise une régression IDOR
 * (l'attaquant n'a aucun champ à comparer pour deviner un id étranger).
 */
interface AuditEventListItem {
  readonly id: string;
  readonly eventType: string;
  readonly eventData: AuditEventDataPlain;
  readonly createdAtMs: number;
}

interface AuditEventListResponse {
  readonly events: ReadonlyArray<AuditEventListItem>;
}

const auditRoute: FastifyPluginAsync = async (app) => {
  /**
   * POST /audit/report-generated (E8-S05)
   *
   * Trace la génération locale d'un rapport médecin PDF. Appelé par le
   * client après une génération réussie. En offline, le client retry
   * selon sa propre stratégie (pas de retry côté serveur).
   *
   * **Zero-knowledge** : le body ne contient **aucune donnée santé**.
   * Le hash est opaque, la plage est une métadonnée temporelle, le
   * timestamp est équivalent à l'heure serveur à la milliseconde près.
   *
   * Renvoie 201 Created même si la ligne est la N-ième identique (pas
   * de dédup : l'audit doit refléter toutes les générations, même répétées).
   */
  app.post('/report-generated', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = ReportGeneratedBody.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'invalid_body' });
    }

    const { sub: accountId, deviceId } = request.user as SessionJwtPayload;

    // Rate-limit Redis (pattern identique à notifications.ts).
    const key = rateLimitKey(deviceId);
    const count = await app.redis.pub.incr(key);
    if (count === 1) {
      await app.redis.pub.expire(key, AUDIT_REPORT_WINDOW_SECONDS);
    }
    if (count > AUDIT_REPORT_MAX_PER_HOUR) {
      // Log structurel (aucune donnée santé — juste le deviceId et le compteur).
      app.log.warn(
        { event: 'audit.report_generated.rate_limited', deviceId },
        'Rate-limit atteint sur /audit/report-generated',
      );
      return reply.status(429).send({ error: 'rate_limited' });
    }

    const data: ReportGeneratedData = parse.data;

    await app.db.insert(auditEvents).values({
      accountId,
      eventType: 'report_generated',
      eventData: data,
    });

    return reply.status(201).send({ ok: true });
  });

  /**
   * POST /audit/report-shared (E8-S04, KIN-084)
   *
   * Trace un partage local d'un rapport médecin (PDF ou CSV) via download
   * ou share sheet OS. Le partage est toujours client-side (ADR-D13), le
   * relais ne voit ni le PDF, ni le CSV, ni les destinataires.
   *
   * **Zero-knowledge** : le body ne contient **aucune donnée santé** :
   * - `reportHash` : hash SHA-256 opaque (RM24) du contenu — partagé avec
   *   l'entrée `report_generated` correspondante pour corrélation audit.
   * - `shareMethod` : enum `download` | `system_share` | `csv_download`
   *   | `csv_system_share`.
   * - `sharedAtMs` : horodatage client du partage.
   *
   * Renvoie 201 Created même si un précédent `report_shared` existe déjà
   * avec les mêmes champs (un aidant peut partager plusieurs fois — on
   * trace chaque partage individuellement pour la conformité Loi 25).
   *
   * Rate-limit Redis : 20/h/device (plus permissif que `report_generated`
   * car un même rapport est légitimement partagé plusieurs fois).
   *
   * Refs: ADR-D12, ADR-D13, E8-S04.
   */
  app.post('/report-shared', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = ReportSharedBody.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'invalid_body' });
    }

    const { sub: accountId, deviceId } = request.user as SessionJwtPayload;

    // Rate-limit Redis (pattern identique à /audit/report-generated).
    const key = rateLimitSharedKey(deviceId);
    const count = await app.redis.pub.incr(key);
    if (count === 1) {
      await app.redis.pub.expire(key, AUDIT_REPORT_SHARED_WINDOW_SECONDS);
    }
    if (count > AUDIT_REPORT_SHARED_MAX_PER_HOUR) {
      app.log.warn(
        { event: 'audit.report_shared.rate_limited', deviceId },
        'Rate-limit atteint sur /audit/report-shared',
      );
      return reply.status(429).send({ error: 'rate_limited' });
    }

    const data: ReportSharedData = parse.data;

    await app.db.insert(auditEvents).values({
      accountId,
      eventType: 'report_shared',
      eventData: data,
    });

    return reply.status(201).send({ ok: true });
  });

  /**
   * POST /audit/privacy-export (E9-S02, KIN-085)
   *
   * Trace la génération locale d'une archive de portabilité RGPD/Loi 25.
   * Appelé par le client après que `buildPrivacyArchive` a produit le ZIP.
   *
   * **Zero-knowledge strict** : le body ne contient **aucune donnée santé** :
   * - `archiveHash` : SHA-256 hex de l'archive (RM24-like) — opaque relais.
   * - `generatedAtMs` : timestamp client.
   *
   * Renvoie 201 même en cas de génération répétée (un utilisateur peut
   * légitimement régénérer plusieurs fois — chaque tentative est tracée).
   *
   * Rate-limit Redis : 5/h/device (action rare).
   *
   * Refs: ADR-D14, KIN-085, E9-S02.
   */
  app.post('/privacy-export', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = PrivacyExportBody.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'invalid_body' });
    }

    const { sub: accountId, deviceId } = request.user as SessionJwtPayload;

    const key = rateLimitPrivacyExportKey(deviceId);
    const count = await app.redis.pub.incr(key);
    if (count === 1) {
      await app.redis.pub.expire(key, AUDIT_PRIVACY_EXPORT_WINDOW_SECONDS);
    }
    if (count > AUDIT_PRIVACY_EXPORT_MAX_PER_HOUR) {
      app.log.warn(
        { event: 'audit.privacy_export.rate_limited', deviceId },
        'Rate-limit atteint sur /audit/privacy-export',
      );
      return reply.status(429).send({ error: 'rate_limited' });
    }

    const data: PrivacyExportData = parse.data;

    await app.db.insert(auditEvents).values({
      accountId,
      eventType: 'privacy_export',
      eventData: data,
    });

    return reply.status(201).send({ ok: true });
  });
};

/**
 * Plugin séparé pour `GET /me/audit-events` (KIN-093, E9-S09).
 *
 * Hébergé dans le même fichier que `auditRoute` pour cohérence du module
 * audit, mais enregistré **sans préfixe** côté `app.ts` afin d'exposer la
 * route à `/me/audit-events` (pattern aligné sur `notification-preferences`,
 * `quiet-hours`, `privacy`).
 *
 * **Sécurité (KIN-093)** :
 * - Authentification JWT obligatoire (`preHandler: [app.authenticate]`).
 * - Filtre `WHERE account_id = sub` strict — aucune fuite cross-tenant
 *   possible (un JWT du compte B ne récupère JAMAIS les events de A).
 * - Rate-limit Redis 60/h/device (cohérent self-scoped).
 * - Réponse strictement scopée à la table `audit_events` — aucun JOIN.
 * - `event_data` est filtré par `pickWhitelistedEventData` : seuls les
 *   champs documentés par type sont remontés au client. Tout champ
 *   inattendu est écarté silencieusement (fail-closed).
 * - L'`accountId` n'apparaît PAS dans la réponse (le client le connaît
 *   déjà via le JWT — réémettre ne fait que créer une cible IDOR).
 *
 * Refs: KIN-093, E9-S09, RM11.
 */
const auditEventsListRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: z.infer<typeof ListEventsQuery> }>(
    '/me/audit-events',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsedQuery = ListEventsQuery.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({ error: 'invalid_query' });
      }
      const { limit } = parsedQuery.data;

      const { sub: accountId, deviceId } = request.user as SessionJwtPayload;

      // Rate-limit Redis (pattern identique à audit.ts / privacy.ts).
      const key = rateLimitListKey(deviceId);
      const count = await app.redis.pub.incr(key);
      if (count === 1) {
        await app.redis.pub.expire(key, AUDIT_LIST_WINDOW_SECONDS);
      }
      if (count > AUDIT_LIST_MAX_PER_HOUR) {
        app.log.warn(
          { event: 'audit.list.rate_limited', deviceId },
          'Rate-limit atteint sur GET /me/audit-events',
        );
        return reply.status(429).send({ error: 'rate_limited' });
      }

      // Filtrage strict par `account_id = sub`. La projection ne sélectionne
      // QUE les colonnes d'`audit_events` — aucun JOIN possible avec une
      // autre table (cf. anti-fuite KIN-093). Si on ajoute un jour des FK
      // à exposer (ex. invite émetteur), il faudra étendre la whitelist
      // explicitement et mettre à jour les tests anti-fuite.
      const rows = await app.db
        .select({
          id: auditEvents.id,
          eventType: auditEvents.eventType,
          eventData: auditEvents.eventData,
          createdAt: auditEvents.createdAt,
        })
        .from(auditEvents)
        .where(eq(auditEvents.accountId, accountId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit);

      const response: AuditEventListResponse = {
        events: rows.map((r) => ({
          id: r.id,
          eventType: r.eventType,
          eventData: pickWhitelistedEventData(r.eventType, r.eventData),
          createdAtMs: r.createdAt.getTime(),
        })),
      };

      return reply.status(200).send(response);
    },
  );
};

export { auditEventsListRoute };
export default auditRoute;
