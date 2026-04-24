import type { FastifyPluginAsync } from 'fastify';
import { randomBytes, toHex } from '@kinhale/crypto';
import { z } from 'zod';
import { sendMissedDoseEmail } from '../mail/send-missed-dose-email.js';

/**
 * Format du `reminderId` opaque projeté côté client (cf.
 * `packages/sync/src/projections/reminders.ts`) : `r:<base36>:<iso>`.
 * La route n'exploite pas le reminderId (le relais reste zero-knowledge) ;
 * il sert uniquement de corrélation pour les logs pseudonymisés — d'où la
 * validation stricte pour éviter qu'un client malicieux ne smuggle un prénom
 * ou un texte arbitraire via ce champ.
 */
const REMINDER_ID_RE = /^r:[a-z0-9]{1,64}:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const MissedDoseEmailBody = z.object({
  /**
   * E-mail destinataire, en clair. **Non stocké** côté relais — utilisé pour
   * routage puis jeté (même pattern que `sendMagicLink`). La zero-knowledge
   * est préservée : l'association email↔household n'est jamais persistée.
   */
  email: z.string().email(),
  /** Langue du corps. Défaut FR. */
  locale: z.enum(['fr', 'en']).optional(),
  /**
   * Id opaque du rappel manqué (format `r:<base36>:<iso>`). Utilisé seulement
   * pour corréler les logs pseudonymisés ; n'apparaît **pas** dans l'e-mail.
   */
  reminderId: z.string().regex(REMINDER_ID_RE).optional(),
});

/**
 * Durée de vie du token signé inclus dans l'URL de l'e-mail fallback.
 *
 * Cible : assez long pour qu'un aidant l'ouvre après une nuit courte (un
 * parent reçoit l'e-mail à T+X+30 min, peut dormir jusqu'au matin), assez
 * court pour limiter la fenêtre d'exploitation si l'e-mail fuite (re-transfert
 * accidentel, poste partagé en garderie). 2 h est le compromis : couvre une
 * nuit standard si l'envoi a lieu vers 22 h → 00 h, et les rappels de jour
 * sont consultés rapidement.
 *
 * Refs: KIN-079, CLAUDE.md "À ne jamais faire" (tokens courts & signés).
 */
const MISSED_DOSE_OPEN_TOKEN_TTL = '2h';

/**
 * Taille (en octets) du `jti` aléatoire encodé en hex. 16 octets → 32 chars
 * hex → ~128 bits d'entropie, largement suffisant pour garantir l'unicité
 * probabiliste (collision <2⁻⁶⁴ à l'échelle de 2³² tokens).
 */
const JTI_BYTES = 16;

/**
 * Rate-limit sur l'envoi d'e-mails fallback `missed_dose`.
 *
 * Motivation : la route est authentifiée par JWT mais ne valide pas que
 * l'e-mail fourni appartient au foyer (zero-knowledge — le relais ne connaît
 * pas cette association). Un device compromis pourrait donc transformer le
 * relais en open-spam ou saturer la réputation du domaine expéditeur.
 *
 * Stratégie : compteur Redis par `deviceId` extrait du JWT d'accès, fenêtre
 * glissante de 1 h. Au-delà de `MISSED_DOSE_EMAIL_MAX_PER_HOUR` envois, la
 * route renvoie 429. Pattern inspiré d'`InvitationStore.incrementPinAttempts`
 * (même plugin Redis, même TTL-on-first-increment).
 *
 * Refs: KIN-079 (M2 kz-review), E5-S09 (quota anti-spam général).
 */
const MISSED_DOSE_EMAIL_MAX_PER_HOUR = 5;
const MISSED_DOSE_EMAIL_WINDOW_SECONDS = 3600;

const rateLimitKey = (deviceId: string): string => `rl:missed-dose-email:${deviceId}`;

const notificationsRoute: FastifyPluginAsync = async (app) => {
  app.post('/missed-dose-email', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = MissedDoseEmailBody.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'Paramètres invalides' });
    }

    const { email, locale, reminderId } = parse.data;
    // `authenticate` garantit que seul un JWT de type `access`/`refresh`
    // peut atteindre ce handler, donc `user.deviceId` est toujours présent.
    const { deviceId } = request.user;

    // Rate-limit : INCR + EXPIRE (pattern idiomatique Redis ; race condition
    // négligeable — une collision perdue d'EXPIRE laisse au pire la clé
    // vivre jusqu'au prochain INCR dans la fenêtre suivante).
    const key = rateLimitKey(deviceId);
    const count = await app.redis.pub.incr(key);
    if (count === 1) {
      await app.redis.pub.expire(key, MISSED_DOSE_EMAIL_WINDOW_SECONDS);
    }
    if (count > MISSED_DOSE_EMAIL_MAX_PER_HOUR) {
      // 429 sans détailler le compteur : ne pas leak la politique exacte.
      // Log structurel pour détecter un device qui tape le plafond (signal
      // potentiel d'un client buggé ou d'une compromission).
      app.log.warn(
        { event: 'missed_dose_email.rate_limited', deviceId },
        'Rate-limit atteint sur missed-dose-email',
      );
      return reply.status(429).send({ error: 'rate_limited' });
    }

    // Génère un token signé **opaque** — aucun id métier (pas de sub, pas
    // de deviceId, pas de householdId). Le lien dans l'e-mail ne doit pas
    // être exploitable pour inférer un foyer à partir d'un e-mail fuité.
    // Le typage JWT (`plugins/jwt.ts`) expose maintenant une union
    // discriminée qui accepte `missed_dose_open` → plus de cast nécessaire.
    const jtiBytes = await randomBytes(JTI_BYTES);
    const jti = toHex(jtiBytes);
    const openToken = app.jwt.sign(
      { type: 'missed_dose_open', jti },
      { expiresIn: MISSED_DOSE_OPEN_TOKEN_TTL },
    );

    try {
      await sendMissedDoseEmail(app.mailTransport, app.env, {
        to: email,
        openToken,
        ...(locale !== undefined ? { locale } : {}),
      });
    } catch (err) {
      // Best-effort : on ne bloque pas la 202 ; même pattern que sendMagicLink.
      // Logue **pseudonymisé** : ni email, ni token, ni reminderId — juste
      // l'erreur technique. Le reminderId (opaque) est optionnellement utile
      // pour corréler avec la télémétrie client ; il ne contient pas de
      // donnée santé de par son format, mais on s'abstient par précaution.
      app.log.warn({ err }, 'Échec envoi e-mail fallback missed_dose (best-effort)');
    }

    // Log structurel de succès : on indique juste qu'une tentative a été
    // faite, sans l'e-mail ni le token. Le reminderId (si présent) est
    // opaque — on le log pour corrélation inter-services (Sentry) mais il
    // n'est pas une donnée santé.
    app.log.info(
      { event: 'missed_dose_email.dispatched', hasReminderId: reminderId !== undefined },
      'E-mail fallback missed_dose dispatché',
    );

    return reply.status(202).send({ status: 'queued' });
  });
};

export default notificationsRoute;
