import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

export interface RedisClients {
  pub: Redis;
  sub: Redis;
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClients;
  }
}

export default fp(async function redisPlugin(app) {
  const pub = new Redis(app.env.REDIS_URL);
  const sub = new Redis(app.env.REDIS_URL);

  pub.on('error', (err: Error) => { app.log.error({ err }, 'Redis pub connection error'); });
  sub.on('error', (err: Error) => { app.log.error({ err }, 'Redis sub connection error'); });

  app.decorate('redis', { pub, sub });

  app.addHook('onClose', async () => {
    try { await pub.quit(); } catch { pub.disconnect(); }
    try { await sub.quit(); } catch { sub.disconnect(); }
  });
});
