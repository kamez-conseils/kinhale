import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sha256HexFromString, randomBytes } from '@kinhale/crypto';
import { magicLinks, accounts, devices } from '../db/schema.js';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { sendMagicLink } from '../mail/send-magic-link.js';

const MagicLinkBodySchema = z.object({
  email: z.string().email(),
});

const VerifyQuerySchema = z.object({
  token: z.string().min(64),
});

const RegisterDeviceBodySchema = z.object({
  publicKeyHex: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'publicKeyHex doit être une clé Ed25519 (64 hex chars)'),
});

const authRoute: FastifyPluginAsync = async (app) => {
  app.post<{ Body: z.infer<typeof MagicLinkBodySchema> }>(
    '/magic-link',
    {
      // Rate-limit serré : empêche l'énumération d'e-mails et la pollution
      // Postmark/DB. 5 requêtes / heure / IP. Cf. kz-securite AUDIT M4.
      config: { rateLimit: { max: 5, timeWindow: '1h' } },
    },
    async (request, reply) => {
      const result = MagicLinkBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: 'Email invalide' });
      }

      const { email } = result.data;
      const emailHash = await sha256HexFromString(email.toLowerCase().trim());

      const tokenBytes = await randomBytes(32);
      const token = Buffer.from(tokenBytes).toString('hex');
      const tokenHash = await sha256HexFromString(token);

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await app.db.insert(magicLinks).values({
        emailHash,
        tokenHash,
        expiresAt,
      });

      try {
        await sendMagicLink(app.mailTransport, app.env, { to: email, token });
      } catch (err) {
        // On ne bloque pas la réponse HTTP — logger l'erreur et continuer.
        // Sécurité : le token est en DB, si l'envoi échoue, l'utilisateur
        // peut redemander. On évite aussi d'exposer l'existence d'un compte.
        app.log.error({ err }, 'Échec envoi magic link (email préservé côté DB)');
      }

      return reply.status(200).send({ message: 'Magic link envoyé' });
    },
  );

  app.get<{ Querystring: z.infer<typeof VerifyQuerySchema> }>('/verify', async (request, reply) => {
    const result = VerifyQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.status(400).send({ error: 'Token manquant ou invalide' });
    }

    const { token } = result.data;
    const tokenHash = await sha256HexFromString(token);

    // UPDATE atomique : marque le lien comme utilisé si et seulement si il
    // est non-utilisé et non-expiré. Empêche la race condition entre 2
    // requêtes concurrentes (e.g. attaquant ayant intercepté le mail + victime
    // qui clique en parallèle). Cf. kz-securite AUDIT-TRANSVERSE M3.
    const consumed = await app.db
      .update(magicLinks)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(magicLinks.tokenHash, tokenHash),
          gt(magicLinks.expiresAt, new Date()),
          isNull(magicLinks.usedAt),
        ),
      )
      .returning();
    const link = consumed[0];
    if (link === undefined) {
      return reply.status(401).send({ error: 'Token invalide, expiré ou déjà utilisé' });
    }

    const accountRows = await app.db
      .select()
      .from(accounts)
      .where(eq(accounts.emailHash, link.emailHash));

    let accountId: string;
    const existingAccount = accountRows[0];
    if (existingAccount !== undefined) {
      accountId = existingAccount.id;
    } else {
      const newAccount = await app.db
        .insert(accounts)
        .values({ emailHash: link.emailHash })
        .returning();
      const created = newAccount[0];
      if (created === undefined) {
        return reply.status(500).send({ error: 'Erreur création compte' });
      }
      accountId = created.id;
    }

    const householdId = accountId;
    const deviceId = accountId;

    const accessToken = app.jwt.sign(
      { sub: accountId, deviceId, householdId, type: 'access' },
      { expiresIn: app.env.JWT_ACCESS_TTL },
    );

    return reply.status(200).send({ accessToken });
  });

  app.post<{ Body: z.infer<typeof RegisterDeviceBodySchema> }>(
    '/register-device',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const result = RegisterDeviceBodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          error: result.error.issues[0]?.message ?? 'publicKeyHex invalide',
        });
      }

      const { publicKeyHex } = result.data;
      const payload = request.user;

      const inserted = await app.db
        .insert(devices)
        .values({
          accountId: payload.sub,
          publicKeyHex,
          householdId: payload.householdId,
        })
        .onConflictDoNothing()
        .returning();

      const device = inserted[0];
      if (device === undefined) {
        // Deux cas : la clé publique existe déjà (conflict), ou erreur DB.
        // onConflictDoNothing retourne tableau vide si conflict → 409.
        return reply.status(409).send({ error: 'Device déjà enregistré pour ce compte' });
      }

      return reply.status(201).send({ deviceId: device.id });
    },
  );
};

export default authRoute;
