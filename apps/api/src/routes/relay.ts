import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';
import { mailboxMessages } from '../db/schema.js';
import type { JwtPayload } from '../plugins/jwt.js';

const householdChannel = (id: string) => `household:${id}`;

/**
 * Map in-memory pour le routing WS local (un relay node = une Map).
 * Redis pub/sub assure le broadcast cross-instance.
 */
const householdSockets = new Map<string, Set<WebSocket>>();

const relayRoute: FastifyPluginAsync = async (app) => {
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

  app.get('/', {
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
  }, (socket: WebSocket, request) => {
    const payload = request.user as JwtPayload;
    const { householdId, deviceId } = payload;

    if (!householdSockets.has(householdId)) {
      householdSockets.set(householdId, new Set());
      // S'abonner au canal Redis dès la première connexion pour ce foyer.
      app.redis.sub.subscribe(householdChannel(householdId)).catch((err) => {
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

      if (
        typeof msg !== 'object' ||
        msg === null ||
        typeof (msg as Record<string, unknown>)['blobJson'] !== 'string'
      ) {
        socket.send(JSON.stringify({ error: 'SyncMessage invalide' }));
        return;
      }

      const rawMsg = msg as Record<string, unknown>;
      const blobJson = rawMsg['blobJson'] as string; // déjà validé par le check typeof
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
          app.redis.sub.unsubscribe(householdChannel(householdId)).catch((err) => {
            app.log.warn({ err }, 'Échec unsubscribe Redis');
          });
        }
      }
    });

    socket.on('error', (err) => {
      app.log.error({ err }, 'WebSocket error');
    });
  });
};

export default relayRoute;
