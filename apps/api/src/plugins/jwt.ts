import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyRequest, FastifyReply } from 'fastify';

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
  });
});
