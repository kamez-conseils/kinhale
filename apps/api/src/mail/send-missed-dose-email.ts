import type { Transporter } from 'nodemailer';
import type { Env } from '../env.js';

/**
 * Locales supportées pour l'e-mail fallback. Aligné sur `supportedLngs` de
 * `@kinhale/i18n`. On n'importe pas le package i18n côté API : les chaînes
 * sont peu nombreuses et les tests verrouillent la neutralité santé, ce qui
 * est plus lisible que passer par i18next-node.
 */
export type MissedDoseEmailLocale = 'fr' | 'en';

export interface MissedDoseEmailParams {
  /** Adresse destinataire (en clair, non persistée — cf. `auth.ts` magic-link). */
  readonly to: string;
  /**
   * Token signé court (JWT `missed_dose_open`) fourni par la route. Utilisé
   * pour construire l'URL `${WEB_URL}/notify?t=<token>`. La validation et la
   * signature sont faites en amont — ce module ne fait qu'écrire l'URL.
   */
  readonly openToken: string;
  /** Langue du corps. Par défaut FR (langue principale du produit, cf. `@kinhale/i18n` `supportedLngs`). */
  readonly locale?: MissedDoseEmailLocale;
}

interface Copy {
  readonly subject: string;
  readonly greeting: string;
  readonly line1: string;
  readonly cta: string;
  readonly footer: string;
  readonly signOff: string;
  readonly linkFallbackLabel: string;
}

/**
 * Copies FR / EN — volontairement **génériques**. Aucune mention de prénom,
 * pompe, dose, symptôme, asthme. Ligne rouge dispositif médical + zero-knowledge
 * (le relais ne connaît rien du contenu santé, donc ne peut rien nommer).
 *
 * Alignement avec SPECS §9 (canaux) et CLAUDE.md (principes 1, 2, 5) :
 *   subject : "Kinhale — Nouvelle activité" / "Kinhale — New activity"
 *   body    : "Ouvrez l'application pour consulter" / "Open the app to review"
 *
 * Refs: KIN-079, SPECS §9, RM25.
 */
const COPIES: Readonly<Record<MissedDoseEmailLocale, Copy>> = {
  fr: {
    subject: 'Kinhale — Nouvelle activité',
    greeting: 'Bonjour,',
    line1: 'Une activité récente dans votre foyer Kinhale attend votre attention.',
    cta: "Ouvrir l'application",
    linkFallbackLabel: 'Lien direct :',
    footer:
      'Ce lien expire sous 2 heures. Vous pouvez ignorer ce message si vous avez déjà consulté.',
    signOff: "— L'équipe Kinhale",
  },
  en: {
    subject: 'Kinhale — New activity',
    greeting: 'Hello,',
    line1: 'Recent activity in your Kinhale household requires your attention.',
    cta: 'Open the app',
    linkFallbackLabel: 'Direct link:',
    footer: 'This link expires in 2 hours. You can ignore this message if you already reviewed.',
    signOff: '— The Kinhale team',
  },
};

function resolveLocale(raw: MissedDoseEmailLocale | undefined): MissedDoseEmailLocale {
  // Strict check : toute valeur inattendue retombe sur FR (langue par défaut)
  if (raw === 'en') return 'en';
  return 'fr';
}

/**
 * RM25 / E5-S04 — envoie l'e-mail fallback `missed_dose`.
 *
 * Règles non-négociables (cf. CLAUDE.md) :
 * - **Aucune donnée santé** dans le corps ou le sujet (prénom, dose, pompe,
 *   symptôme, note). Les tests `send-missed-dose-email.test.ts` verrouillent
 *   cette promesse.
 * - **Lien opaque signé** : le seul identifiant dans l'URL est un JWT court
 *   (`missed_dose_open`, TTL 2 h). Pas de household_id, deviceId ni reminderId.
 * - **Pas de persistance** : l'e-mail destinataire est utilisé pour routage
 *   puis jeté (même pattern que `sendMagicLink`).
 *
 * Fonction pure côté I/O mail — le transport est injecté (testable via mock).
 * Les erreurs sont **propagées** : c'est à l'appelant (la route) de décider
 * de les logguer sans exposer la 202 HTTP.
 */
export async function sendMissedDoseEmail(
  transport: Transporter,
  env: Env,
  params: MissedDoseEmailParams,
): Promise<void> {
  const locale = resolveLocale(params.locale);
  const copy = COPIES[locale];

  // URL courte, déterministe — ouvre un écran dédié côté web/mobile (deep link
  // à implémenter dans une story front E5-S04-UI si besoin ; côté serveur on
  // se contente de générer l'URL).
  const openUrl = `${env.WEB_URL}/notify?t=${params.openToken}`;

  const text = `${copy.greeting}

${copy.line1}

${copy.cta} : ${openUrl}

${copy.footer}

${copy.signOff}
https://kinhale.health`;

  // HTML minimal — pas de tracking pixel, pas de ressource externe. Un seul
  // lien, échappé par interpolation simple (openToken est un JWT base64url =
  // caractères safe, pas de `<>"'`). On n'échappe pas les copies car elles
  // sont statiques (pas d'entrée utilisateur).
  const html = `<p>${copy.greeting}</p>
<p>${copy.line1}</p>
<p><a href="${openUrl}">${copy.cta}</a></p>
<p style="color:#666;font-size:13px">${copy.linkFallbackLabel} <a href="${openUrl}">${openUrl}</a></p>
<p style="color:#666;font-size:13px">${copy.footer}</p>
<p style="color:#999;font-size:12px">${copy.signOff} · <a href="https://kinhale.health">kinhale.health</a></p>`;

  await transport.sendMail({
    from: env.MAIL_FROM,
    to: params.to,
    subject: copy.subject,
    text,
    html,
  });
}
