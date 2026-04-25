/**
 * Endpoints du flux de suppression de compte avec période de grâce 7 jours
 * (KIN-086, E9-S03 + E9-S04, W10, RM10).
 *
 * Étapes :
 * 1. `POST /me/account/deletion-request` — JWT requis. Génère un token
 *    step-up (TTL 5 min, scope `account_deletion`) et envoie un e-mail
 *    magic link spécifique. Réponse 202 Accepted (asynchrone).
 * 2. `POST /me/account/deletion-confirm` — Sans JWT (le token suffit).
 *    Consomme le token (anti-replay), bascule
 *    `accounts.deletion_status='pending_deletion'`,
 *    `deletion_scheduled_at_ms = now + 7j`. Insère audit
 *    `account_deletion_requested`. Envoie e-mail T0.
 * 3. `POST /me/account/deletion-cancel` — JWT requis (même scenario où
 *    l'utilisateur a été dégradé, son JWT reste valide jusqu'à expiration
 *    naturelle). Si statut != `pending_deletion` → 409. Si l'échéance
 *    est dépassée → 410 Gone. Sinon repasse en `active`.
 * 4. `GET /me/account/deletion-status` — JWT requis. Retourne
 *    `{status, scheduledAtMs?}` pour l'UI.
 *
 * **Authz `admin`** : v1.0 single-admin-per-household (cf. auth.ts L105
 * où `householdId === accountId === deviceId`). Le `sub` du JWT est par
 * construction l'admin de son foyer. Si l'archi évolue vers multi-admin
 * (cf. W11 transfert d'admin), il faudra ajouter une vérification
 * explicite de rôle ici.
 *
 * **Step-up auth** : le token magic link envoyé dans l'e-mail T0 est la
 * seule preuve d'intention de suppression. Hashé en DB, TTL 5 min,
 * usage unique. C'est le pattern de step-up adopté pour v1.0 (TOTP /
 * passkey reportés à v1.1).
 *
 * Refs: KIN-086, E9-S03, E9-S04, W10, RM10, NIST SP 800-63B § 5.1.1.2.
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { sha256HexFromString, randomBytes } from '@kinhale/crypto';
import { accounts, accountDeletionStepUpTokens, auditEvents } from '../db/schema.js';
import type { SessionJwtPayload } from '../plugins/jwt.js';
import { sendDeletionStepUp } from '../mail/send-deletion-step-up.js';
// `send-deletion-scheduled.ts` et `send-deletion-cancelled.ts` ne sont
// **pas** importés ici : leur envoi nécessite l'adresse e-mail en clair,
// non disponible côté serveur (zero-knowledge — `accounts.email_hash`
// est un SHA-256). Le tracking de l'adresse en clair par la session
// step-up sera ajouté en KIN-086-FU. Voir AC E9-S03 dans
// `docs/runbooks/account-deletion.md` § « Issues de suivi ».

/** TTL du token step-up auth — 5 minutes (NIST SP 800-63B § 5.1.1.2). */
export const STEP_UP_TOKEN_TTL_MINUTES = 5;
const STEP_UP_TOKEN_TTL_MS = STEP_UP_TOKEN_TTL_MINUTES * 60 * 1000;

/** Période de grâce avant purge effective — 7 jours (story W10). */
export const GRACE_PERIOD_DAYS = 7;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Rate-limit `/me/account/deletion-request` — par device, pour éviter
 * qu'un device compromis ne sature la boîte mail de la victime ni le
 * quota Postmark. 5 / heure est confortable pour un usage normal (un
 * utilisateur ne déclenche cette action qu'occasionnellement).
 *
 * Pattern Redis identique aux autres routes sensibles (`audit.ts`,
 * `privacy.ts`).
 */
const DELETION_REQUEST_MAX_PER_HOUR = 5;
const DELETION_REQUEST_WINDOW_SECONDS = 3600;
const deletionRequestRateLimitKey = (deviceId: string): string => `rl:deletion-request:${deviceId}`;

/**
 * Body strict de `POST /me/account/deletion-request`.
 *
 * Le mot de confirmation accepte les deux locales (FR `SUPPRIMER`, EN
 * `DELETE`) — l'UI affiche celui qui correspond à la langue.
 *
 * `.strict()` rejette tout champ supplémentaire (défense en profondeur :
 * un client compromis ne peut pas forcer un état inconnu).
 */
const DeletionRequestBody = z
  .object({
    confirmationWord: z.enum(['SUPPRIMER', 'DELETE']),
    /** Adresse e-mail du compte — vérifiée contre `accounts.email_hash`. */
    email: z.string().email(),
  })
  .strict();

const DeletionConfirmBody = z
  .object({
    token: z.string().regex(/^[0-9a-f]{64}$/, 'invalid_token'),
  })
  .strict();

const accountDeletionRoute: FastifyPluginAsync = async (app) => {
  /**
   * POST /me/account/deletion-request
   *
   * Authz : JWT valide (le compte ne doit pas déjà être en
   * `pending_deletion` — sinon 409). Génère un token step-up et l'envoie
   * par e-mail. Réponse 202 même si l'envoi e-mail échoue (ne pas leak
   * l'existence d'un compte par timing différentiel).
   *
   * **Pourquoi exiger l'email dans le body** : on vérifie que la personne
   * qui clique sur "Supprimer" connaît bien l'adresse du compte (en plus
   * du JWT). C'est un facteur supplémentaire pour limiter l'usage par
   * un device volé déverrouillé (l'adresse n'est pas affichée en UI).
   */
  app.post(
    '/me/account/deletion-request',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parse = DeletionRequestBody.safeParse(request.body);
      if (!parse.success) {
        return reply.status(400).send({ error: 'invalid_body' });
      }

      const { sub: accountId, deviceId } = request.user as SessionJwtPayload;

      // Rate-limit Redis par device (anti-spam mail, anti-bruteforce email).
      const rlKey = deletionRequestRateLimitKey(deviceId);
      const counter = await app.redis.pub.incr(rlKey);
      if (counter === 1) {
        await app.redis.pub.expire(rlKey, DELETION_REQUEST_WINDOW_SECONDS);
      }
      if (counter > DELETION_REQUEST_MAX_PER_HOUR) {
        app.log.warn(
          { event: 'deletion_request.rate_limited', deviceId },
          'Rate-limit atteint sur /me/account/deletion-request',
        );
        return reply.status(429).send({ error: 'rate_limited' });
      }

      // Vérifier que l'email fourni correspond au compte (défense
      // anti-CSRF / device volé déverrouillé).
      const emailHash = await sha256HexFromString(parse.data.email.toLowerCase().trim());
      const accountRows = await app.db
        .select({
          id: accounts.id,
          emailHash: accounts.emailHash,
          deletionStatus: accounts.deletionStatus,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId));
      const account = accountRows[0];
      if (account === undefined || account.emailHash !== emailHash) {
        // Ne pas distinguer "compte introuvable" de "email mismatch" —
        // ne pas leaker si l'accountId existe ou si l'email matche.
        return reply.status(400).send({ error: 'invalid_credentials' });
      }

      if (account.deletionStatus !== 'active') {
        return reply.status(409).send({ error: 'already_pending' });
      }

      // Génération du token step-up (32 bytes random hex = 64 chars).
      const tokenBytes = await randomBytes(32);
      const token = Buffer.from(tokenBytes).toString('hex');
      const tokenHash = await sha256HexFromString(token);
      const expiresAt = new Date(Date.now() + STEP_UP_TOKEN_TTL_MS);

      // Invalide tous les tokens encore valides du compte avant d'en
      // émettre un nouveau (anti-replay réémission). Si l'utilisateur
      // re-clique sur un ancien lien plus tard, il aura `usedAt !== null`
      // et sera rejeté en 401.
      await app.db.transaction(async (tx) => {
        await tx
          .update(accountDeletionStepUpTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(accountDeletionStepUpTokens.accountId, accountId),
              isNull(accountDeletionStepUpTokens.usedAt),
            ),
          );
        await tx.insert(accountDeletionStepUpTokens).values({
          accountId,
          tokenHash,
          expiresAt,
        });
      });

      try {
        await sendDeletionStepUp(app.mailTransport, app.env, {
          to: parse.data.email,
          token,
          ttlMinutes: STEP_UP_TOKEN_TTL_MINUTES,
        });
      } catch (err) {
        // Pattern auth.ts : on ne bloque pas la réponse, on log
        // (pas d'accountId en clair).
        app.log.error(
          { event: 'deletion_request.mail_failed', err: err instanceof Error ? err.message : '?' },
          'Échec envoi e-mail step-up suppression',
        );
      }

      return reply.status(202).send({ ok: true });
    },
  );

  /**
   * POST /me/account/deletion-confirm
   *
   * **Pas de JWT requis** : le token step-up est porteur d'authentification.
   * On vérifie uniquement :
   * - Le hash du token existe en DB.
   * - `expires_at > now`.
   * - `used_at IS NULL` (anti-replay).
   *
   * À la consommation : on marque `used_at` ET on bascule l'état du
   * compte dans **la même transaction** pour garantir atomicité.
   */
  app.post('/me/account/deletion-confirm', async (request, reply) => {
    const parse = DeletionConfirmBody.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'invalid_body' });
    }

    const tokenHash = await sha256HexFromString(parse.data.token);
    const now = new Date();

    // Sélectionne le token + le compte en une transaction pour garantir
    // que le token n'est consommé qu'une fois.
    const result = await app.db.transaction(async (tx) => {
      const tokenRows = await tx
        .select({
          id: accountDeletionStepUpTokens.id,
          accountId: accountDeletionStepUpTokens.accountId,
          usedAt: accountDeletionStepUpTokens.usedAt,
          expiresAt: accountDeletionStepUpTokens.expiresAt,
        })
        .from(accountDeletionStepUpTokens)
        .where(
          and(
            eq(accountDeletionStepUpTokens.tokenHash, tokenHash),
            gt(accountDeletionStepUpTokens.expiresAt, now),
          ),
        );
      const tk = tokenRows[0];
      if (tk === undefined) {
        return { ok: false as const, status: 401, code: 'invalid_or_expired_token' };
      }
      if (tk.usedAt !== null) {
        return { ok: false as const, status: 401, code: 'token_already_used' };
      }

      // Marque le token consommé.
      await tx
        .update(accountDeletionStepUpTokens)
        .set({ usedAt: now })
        .where(eq(accountDeletionStepUpTokens.id, tk.id));

      const scheduledAtMs = now.getTime() + GRACE_PERIOD_MS;

      // Bascule du compte vers pending_deletion.
      const updated = await tx
        .update(accounts)
        .set({
          deletionStatus: 'pending_deletion',
          deletionScheduledAtMs: scheduledAtMs,
        })
        .where(and(eq(accounts.id, tk.accountId), eq(accounts.deletionStatus, 'active')))
        .returning({ id: accounts.id, emailHash: accounts.emailHash });
      const acc = updated[0];
      if (acc === undefined) {
        // Compte déjà en pending ou supprimé — comportement defensif.
        return { ok: false as const, status: 409, code: 'account_not_active' };
      }

      // Audit `account_deletion_requested` — RM10 / SPECS §3.11.
      await tx.insert(auditEvents).values({
        accountId: tk.accountId,
        eventType: 'account_deletion_requested',
        eventData: { scheduledAtMs },
      });

      return {
        ok: true as const,
        accountId: tk.accountId,
        scheduledAtMs,
      };
    });

    if (!result.ok) {
      return reply.status(result.status).send({ error: result.code });
    }

    // ⚠️ DÉCISION KIN-086 : pas d'e-mail T0 séparé depuis ce flow pour
    // rester zero-knowledge (l'adresse en clair n'est pas accessible —
    // `email_hash` est irréversible). L'utilisateur a déjà reçu l'e-mail
    // step-up qui mentionnait la période de grâce 7 j ; l'UI redirige
    // ensuite vers Settings → Privacy avec le bouton « Annuler ».
    // L'envoi de mail T0/J+7 sera réintroduit en KIN-086-FU si on accepte
    // de stocker l'adresse en clair temporairement (chiffrée pepper).

    // Audit + log structuré non-leaky.
    app.log.info(
      {
        event: 'deletion_confirm.ok',
        scheduledAtMs: result.scheduledAtMs,
      },
      'Suppression confirmée — période de grâce démarrée',
    );

    return reply.status(200).send({
      ok: true,
      scheduledAtMs: result.scheduledAtMs,
    });
  });

  /**
   * POST /me/account/deletion-cancel
   *
   * Annule la suppression pendant la période de grâce. JWT requis (le
   * compte est encore physiquement là — c'est le but de la grâce).
   *
   * Codes :
   * - 409 si statut != `pending_deletion` (rien à annuler).
   * - 410 si l'échéance est passée (le compte sera purgé au prochain
   *   tick — on ne peut plus annuler).
   * - 200 sinon, repasse `active`, `scheduled_at_ms = NULL`.
   *
   * **Pas de step-up auth** : annuler est une action restauratrice, pas
   * destructive. Le JWT seul suffit. Pattern symétrique aux endpoints
   * de désactivation de notification.
   */
  app.post(
    '/me/account/deletion-cancel',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { sub: accountId } = request.user as SessionJwtPayload;

      const accountRows = await app.db
        .select({
          id: accounts.id,
          deletionStatus: accounts.deletionStatus,
          deletionScheduledAtMs: accounts.deletionScheduledAtMs,
          emailHash: accounts.emailHash,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId));
      const account = accountRows[0];
      if (account === undefined) {
        return reply.status(404).send({ error: 'account_not_found' });
      }

      if (account.deletionStatus !== 'pending_deletion') {
        return reply.status(409).send({ error: 'not_pending' });
      }

      const now = Date.now();
      if (account.deletionScheduledAtMs !== null && account.deletionScheduledAtMs <= now) {
        // Échéance dépassée — le worker va purger au prochain tick. On
        // ne peut plus annuler.
        return reply.status(410).send({ error: 'grace_period_expired' });
      }

      await app.db.transaction(async (tx) => {
        await tx
          .update(accounts)
          .set({
            deletionStatus: 'active',
            deletionScheduledAtMs: null,
          })
          .where(eq(accounts.id, accountId));

        await tx.insert(auditEvents).values({
          accountId,
          eventType: 'account_deletion_cancelled',
          eventData: { cancelledAtMs: now },
        });
      });

      app.log.info(
        { event: 'deletion_cancel.ok' },
        'Suppression annulée — compte de nouveau actif',
      );

      // ⚠️ DÉCISION KIN-086 : pas d'e-mail de confirmation annulation —
      // même contrainte zero-knowledge que pour deletion-confirm.
      // L'utilisateur reçoit la confirmation visuelle dans l'UI.

      return reply.status(200).send({ ok: true });
    },
  );

  /**
   * GET /me/account/deletion-status
   *
   * Renvoie `{status, scheduledAtMs?}` pour permettre à l'UI de :
   * - afficher un bandeau « Suppression prévue le X » si pending.
   * - afficher le bouton « Annuler » si pending.
   */
  app.get(
    '/me/account/deletion-status',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { sub: accountId } = request.user as SessionJwtPayload;

      const accountRows = await app.db
        .select({
          deletionStatus: accounts.deletionStatus,
          deletionScheduledAtMs: accounts.deletionScheduledAtMs,
        })
        .from(accounts)
        .where(eq(accounts.id, accountId));
      const account = accountRows[0];
      if (account === undefined) {
        return reply.status(404).send({ error: 'account_not_found' });
      }

      return reply.status(200).send({
        status: account.deletionStatus,
        scheduledAtMs: account.deletionScheduledAtMs,
      });
    },
  );
};

export default accountDeletionRoute;
