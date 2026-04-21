import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { mailboxMessages } from '../db/schema.js';
import { eq, and, gt, asc } from 'drizzle-orm';
import type { JwtPayload } from '../plugins/jwt.js';

const CatchupQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
});

const MAX_CATCHUP_MESSAGES = 500;

const catchupRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: z.infer<typeof CatchupQuerySchema> }>(
    '/catchup',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = CatchupQuerySchema.safeParse(request.query);
      if (!result.success) {
        return reply.status(400).send({ error: 'since doit être un entier ≥ 0' });
      }

      const { since } = result.data;
      const payload = request.user as JwtPayload;

      let rows: Array<typeof mailboxMessages.$inferSelect>;
      try {
        rows = await app.db
          .select()
          .from(mailboxMessages)
          .where(
            and(
              eq(mailboxMessages.householdId, payload.householdId),
              gt(mailboxMessages.seq, since),
            ),
          )
          .orderBy(asc(mailboxMessages.seq))
          .limit(MAX_CATCHUP_MESSAGES);
      } catch (err) {
        app.log.error({ err }, 'Erreur lecture mailboxMessages catchup');
        return reply.status(503).send({ error: 'Service temporairement indisponible' });
      }

      return reply.status(200).send({
        messages: rows.map((r) => ({
          id: r.id,
          senderDeviceId: r.senderDeviceId,
          blobJson: r.blobJson,
          seq: r.seq,
          sentAtMs: r.sentAtMs,
        })),
        hasMore: rows.length === MAX_CATCHUP_MESSAGES,
      });
    },
  );
};

export default catchupRoute;
