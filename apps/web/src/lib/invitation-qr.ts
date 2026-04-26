/**
 * Parser de payloads QR d'invitation Kinhale (KIN-096).
 *
 * Le générateur (mobile + web) émet deux formats compatibles :
 *  - `kinhale://accept/<token>?pin=<pin>` (mobile, deep-link natif)
 *  - `https://<host>/accept-invitation/<token>?pin=<pin>` (web, wrapper)
 *
 * Le parser web accepte les deux et rejette **strictement** tout autre format
 * pour empêcher un QR forgé d'amorcer une redirection vers une URL arbitraire
 * (anti-phishing, anti-XSS via `javascript:` scheme).
 *
 * Refs : KIN-096, kz-securite §validation entrée utilisateur.
 */

export interface ParsedInvitationPayload {
  token: string;
  /** PIN à 6 chiffres extrait du QR, ou chaîne vide si absent (saisie manuelle). */
  pin: string;
}

/**
 * Tokens d'invitation : générés par `generateInvitationToken()` côté API
 * (32 octets en URL-safe base64 sans padding). On valide une whitelist
 * conservative pour éviter qu'un caractère exotique ne contourne le routage
 * Next.js ou n'introduise une regression d'encodage.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{4,128}$/u;
const PIN_RE = /^\d{6}$/u;

function validateToken(token: string): void {
  if (!TOKEN_RE.test(token)) {
    throw new Error('invalid_qr');
  }
}

function validatePin(pin: string): void {
  if (pin !== '' && !PIN_RE.test(pin)) {
    throw new Error('invalid_qr');
  }
}

/**
 * Parse un texte brut scanné (ou collé) en `{ token, pin }`.
 *
 * @throws Error('invalid_qr') si le format n'est pas reconnu.
 */
export function parseInvitationPayload(raw: string): ParsedInvitationPayload {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1024) {
    throw new Error('invalid_qr');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('invalid_qr');
  }

  let token = '';
  if (url.protocol === 'kinhale:') {
    // Format `kinhale://accept/<token>` — `host` = "accept", `pathname` = "/<token>"
    if (url.host !== 'accept') {
      throw new Error('invalid_qr');
    }
    token = url.pathname.replace(/^\/+/u, '');
  } else if (url.protocol === 'https:' || url.protocol === 'http:') {
    // Wrapper web : `/accept-invitation/<token>` (chemin obligatoire pour
    // empêcher un domaine quelconque d'être redirigé vers `/<token>`).
    const segments = url.pathname.split('/').filter((s) => s.length > 0);
    if (segments.length !== 2 || segments[0] !== 'accept-invitation') {
      throw new Error('invalid_qr');
    }
    token = segments[1] ?? '';
  } else {
    // Refuse `javascript:`, `data:`, `file:`, etc.
    throw new Error('invalid_qr');
  }

  validateToken(token);

  const pin = url.searchParams.get('pin') ?? '';
  validatePin(pin);

  return { token, pin };
}
