import fp from 'fastify-plugin';
import Redis from 'ioredis';

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

  app.decorate('redis', { pub, sub });

  app.addHook('onClose', async () => {
    await pub.quit();
    await sub.quit();
  });
});
