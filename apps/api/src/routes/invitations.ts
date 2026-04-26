import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generateInvitationToken, generatePin, hashPin, verifyPin } from '@kinhale/crypto';
import { InvitationStore } from '../invitations/store.js';

const CreateBodySchema = z.object({
  targetRole: z.enum(['contributor', 'restricted_contributor']),
  displayName: z.string().min(1).max(100),
});

/**
 * Hex 32 octets — 64 caractères [0-9a-f]. Strict pour bloquer un payload
 * arbitraire (tampon plus long, casse mixte, base64, etc.). KIN-096.
 */
const HEX_32_BYTES = /^[0-9a-f]{64}$/u;
/**
 * Hex sealed box — minimum 96 chars (48 octets de surcoût) ; on plafonne
 * à 256 chars pour borner la taille du payload échangé. La groupKey
 * légitime est de 32B → sealed = 80B → 160 hex chars.
 */
const HEX_SEALED_BOX = /^[0-9a-f]{96,512}$/u;

const AcceptBodySchema = z.object({
  pin: z.string().regex(/^\d{6}$/u, 'pin must be exactly 6 digits'),
  consentAccepted: z.literal(true),
  // KIN-096 — clé publique X25519 du device invité (32 octets, hex). Le
  // backend ne fait que la stocker côté Redis (zero-knowledge sur la clé).
  recipientPublicKeyHex: z
    .string({ required_error: 'recipientPublicKeyHex is required' })
    .regex(HEX_32_BYTES, 'recipientPublicKeyHex must be 64 hex chars'),
});

const SealBodySchema = z.object({
  // KIN-096 — `crypto_box_seal(groupKey, recipientPublicKey)` en hex.
  sealedGroupKeyHex: z
    .string()
    .regex(HEX_SEALED_BOX, 'sealedGroupKeyHex must be hex (96-512 chars)'),
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
      // consentAccepted is true but pin / recipientPublicKeyHex may be invalid
      const issue =
        result.error.issues.find((i) => i.path[0] === 'pin') ??
        result.error.issues.find((i) => i.path[0] === 'recipientPublicKeyHex');
      if (issue !== undefined) {
        return reply.status(400).send({ error: issue.message });
      }
      return reply.status(400).send({ error: 'consent_required' });
    }

    const { pin, recipientPublicKeyHex } = result.data;
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

    // KIN-096 — au lieu de consume() immédiat, on marque l'invitation comme
    // acceptée et on persiste la clé publique X25519 de l'invité. L'invitation
    // sera consommée quand l'invité aura récupéré le sealedGroupKey, OU quand
    // le TTL post-acceptance expirera.
    await store.markAccepted(token, recipientPublicKeyHex);

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

  // POST /invitations/:token/seal — admin du foyer dépose l'envelope X25519
  // (KIN-096). L'admin a effectué localement
  // `sealedBoxEncrypt(groupKey, recipientPublicKey)` ; on ne stocke que des
  // bytes opaques.
  app.post<{ Params: { token: string }; Body: unknown }>(
    '/:token/seal',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { token } = request.params;
      const user = request.user;
      const store = new InvitationStore(app.redis);

      const rec = await store.get(token);
      if (rec === null) {
        return reply.status(404).send({ error: 'not_found_or_expired' });
      }

      // Anti-IDOR : seul l'admin du foyer peut sceller (RM11). L'absence
      // de match → 404 plutôt que 403 (anti-énumération).
      if (rec.householdId !== user.householdId) {
        return reply.status(404).send({ error: 'not_found_or_expired' });
      }

      // Le scellement n'a de sens que si l'invité a accepté
      if (rec.recipientPublicKeyHex === undefined) {
        return reply.status(409).send({ error: 'invitation_not_accepted' });
      }

      const parsed = SealBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' });
      }

      await store.markSealed(token, parsed.data.sealedGroupKeyHex);
      return reply.status(204).send();
    },
  );

  // GET /invitations/:token/sealed-group-key — invité poll cet endpoint
  // après son acceptation, pour récupérer l'envelope X25519 quand l'admin
  // l'aura déposée. Authentifié implicitement par la possession du token
  // (32 octets URL-safe, équivalent à 256 bits d'entropie).
  app.get<{ Params: { token: string } }>('/:token/sealed-group-key', async (request, reply) => {
    const { token } = request.params;
    const store = new InvitationStore(app.redis);

    if (await store.isLocked(token)) {
      return reply.status(423).send({ error: 'locked' });
    }

    const rec = await store.get(token);
    if (rec === null) {
      return reply.status(404).send({ error: 'not_found_or_expired' });
    }

    if (rec.sealedGroupKeyHex === undefined || rec.recipientPublicKeyHex === undefined) {
      return reply.status(404).send({ error: 'not_sealed_yet' });
    }

    return reply.status(200).send({
      recipientPublicKeyHex: rec.recipientPublicKeyHex,
      sealedGroupKeyHex: rec.sealedGroupKeyHex,
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

  // GET /invitations — liste Admin du foyer. Inclut désormais les champs
  // recipientPublicKeyHex / sealedGroupKeyHex pour permettre à l'admin de
  // distinguer les invitations « en attente d'acceptation » des invitations
  // « en attente de finalisation » (KIN-096).
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user;
    const store = new InvitationStore(app.redis);

    const records = await store.listByHousehold(user.householdId);
    const invitations = records.map((rec) => {
      const base = {
        token: rec.token,
        targetRole: rec.targetRole,
        displayName: rec.displayName,
        createdAtMs: rec.createdAtMs,
        hasRecipientPublicKey: rec.recipientPublicKeyHex !== undefined,
        hasSealedGroupKey: rec.sealedGroupKeyHex !== undefined,
      };
      // KIN-096 — l'admin a besoin de la clé publique X25519 de l'invité
      // pour effectuer le sealing localement. La clé publique n'est pas
      // sensible (elle ne peut pas déchiffrer la groupKey, seule la clé
      // privée du device de l'invité peut). On la renvoie uniquement à
      // l'admin du foyer (route déjà household_scoped).
      if (rec.recipientPublicKeyHex !== undefined) {
        return { ...base, recipientPublicKeyHex: rec.recipientPublicKeyHex };
      }
      return base;
    });

    return reply.status(200).send({ invitations });
  });
};

export default invitationsRoute;
