import type { Transporter } from 'nodemailer';
import type { Env } from '../env.js';

/**
 * E-mail de step-up auth pour la confirmation de suppression de compte
 * (E9-S03 / RM10).
 *
 * **Pourquoi un e-mail séparé du magic link de connexion** :
 * - Le scope est différent (`account_deletion` vs login).
 * - Le TTL est volontairement plus court (5 min vs 10 min) — l'action
 *   est destructive, on minimise la fenêtre d'attaque post-vol de boîte
 *   mail.
 * - Le wording est explicite ("Confirmer la suppression") pour ne pas
 *   être confondu avec un login normal — défense contre le phishing
 *   inversé (un attaquant qui aurait déclenché la suppression à la
 *   place de la victime).
 *
 * **Zero-knowledge** : aucun nom d'enfant, aucune donnée santé, aucun
 * contenu identifiant autre que l'adresse de destination que la
 * personne a déjà fournie. Le lien porte le token (≥ 32 octets random)
 * — pas de paramètre identifiant lisible.
 *
 * Refs: KIN-086, E9-S03, NIST SP 800-63B § 5.1.1.2.
 */
export interface DeletionStepUpParams {
  to: string;
  token: string;
  /** TTL en minutes affiché à l'utilisateur — synchro avec la DB. */
  ttlMinutes: number;
}

export async function sendDeletionStepUp(
  transport: Transporter,
  env: Env,
  params: DeletionStepUpParams,
): Promise<void> {
  const confirmUrl = `${env.WEB_URL}/account/deletion-confirm?token=${params.token}`;

  const text = `Bonjour,

Vous avez demandé la suppression de votre foyer Kinhale. Pour confirmer cette demande, cliquez sur le lien suivant :

${confirmUrl}

Ce lien expire dans ${params.ttlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre compte reste actif.

Une fois la suppression confirmée, vous disposerez encore de 7 jours pour annuler avant la purge définitive.

—
L'équipe Kinhale
https://kinhale.health


[EN] You requested the deletion of your Kinhale household. Click the link above to confirm. The link expires in ${params.ttlMinutes} minutes. If you did not request this, ignore this email — your account stays active.

After confirmation, you will have 7 days to cancel before permanent deletion.`;

  const html = `<p>Bonjour,</p>
<p>Vous avez demandé la suppression de votre foyer Kinhale. Pour confirmer cette demande, cliquez sur le lien suivant :</p>
<p><a href="${confirmUrl}">${confirmUrl}</a></p>
<p style="color:#666;font-size:14px">Ce lien expire dans ${params.ttlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message — votre compte reste actif.</p>
<p style="color:#666;font-size:14px">Une fois la suppression confirmée, vous disposerez encore de 7 jours pour annuler avant la purge définitive.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#666;font-size:14px">[EN] You requested the deletion of your Kinhale household. Click the link above to confirm. The link expires in ${params.ttlMinutes} minutes. If you did not request this, ignore this email — your account stays active. After confirmation, you will have 7 days to cancel before permanent deletion.</p>
<p style="color:#999;font-size:12px">— L'équipe Kinhale · <a href="https://kinhale.health">kinhale.health</a></p>`;

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: params.to,
    subject: 'Confirmer la suppression de votre compte Kinhale / Confirm Kinhale account deletion',
    text,
    html,
  });
}
