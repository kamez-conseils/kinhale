import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { mailboxMessages } from '../db/schema.js';
import type { JwtPayload } from '../plugins/jwt.js';

/**
 * Max 100 messages / batch (cf. §7.2 SPECS). Au-delà, le client doit
 * paginater ses envois (pattern hasMore côté hook `useSyncBatchFallback`).
 */
const MAX_BATCH_SIZE = 100;

/**
 * Durée pendant laquelle un Idempotency-Key est mémorisé côté Redis. Doit
 * couvrir largement le retry exponentiel client (60s → 1h) sans exploser
 * la RAM Redis en cas d'abus. 2h = 2× le palier max du retry.
 */
const IDEMPOTENCY_TTL_SECONDS = 2 * 60 * 60;

/**
 * Borne par-blob : 64 KiB de blobJson chiffré. Un SyncMessage
 * XChaCha20-Poly1305 pour 1 événement pèse typiquement < 2 KiB ;
 * 64 KiB couvre un delta Automerge raisonnable sans exposer la DB à
 * un flood par blobs géants. Si on voit des rejets légitimes, monter
 * à 256 KiB au lieu de 64. Refs: kz-securite-KIN-072 §M1.
 */
const MAX_BLOB_BYTES = 64 * 1024;

const MessageSchema = z.object({
  blobJson: z.string().min(1).max(MAX_BLOB_BYTES),
  seq: z.number().int().min(0),
  sentAtMs: z.number().int().min(0),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_BATCH_SIZE),
});

const householdChannel = (id: string): string => `household:${id}`;
const idempotencyCacheKey = (deviceId: string, key: string): string =>
  `sync-batch:idem:${deviceId}:${key}`;

const syncBatchRoute: FastifyPluginAsync = async (app) => {
  app.post('/batch', { preHandler: [app.authenticate] }, async (request, reply) => {
    const payload = request.user as JwtPayload;
    const { householdId, deviceId } = payload;

    // 1. Idempotency-Key obligatoire (cf. §7.1 SPECS).
    const idemHeader = request.headers['idempotency-key'];
    const idemKey = typeof idemHeader === 'string' ? idemHeader.trim() : '';
    if (idemKey.length === 0) {
      return reply.status(400).send({ error: 'Header Idempotency-Key requis' });
    }

    // 2. Validation du body.
    const parsed = BodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Payload invalide',
        details: parsed.error.flatten(),
      });
    }
    const { messages } = parsed.data;

    // 3. Vérifier si Idempotency-Key déjà servie. `SET ... NX` : pose la key
    //    atomiquement seulement si elle n'existe pas. Le TTL protège la
    //    RAM Redis contre une accumulation illimitée.
    const cacheKey = idempotencyCacheKey(deviceId, idemKey);
    const stored = await app.redis.pub.set(cacheKey, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
    if (stored === null) {
      // Key déjà connue → batch déjà traité. On répond 200 sans réinsérer
      // ni re-publier pour respecter l'idempotence at-least-once.
      return reply.status(200).send({ duplicate: true, accepted: 0 });
    }

    // 4. Insertion **transactionnelle** + broadcast par message. L'ensemble
    //    du batch est atomique côté DB : un échec sur le Ne message rollback
    //    les N-1 précédents, le client pourra retenter. En cas d'échec, on
    //    supprime aussi l'Idempotency-Key Redis pour permettre au client de
    //    retenter avec le même key sans recevoir un faux 200 duplicate.
    //    Refs: kz-securite-KIN-072 §M2, kz-review-KIN-072 §M2.
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    const rows = messages.map((msg) => ({
      householdId,
      senderDeviceId: deviceId,
      blobJson: msg.blobJson,
      seq: msg.seq,
      sentAtMs: msg.sentAtMs,
      expiresAt,
    }));

    try {
      await app.db.insert(mailboxMessages).values(rows);
    } catch (err) {
      app.log.error({ err }, 'Erreur insert mailboxMessages (sync-batch)');
      // Libérer l'Idempotency-Key pour permettre un retry propre.
      try {
        await app.redis.pub.del(cacheKey);
      } catch (delErr) {
        app.log.warn({ err: delErr }, 'Échec del Idempotency-Key Redis (ignoré)');
      }
      return reply.status(503).send({ error: 'Service temporairement indisponible' });
    }

    // Broadcast post-insertion. Un échec publish ne retire pas les inserts
    // (les autres devices rattraperont via /relay/catchup). Log générique.
    for (const msg of messages) {
      try {
        await app.redis.pub.publish(
          householdChannel(householdId),
          JSON.stringify({
            blobJson: msg.blobJson,
            seq: msg.seq,
            sentAtMs: msg.sentAtMs,
          }),
        );
      } catch (err) {
        app.log.warn({ err }, 'Échec publish Redis sync-batch (ignoré)');
      }
    }

    return reply.status(200).send({ accepted: messages.length, duplicate: false });
  });
};

export default syncBatchRoute;
