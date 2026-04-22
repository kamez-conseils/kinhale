import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import type { Env } from './env.js';
import dbPlugin, { type DrizzleDb } from './plugins/db.js';
import jwtPlugin from './plugins/jwt.js';
import redisPlugin, { type RedisClients } from './plugins/redis.js';
import healthRoute from './routes/health.js';
import authRoute from './routes/auth.js';
import relayRoute from './routes/relay.js';
import catchupRoute from './routes/catchup.js';
import pushRoute from './routes/push.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: DrizzleDb;
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

  // Routes
  void app.register(healthRoute);
  void app.register(authRoute, { prefix: '/auth' });
  void app.register(relayRoute, { prefix: '/relay' });
  void app.register(catchupRoute, { prefix: '/relay' });
  void app.register(pushRoute, { prefix: '/push' });

  return app;
}
