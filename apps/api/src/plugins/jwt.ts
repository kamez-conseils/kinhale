import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { accounts } from '../db/schema.js';

/**
 * Routes autorisées même sur un compte `pending_deletion` : statut + cancel
 * (pour permettre à l'aidant de revenir sur sa décision pendant la grâce 7j).
 */
const ALLOWED_DURING_DELETION_GRACE = new Set<string>([
  'GET /me/account/deletion-status',
  'POST /me/account/deletion-cancel',
]);

/**
 * Payload JWT pour les sessions utilisateur classiques (access / refresh).
 * Porte les identifiants nécessaires à l'autorisation côté relais.
 */
export interface SessionJwtPayload {
  sub: string; // accountId
  deviceId: string;
  householdId: string;
  type: 'access' | 'refresh';
}

/**
 * Payload JWT pour le lien d'ouverture de l'e-mail fallback `missed_dose`.
 * Volontairement **opaque** : aucun identifiant métier (sub / deviceId /
 * householdId) pour préserver la zero-knowledge en cas de fuite du lien.
 *
 * Refs: KIN-079, CLAUDE.md "À ne jamais faire" (tokens courts & signés).
 */
export interface MissedDoseOpenJwtPayload {
  type: 'missed_dose_open';
  jti: string;
}

/**
 * Union discriminée de tous les payloads JWT signés par le relais. Permet
 * aux routes de typer strictement `app.jwt.sign` sans cast `as unknown as`.
 */
export type JwtPayload = SessionJwtPayload | MissedDoseOpenJwtPayload;

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    // Les middlewares d'authentification (`authenticate`) ne consomment que
    // les sessions user ; les autres types sont vérifiés par leurs routes
    // dédiées via `app.jwt.verify<T>(…)`.
    user: SessionJwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function jwtPlugin(app) {
  await app.register(fastifyJwt, {
    secret: app.env.JWT_SECRET,
  });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ code: 'UNAUTHENTICATED' });
    }

    // Refuse les comptes en `pending_deletion` sur toutes les routes sauf
    // la consultation du statut et l'annulation de la suppression. Cohérent
    // E9-S03/S04 : pendant la grâce 7j, l'aidant peut décider d'annuler
    // mais ne doit plus produire de données métier sur le relais.
    // Cf. kz-securite AUDIT-TRANSVERSE M1.
    const routeKey = `${request.method} ${request.routeOptions.url}`;
    if (ALLOWED_DURING_DELETION_GRACE.has(routeKey)) return;

    const user = request.user as SessionJwtPayload | undefined;
    if (user === undefined || user.type !== 'access') return;

    try {
      const rows = await app.db
        .select({ deletionStatus: accounts.deletionStatus })
        .from(accounts)
        .where(eq(accounts.id, user.sub))
        .limit(1);
      const status = rows[0]?.deletionStatus;
      if (status === 'pending_deletion') {
        return reply.status(403).send({ code: 'ACCOUNT_PENDING_DELETION' });
      }
    } catch (err) {
      // Fail-open conservateur : si la lookup DB échoue (incident infra ou
      // mock test partiel), on n'effondre pas l'API. Le pire cas est qu'un
      // compte pending_deletion continue brièvement à utiliser l'API — borné
      // par la durée de l'incident DB. Logger pour détecter.
      app.log.warn({ err }, 'authenticate: lookup deletionStatus échouée');
    }
  });
});
