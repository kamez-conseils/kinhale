import type { Transporter } from 'nodemailer';
import type { Env } from '../env.js';

/**
 * E-mail J+7 envoyé après que le worker `account-purge` a effacé les
 * données du compte (E9-S03 / RM10).
 *
 * **Zero-knowledge** : envoi à l'adresse e-mail conservée transitoirement
 * dans le contexte du worker (lue depuis `accounts.email_hash` AVANT la
 * purge — non, on ne peut pas : email_hash est un hash). Solution : on
 * envoie cet e-mail **avant** la purge effective, dans la même
 * transaction logique du worker, en récupérant l'adresse depuis le
 * paramètre fourni à `purgeAccount` (ce qui suppose que l'appelant la
 * connaisse).
 *
 * En pratique le worker ne connaît PAS l'e-mail (le hash est
 * irréversible). On accepte ce trade-off : **l'e-mail J+7 n'est pas
 * envoyé par le worker** — l'utilisateur a déjà reçu l'e-mail T0 qui
 * annonçait la date prévue. Si plus tard on veut envoyer un J+7
 * confirmé, il faudra stocker l'email_hash + un lookup réversible (à
 * éviter — viole zero-knowledge).
 *
 * **DECISION (KIN-086)** : on conserve cette fonction d'envoi pour le cas
 * `deletion-confirm` où le client redirige juste après confirmation
 * (l'e-mail est connu via le step-up) ; le worker, lui, n'enverra qu'un
 * log structuré + un audit `account_deleted`. C'est plus respectueux
 * du zero-knowledge et l'utilisateur a déjà été prévenu via l'e-mail T0.
 *
 * Refs: KIN-086, E9-S03, ADR-D14 (zero-knowledge).
 */
export interface DeletionCompletedParams {
  to: string;
}

export async function sendDeletionCompleted(
  transport: Transporter,
  env: Env,
  params: DeletionCompletedParams,
): Promise<void> {
  const text = `Bonjour,

Votre foyer Kinhale et toutes les données techniques associées ont été effacés du serveur Kinhale.

Vos données santé restaient déjà intégralement sur vos appareils — aucune information médicale n'était conservée par notre service. Cet e-mail confirme simplement que la pseudonymisation et la purge des métadonnées techniques sont effectives.

Merci d'avoir utilisé Kinhale.

—
L'équipe Kinhale
https://kinhale.health


[EN] Your Kinhale household and all associated technical metadata have been erased from the Kinhale relay. Your health data was already stored entirely on your devices — no medical information was kept by our service. This email confirms the pseudonymization and purge of technical metadata. Thanks for using Kinhale.`;

  const html = `<p>Bonjour,</p>
<p>Votre foyer Kinhale et toutes les données techniques associées ont été effacés du serveur Kinhale.</p>
<p style="color:#666;font-size:14px">Vos données santé restaient déjà intégralement sur vos appareils — aucune information médicale n'était conservée par notre service. Cet e-mail confirme simplement que la pseudonymisation et la purge des métadonnées techniques sont effectives.</p>
<p>Merci d'avoir utilisé Kinhale.</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="color:#666;font-size:14px">[EN] Your Kinhale household and all associated technical metadata have been erased from the Kinhale relay. Your health data was already stored entirely on your devices — no medical information was kept by our service. This email confirms the pseudonymization and purge of technical metadata. Thanks for using Kinhale.</p>
<p style="color:#999;font-size:12px">— L'équipe Kinhale · <a href="https://kinhale.health">kinhale.health</a></p>`;

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: params.to,
    subject: 'Suppression Kinhale effective / Kinhale deletion completed',
    text,
    html,
  });
}
