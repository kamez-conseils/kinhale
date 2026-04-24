import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
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

const rateLimitKey = (deviceId: string): string => `rl:audit-report-generated:${deviceId}`;
const rateLimitSharedKey = (deviceId: string): string => `rl:audit-report-shared:${deviceId}`;

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
};

export default auditRoute;
