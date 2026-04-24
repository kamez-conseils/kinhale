import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import type { Transporter } from 'nodemailer';
import type { Env } from './env.js';
import dbPlugin, { type DrizzleDb } from './plugins/db.js';
import jwtPlugin from './plugins/jwt.js';
import redisPlugin, { type RedisClients } from './plugins/redis.js';
import { createMailTransport } from './mail/transport.js';
import healthRoute from './routes/health.js';
import authRoute from './routes/auth.js';
import relayRoute from './routes/relay.js';
import catchupRoute from './routes/catchup.js';
import syncBatchRoute from './routes/sync-batch.js';
import pushRoute from './routes/push.js';
import invitationsRoute from './routes/invitations.js';
import notificationsRoute from './routes/notifications.js';
import notificationPreferencesRoute from './routes/notification-preferences.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: DrizzleDb;
    mailTransport: Transporter;
  }
}

export interface BuildAppOverrides {
  /**
   * DB mocké pour les tests unitaires. Si fourni, skip le plugin dbPlugin
   * (pas de connexion Postgres réelle). Utiliser `{} as DrizzleDb` si les
   * routes testées n'accèdent pas à la DB.
   */
  db?: DrizzleDb;
  /** Redis mock pour les tests unitaires. Si fourni, skip le plugin redisPlugin. */
  redis?: RedisClients;
  /** Transport mail mocké pour les tests unitaires. */
  mailTransport?: Transporter;
}

export function buildApp(env: Env, overrides: BuildAppOverrides = {}): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  app.decorate('env', env);

  // Plugins transversaux
  void app.register(fastifyCors, { origin: true });
  void app.register(fastifyWebsocket);

  if (overrides.db !== undefined) {
    app.decorate('db', overrides.db);
  } else {
    void app.register(dbPlugin);
  }

  // JWT
  void app.register(jwtPlugin);

  // Redis pub/sub
  if (overrides.redis !== undefined) {
    app.decorate('redis', overrides.redis);
  } else {
    void app.register(redisPlugin);
  }

  // Mail transport
  if (overrides.mailTransport !== undefined) {
    app.decorate('mailTransport', overrides.mailTransport);
  } else {
    app.decorate('mailTransport', createMailTransport(env));
  }

  // Routes
  void app.register(healthRoute);
  void app.register(authRoute, { prefix: '/auth' });
  void app.register(relayRoute, { prefix: '/relay' });
  void app.register(catchupRoute, { prefix: '/relay' });
  void app.register(syncBatchRoute, { prefix: '/sync' });
  void app.register(pushRoute, { prefix: '/push' });
  void app.register(invitationsRoute, { prefix: '/invitations' });
  void app.register(notificationsRoute, { prefix: '/notifications' });
  void app.register(notificationPreferencesRoute);

  return app;
}
