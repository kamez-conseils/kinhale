import type { Transporter } from 'nodemailer';
import type { Env } from '../env.js';

/**
 * E-mail T0 envoyé après confirmation step-up (E9-S04) — informe que la
 * suppression est planifiée et propose un lien d'annulation valable 7 j.
 *
 * **Zero-knowledge** : aucun contenu santé, aucun prénom enfant. Seuls
 * le timestamp prévu de purge et un lien d'annulation porteur d'un token
 * opaque sont exposés.
 *
 * Refs: KIN-086, E9-S04.
 */
export interface DeletionScheduledParams {
  to: string;
  /** ISO 8601 UTC de la purge prévue (J+7). */
  scheduledAtIso: string;
  /** Token signé pour l'annulation depuis l'e-mail. */
  cancelToken: string;
}

export async function sendDeletionScheduled(
  transport: Transporter,
  env: Env,
  params: DeletionScheduledParams,
): Promise<void> {
  const cancelUrl = `${env.WEB_URL}/account/deletion-cancel?token=${params.cancelToken}`;

  const text = `Bonjour,

Votre demande de suppression du foyer Kinhale est confirmée.

Date de purge prévue : ${params.scheduledAtIso}

Vous pouvez annuler à tout moment pendant les 7 prochains jours en cliquant sur ce lien :

${cancelUrl}

Passé ce délai, vos données seront effacées de manière définitive et ne pourront plus être récupérées.

—
L'équipe Kinhale
https://kinhale.health


[EN] Your Kinhale household deletion has been confirmed. Scheduled purge: ${params.scheduledAtIso}. You can cancel anytime within the next 7 days using the link above. After that, your data will be permanently erased.`;

  const html = `<p>Bonjour,</p>
<p>Votre demande de suppression du foyer Kinhale est confirmée.</p>
<p><strong>Date de purge prévue :</strong> ${params.scheduledAtIso}</p>
<p>Vous pouvez annuler à tout moment pendant les 7 prochains jours :</p>
<p><a href="${cancelUrl}">${cancelUrl}</a></p>
<p style="color:#666;font-size:14px">Passé ce délai, vos données seront effacées de manière définitive et ne pourront plus être récupérées.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#666;font-size:14px">[EN] Your Kinhale household deletion has been confirmed. Scheduled purge: <strong>${params.scheduledAtIso}</strong>. You can cancel anytime within the next 7 days using the link above. After that, your data will be permanently erased.</p>
<p style="color:#999;font-size:12px">— L'équipe Kinhale · <a href="https://kinhale.health">kinhale.health</a></p>`;

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: params.to,
    subject: 'Suppression Kinhale planifiée / Kinhale deletion scheduled',
    text,
    html,
  });
}
