import type { Transporter } from 'nodemailer';
import type { Env } from '../env.js';

/**
 * E-mail envoyé lors de l'annulation d'une suppression pendant la
 * période de grâce (E9-S04). Confirme que le compte est de nouveau
 * `active`.
 *
 * **Zero-knowledge** : aucun contenu santé. Ce mail rassure l'utilisateur
 * sur le succès de l'annulation.
 *
 * Refs: KIN-086, E9-S04.
 */
export interface DeletionCancelledParams {
  to: string;
}

export async function sendDeletionCancelled(
  transport: Transporter,
  env: Env,
  params: DeletionCancelledParams,
): Promise<void> {
  const text = `Bonjour,

La suppression de votre foyer Kinhale a été annulée. Votre compte reste actif et toutes vos données sont préservées.

Si vous changez d'avis à l'avenir, vous pourrez relancer la procédure depuis Paramètres → Confidentialité.

—
L'équipe Kinhale
https://kinhale.health


[EN] Your Kinhale household deletion has been cancelled. Your account remains active and all your data is preserved. If you change your mind, you can restart the process from Settings → Privacy.`;

  const html = `<p>Bonjour,</p>
<p>La suppression de votre foyer Kinhale a été annulée. Votre compte reste actif et toutes vos données sont préservées.</p>
<p style="color:#666;font-size:14px">Si vous changez d'avis à l'avenir, vous pourrez relancer la procédure depuis Paramètres → Confidentialité.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#666;font-size:14px">[EN] Your Kinhale household deletion has been cancelled. Your account remains active and all your data is preserved. If you change your mind, you can restart the process from Settings → Privacy.</p>
<p style="color:#999;font-size:12px">— L'équipe Kinhale · <a href="https://kinhale.health">kinhale.health</a></p>`;

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: params.to,
    subject: 'Suppression Kinhale annulée / Kinhale deletion cancelled',
    text,
    html,
  });
}
