import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pushTokens } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { JwtPayload } from '../plugins/jwt.js';

const RegisterBody = z.object({
  pushToken: z.string().min(1),
});

const pushRoute: FastifyPluginAsync = async (app) => {
  app.post(
    '/register-token',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parse = RegisterBody.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: 'pushToken requis' });
      }
      const { deviceId, householdId } = request.user as JwtPayload;
      const { pushToken } = parse.data;
      await app.db
        .insert(pushTokens)
        .values({ deviceId, householdId, token: pushToken })
        .onConflictDoNothing();
      return reply.status(201).send();
    },
  );

  app.delete(
    '/register-token',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parse = RegisterBody.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: 'pushToken requis' });
      }
      const { deviceId } = request.user as JwtPayload;
      const { pushToken } = parse.data;
      await app.db
        .delete(pushTokens)
        .where(and(eq(pushTokens.deviceId, deviceId), eq(pushTokens.token, pushToken)));
      return reply.status(204).send();
    },
  );
};

export default pushRoute;
