import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generateInvitationToken, generatePin, hashPin, verifyPin } from '@kinhale/crypto';
import { InvitationStore } from '../invitations/store.js';

const CreateBodySchema = z.object({
  targetRole: z.enum(['contributor', 'restricted_contributor']),
  displayName: z.string().min(1).max(100),
});

const AcceptBodySchema = z.object({
  pin: z.string().regex(/^\d{6}$/u, 'pin must be exactly 6 digits'),
  consentAccepted: z.literal(true),
});

const invitationsRoute: FastifyPluginAsync = async (app) => {
  // POST /invitations — création (Admin)
  app.post<{ Body: z.infer<typeof CreateBodySchema> }>(
    '/',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = CreateBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: result.error.issues[0]?.message ?? 'Invalid body' });
      }

      const { targetRole, displayName } = result.data;
      const user = request.user;
      const store = new InvitationStore(app.redis);

      // RM21 : quota 10 invitations actives max
      const active = await store.countActive(user.householdId);
      if (active >= 10) {
        return reply.status(429).send({ error: 'invitation_quota_exceeded' });
      }

      const token = await generateInvitationToken();
      const pin = await generatePin();
      const pinHash = await hashPin(pin);
      const createdAtMs = Date.now();
      const expiresAtMs = createdAtMs + 600_000;

      await store.create({
        token,
        householdId: user.householdId,
        createdByUserId: user.sub,
        targetRole,
        displayName,
        pinHash,
        pinAttempts: 0,
        createdAtMs,
      });

      // PIN returned ONLY here, never again
      return reply.status(201).send({ token, pin, expiresAtMs, targetRole });
    },
  );

  // GET /invitations/:token — lookup public (aidant cible)
  app.get<{ Params: { token: string } }>('/:token', async (request, reply) => {
    const { token } = request.params;
    const store = new InvitationStore(app.redis);

    if (await store.isLocked(token)) {
      return reply.status(423).send({ error: 'locked' });
    }

    const rec = await store.get(token);
    if (rec === null) {
      return reply.status(404).send({ error: 'not_found_or_expired' });
    }

    return reply.status(200).send({ targetRole: rec.targetRole, displayName: rec.displayName });
  });

  // POST /invitations/:token/accept — acceptation aidant (public)
  app.post<{
    Params: { token: string };
    Body: unknown;
  }>('/:token/accept', async (request, reply) => {
    // Check consentAccepted before everything else (RM22)
    const bodyRaw = request.body as Record<string, unknown> | null | undefined;
    if (bodyRaw?.['consentAccepted'] !== true) {
      return reply.status(400).send({ error: 'consent_required' });
    }

    const result = AcceptBodySchema.safeParse(request.body);
    if (!result.success) {
      // consentAccepted is true but pin may be invalid
      const issue = result.error.issues.find((i) => i.path[0] === 'pin');
      if (issue !== undefined) {
        return reply.status(400).send({ error: issue.message });
      }
      return reply.status(400).send({ error: 'consent_required' });
    }

    const { pin } = result.data;
    const { token } = request.params;
    const store = new InvitationStore(app.redis);

    if (await store.isLocked(token)) {
      return reply.status(423).send({ error: 'locked' });
    }

    const rec = await store.get(token);
    if (rec === null) {
      return reply.status(404).send({ error: 'not_found_or_expired' });
    }

    const pinOk = await verifyPin(pin, rec.pinHash);
    if (!pinOk) {
      const attempts = await store.incrementPinAttempts(token);
      if (attempts >= 3) {
        await store.lock(token);
        return reply.status(423).send({ error: 'locked' });
      }
      return reply.status(401).send({ error: 'pin_mismatch' });
    }

    await store.consume(token);

    // TTL varies by role: restricted_contributor → 8h, contributor → 30d
    const expiresIn = rec.targetRole === 'contributor' ? '30d' : '8h';
    const sessionToken = app.jwt.sign(
      {
        sub: `caregiver:${token.slice(0, 8)}`,
        deviceId: '',
        householdId: rec.householdId,
        type: 'access',
      },
      { expiresIn },
    );

    return reply.status(200).send({
      sessionToken,
      targetRole: rec.targetRole,
      displayName: rec.displayName,
    });
  });

  // DELETE /invitations/:token — révocation Admin
  app.delete<{ Params: { token: string } }>(
    '/:token',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { token } = request.params;
      const user = request.user;
      const store = new InvitationStore(app.redis);

      const rec = await store.get(token);
      if (rec === null || rec.householdId !== user.householdId) {
        return reply.status(404).send({ error: 'not_found_or_expired' });
      }

      await store.consume(token);
      return reply.status(204).send();
    },
  );

  // GET /invitations — liste Admin du foyer
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user;
    const store = new InvitationStore(app.redis);

    const tokens = await app.redis.pub.smembers(`inv:hh:${user.householdId}`);
    const invitations = (
      await Promise.all(
        tokens.map(async (tok) => {
          const rec = await store.get(tok);
          if (rec === null) return null;
          return {
            token: rec.token,
            targetRole: rec.targetRole,
            displayName: rec.displayName,
            createdAtMs: rec.createdAtMs,
          };
        }),
      )
    ).filter((inv): inv is NonNullable<typeof inv> => inv !== null);

    return reply.status(200).send({ invitations });
  });
};

export default invitationsRoute;
