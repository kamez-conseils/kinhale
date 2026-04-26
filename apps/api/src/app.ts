import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
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
import quietHoursRoute from './routes/quiet-hours.js';
import auditRoute, { auditEventsListRoute } from './routes/audit.js';
import privacyRoute from './routes/privacy.js';
import accountDeletionRoute from './routes/account-deletion.js';

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
    // 8 MiB pour absorber les batches /sync/batch (plafond Zod = 100 × 64 KiB
    // = 6,4 MiB). Default Fastify = 1 MiB rejetterait les batches légitimes.
    // Cf. kz-securite AUDIT-TRANSVERSE M6.
    bodyLimit: 8 * 1024 * 1024,
  });

  app.decorate('env', env);

  // Plugins transversaux. CORS verrouillé sur l'origin officielle
  // (cf. kz-securite AUDIT-TRANSVERSE M5 : `origin: true` reflétait n'importe
  // quelle origin). Multi-origin via `ALLOWED_ORIGINS` (csv) si self-hosted.
  const allowedOriginsEnv = process.env['ALLOWED_ORIGINS'];
  const allowedOrigins =
    allowedOriginsEnv !== undefined && allowedOriginsEnv.length > 0
      ? allowedOriginsEnv.split(',').map((s) => s.trim())
      : [env.WEB_URL];
  void app.register(fastifyCors, { origin: allowedOrigins, credentials: true });
  // Rate-limit global pré-auth (60 req/min/IP) + opt-in plus serré sur les
  // routes sensibles (auth, audit). Cf. kz-securite AUDIT-TRANSVERSE M4 :
  // /auth/magic-link était exposé à l'énumération d'e-mails.
  // `skipOnError: true` : si Redis tombe, on n'effondre pas l'API — on perd
  // temporairement la protection rate-limit (fail-open conservateur, le risque
  // est temporaire et borné par la durée de l'incident infra).
  if (env.NODE_ENV !== 'test') {
    void app.register(fastifyRateLimit, {
      global: false,
      max: 60,
      timeWindow: '1m',
      skipOnError: true,
    });
  }
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
  void app.register(quietHoursRoute);
  void app.register(auditRoute, { prefix: '/audit' });
  // KIN-093 / E9-S09 — endpoint `GET /me/audit-events` enregistré sans
  // préfixe (pattern privacy/notification-preferences/quiet-hours).
  void app.register(auditEventsListRoute);
  void app.register(privacyRoute);
  void app.register(accountDeletionRoute);

  return app;
}
