import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { Expo } from 'expo-server-sdk';
import { z } from 'zod';
import { mailboxMessages } from '../db/schema.js';
import type { SessionJwtPayload } from '../plugins/jwt.js';
import { handlePeerPing } from '../push/peer-ping-handler.js';
import { createDrizzleNotificationPreferenceStore } from './notification-preferences.js';
import { createDrizzleQuietHoursStore } from './quiet-hours.js';

/**
 * Schéma strict du message WS `peer_ping` entrant (KIN-082, RM5, ADR-D11).
 *
 * **Contrat figé** — toute évolution doit être doublée d'un passage
 * `kz-securite` + mise à jour de l'ADR-D11. Aucun champ santé ne doit
 * apparaître ici : le relais n'a besoin que de `pingType`, `doseId` (UUID
 * opaque pour déduplication) et `sentAtMs` (instant d'émission, pas de
 * prise).
 *
 * Les identifiants `householdId` et `senderDeviceId` ne sont **pas** dans le
 * schéma : le relais les lit exclusivement du JWT vérifié du handshake WS
 * (défense en profondeur contre l'usurpation).
 *
 * Miroir strict de `packages/sync/src/peer/peer-ping.ts` — si l'un évolue,
 * mettre à jour l'autre (la duplication évite une dépendance cyclique
 * `apps/api` → `@kinhale/sync` → `@kinhale/domain` qui révélerait une dette
 * de typecheck existante hors scope KIN-082).
 */
const PeerPingMessageSchema = z
  .object({
    type: z.literal('peer_ping'),
    pingType: z.enum(['dose_recorded']),
    doseId: z.string().uuid(),
    sentAtMs: z.number().finite().nonnegative(),
  })
  .strict();

const expo = new Expo();

const householdChannel = (id: string) => `household:${id}`;

/**
 * Map in-memory pour le routing WS local (un relay node = une Map).
 * Redis pub/sub assure le broadcast cross-instance.
 */
const householdSockets = new Map<string, Set<WebSocket>>();

/**
 * Route relais WS du flux de sync E2EE Kinhale.
 *
 * Canaux de message pris en charge :
 * 1. **Sync blob** (`{blobJson, seq, sentAtMs}`) : blob chiffré Automerge
 *    persisté en mailbox + broadcast Redis aux autres devices du foyer.
 * 2. **Peer ping** (`{type: 'peer_ping', pingType, doseId, sentAtMs}`) :
 *    signalement typé d'un événement métier. Déclenche un push opaque aux
 *    autres aidants du foyer via `handlePeerPing`. Voir ADR-D11 — le
 *    payload ne contient aucune donnée santé, et le relais lit toujours
 *    `householdId` / `senderDeviceId` depuis le JWT vérifié, jamais du
 *    corps du message.
 *
 * Les pushs aveugles sur tout message de sync ont été retirés (régression
 * KIN-082) : ils généraient des notifications non-typées qui ignoraient les
 * préférences granulaires (E5-S07) et les quiet hours (E5-S08). La
 * notification peer est maintenant exclusivement portée par `peer_ping`.
 *
 * Refs: KIN-082, E5-S05, RM5, RM16, ADR-D11.
 */
const relayRoute: FastifyPluginAsync = async (app) => {
  // Stores pour le dispatcher (préférences + quiet hours). Partagent la
  // connexion Drizzle avec les autres routes.
  const prefsStore = createDrizzleNotificationPreferenceStore(app.db);
  const quietStore = createDrizzleQuietHoursStore(app.db);

  // Listener Redis partagé — routage vers les sockets locaux du foyer.
  app.redis.sub.on('message', (channel: string, raw: string) => {
    const householdId = channel.slice('household:'.length);
    const peers = householdSockets.get(householdId);
    if (!peers) return;
    for (const peer of peers) {
      if (peer.readyState === peer.OPEN) {
        try {
          peer.send(raw);
        } catch (err) {
          app.log.warn({ err }, 'Échec envoi WS peer (Redis broadcast)');
        }
      }
    }
  });

  app.get(
    '/',
    {
      websocket: true,
      preHandler: async (request, reply) => {
        const query = request.query as Record<string, unknown>;
        const token = typeof query['token'] === 'string' ? query['token'] : undefined;
        if (!token) {
          return reply.status(401).send({ error: 'Token JWT requis' });
        }
        // Injecter le token dans Authorization pour que jwtVerify() le trouve.
        request.headers['authorization'] = `Bearer ${token}`;
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ error: 'Token JWT invalide ou expiré' });
        }
      },
    },
    (socket: WebSocket, request) => {
      const payload = request.user as SessionJwtPayload;
      const { householdId, deviceId } = payload;

      if (!householdSockets.has(householdId)) {
        householdSockets.set(householdId, new Set());
        // S'abonner au canal Redis dès la première connexion pour ce foyer.
        app.redis.sub.subscribe(householdChannel(householdId)).catch((err: unknown) => {
          app.log.error({ err }, 'Échec subscribe Redis channel');
          const sockets = householdSockets.get(householdId);
          if (sockets) {
            for (const s of sockets) s.close(1011, 'Erreur infrastructure');
            householdSockets.delete(householdId);
          }
        });
      }
      const socketSet = householdSockets.get(householdId);
      socketSet?.add(socket);

      socket.on('message', async (raw) => {
        let msg: unknown;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          socket.send(JSON.stringify({ error: 'JSON invalide' }));
          return;
        }

        // ── Branche 1 : peer_ping (notification croisée RM5) ─────────────
        //
        // Validé AVANT la branche sync blob : ne doit pas être confondu avec
        // un message malformé. Le schéma Zod garantit que les champs attendus
        // (type, pingType, doseId UUID v4, sentAtMs) sont présents et
        // typés strictement — tout champ supplémentaire est rejeté (strict()).
        if (
          typeof msg === 'object' &&
          msg !== null &&
          (msg as Record<string, unknown>)['type'] === 'peer_ping'
        ) {
          const parsed = PeerPingMessageSchema.safeParse(msg);
          if (!parsed.success) {
            socket.send(JSON.stringify({ error: 'peer_ping invalide' }));
            return;
          }
          const ping = parsed.data;
          // Fire-and-forget : le dispatch push ne doit pas bloquer la pipe WS.
          // Le handler gère lui-même la dédup, le rate-limit et les erreurs.
          void (async () => {
            try {
              await handlePeerPing({
                db: app.db,
                redis: app.redis.pub,
                expo,
                householdId,
                senderDeviceId: deviceId,
                doseId: ping.doseId,
                prefsStore,
                quietStore,
                logger: app.log,
              });
            } catch (err) {
              app.log.warn({ err }, 'Échec handlePeerPing (ignoré)');
            }
          })();
          return;
        }

        // ── Branche 2 : sync blob Automerge chiffré ──────────────────────
        if (
          typeof msg !== 'object' ||
          msg === null ||
          typeof (msg as Record<string, unknown>)['blobJson'] !== 'string'
        ) {
          socket.send(JSON.stringify({ error: 'SyncMessage invalide' }));
          return;
        }

        const rawMsg = msg as Record<string, unknown>;
        const blobJson = rawMsg['blobJson'] as string;
        const seq = typeof rawMsg['seq'] === 'number' ? rawMsg['seq'] : 0;
        const sentAtMs = typeof rawMsg['sentAtMs'] === 'number' ? rawMsg['sentAtMs'] : Date.now();
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        try {
          await app.db.insert(mailboxMessages).values({
            householdId,
            senderDeviceId: deviceId,
            blobJson,
            seq,
            sentAtMs,
            expiresAt,
          });
        } catch (err) {
          app.log.error({ err }, 'Erreur insert mailboxMessages');
          socket.send(JSON.stringify({ error: 'Erreur persistance message' }));
          return;
        }

        // Publier vers Redis → broadcast à tous les relay nodes du même foyer.
        try {
          await app.redis.pub.publish(householdChannel(householdId), raw.toString());
        } catch (err) {
          app.log.error({ err }, 'Erreur publish Redis');
        }
      });

      socket.on('close', () => {
        const sockets = householdSockets.get(householdId);
        if (sockets) {
          sockets.delete(socket);
          if (sockets.size === 0) {
            householdSockets.delete(householdId);
            app.redis.sub.unsubscribe(householdChannel(householdId)).catch((err: unknown) => {
              app.log.warn({ err }, 'Échec unsubscribe Redis');
            });
          }
        }
      });

      socket.on('error', (err) => {
        app.log.error({ err }, 'WebSocket error');
      });
    },
  );
};

export default relayRoute;
