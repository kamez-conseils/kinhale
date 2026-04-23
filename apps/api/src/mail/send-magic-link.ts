import type { Transporter } from 'nodemailer';
import type { Env } from '../env.js';

export interface MagicLinkParams {
  to: string;
  token: string;
}

export async function sendMagicLink(
  transport: Transporter,
  env: Env,
  params: MagicLinkParams,
): Promise<void> {
  const verifyUrl = `${env.WEB_URL}/auth/verify?token=${params.token}`;

  // Payload conforme aux règles : aucune donnée santé, aucune info
  // identifiante autre que le lien lui-même.
  const text = `Bonjour,

Cliquez sur ce lien pour vous connecter à Kinhale :

${verifyUrl}

Ce lien expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.

—
L'équipe Kinhale
https://kinhale.health`;

  const html = `<p>Bonjour,</p>
<p>Cliquez sur ce lien pour vous connecter à Kinhale :</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p style="color:#666;font-size:14px">Ce lien expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message.</p>
<p style="color:#999;font-size:12px">— L'équipe Kinhale · <a href="https://kinhale.health">kinhale.health</a></p>`;

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: params.to,
    subject: 'Votre lien de connexion Kinhale',
    text,
    html,
  });
}
