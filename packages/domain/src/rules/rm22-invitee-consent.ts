import type { Invitation } from '../entities/invitation';
import { DomainError } from '../errors';

/**
 * Consentement exprimé par un aidant invité au moment de l'acceptation
 * d'une invitation (SPECS §4 RM22, W5 étape 7).
 *
 * Le consentement couvre **uniquement** les données propres de l'aidant :
 * son e-mail, son rôle dans le foyer, les horodatages de ses saisies. Il
 * ne couvre **pas** les données de l'enfant — celles-ci relèvent du
 * mandat implicite du parent/tuteur. Cette distinction est conceptuelle :
 * le domaine refuse de traiter un consentement qui prétendrait couvrir
 * l'enfant (`acknowledgesNotConsentingForChild = false`).
 */
export interface InviteeConsent {
  /** L'aidant accepte le traitement de ses propres données (email, rôle, horodatages). */
  readonly acceptsOwnDataProcessing: boolean;
  /**
   * L'aidant reconnaît qu'il **ne consent pas** pour l'enfant. Acquittement
   * explicite, jamais pré-coché côté UI. Requis à `true` : une valeur
   * `false` traduit une confusion de flux et est refusée par le domaine.
   */
  readonly acknowledgesNotConsentingForChild: boolean;
  /** Horodatage UTC du consentement (client trusted, vérifié <= nowUtc). */
  readonly consentedAtUtc: Date;
  /** Identifiant de l'invitation acceptée. Vérifié contre `invitation.id`. */
  readonly invitationId: string;
  /** Identifiant de l'aidant invité. Non inclus dans les contexts d'erreur. */
  readonly inviteeUserId: string;
}

/** Options partagées entre {@link ensureInviteeConsentValid} et {@link isInviteeConsentValid}. */
interface InviteeConsentOptions {
  readonly consent: InviteeConsent;
  readonly invitation: Invitation;
  readonly nowUtc: Date;
}

type ConsentErrorCode =
  | 'RM22_MISSING_INVITEE_CONSENT'
  | 'RM22_INVITEE_CANNOT_CONSENT_FOR_CHILD'
  | 'RM22_INVITATION_NOT_ACTIVE'
  | 'RM22_INVITATION_EXPIRED'
  | 'RM22_CONSENT_INVITATION_MISMATCH'
  | 'RM22_INVALID_CONSENT_TIMESTAMP';

type ConsentDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ConsentErrorCode; readonly detail: string };

/**
 * RM22 — prédicat : le consentement est-il valide ? Retourne un boolean,
 * jamais de lève. Utile pour piloter l'UI (afficher/masquer le CTA de
 * validation) sans capturer d'exception.
 */
export function isInviteeConsentValid(options: InviteeConsentOptions): boolean {
  return evaluateInviteeConsent(options).ok;
}

/**
 * RM22 — assertion : le consentement est valide, sinon lève avec le code
 * d'erreur approprié.
 *
 * Contrats d'erreur :
 * - `RM22_MISSING_INVITEE_CONSENT` : l'aidant n'a pas coché « j'accepte
 *   le traitement de mes données ».
 * - `RM22_INVITEE_CANNOT_CONSENT_FOR_CHILD` : l'aidant n'a pas coché
 *   « je reconnais ne pas consentir pour l'enfant ». Refus conceptuel
 *   même si l'intention est de « faire plus » : le mandat de l'enfant
 *   appartient au parent/tuteur et ne transite pas par ce flux.
 * - `RM22_INVITATION_NOT_ACTIVE` : l'invitation est dans un état terminal
 *   (`consumed`, `expired`, `revoked`).
 * - `RM22_INVITATION_EXPIRED` : l'invitation est encore `active` mais
 *   `expiresAtUtc < consentedAtUtc` — le délai d'acceptation est écoulé.
 * - `RM22_CONSENT_INVITATION_MISMATCH` : `consent.invitationId !==
 *   invitation.id` — incohérence de flux, signe probable d'un bug
 *   d'intégration UI.
 * - `RM22_INVALID_CONSENT_TIMESTAMP` : `consentedAtUtc > nowUtc` —
 *   consentement daté dans le futur, refus strict pour fermer la porte
 *   à une tricherie d'horloge. Le serveur doit re-horodater
 *   l'acceptation côté infra (`acceptedAtUtc`), ce champ n'est utilisé
 *   qu'à titre déclaratif.
 *
 * Le `context` d'erreur ne contient **jamais** `inviteeUserId` ni aucune
 * donnée personnelle : uniquement `invitationId`, `invitationStatus` et
 * `expiresAtUtc` (ISO string).
 */
export function ensureInviteeConsentValid(options: InviteeConsentOptions): void {
  const decision = evaluateInviteeConsent(options);
  if (decision.ok) {
    return;
  }

  throw new DomainError(decision.code, decision.detail, {
    invitationId: options.invitation.id,
    invitationStatus: options.invitation.status,
    expiresAtUtc: options.invitation.expiresAtUtc.toISOString(),
  });
}

function evaluateInviteeConsent(options: InviteeConsentOptions): ConsentDecision {
  const { consent, invitation, nowUtc } = options;

  // 1. Cohérence de flux : le consentement vise bien cette invitation.
  if (consent.invitationId !== invitation.id) {
    return {
      ok: false,
      code: 'RM22_CONSENT_INVITATION_MISMATCH',
      detail: 'Consent references a different invitation.',
    };
  }

  // 2. Tricherie d'horloge : consentement ne peut pas être dans le futur.
  if (consent.consentedAtUtc.getTime() > nowUtc.getTime()) {
    return {
      ok: false,
      code: 'RM22_INVALID_CONSENT_TIMESTAMP',
      detail: 'consentedAtUtc is in the future relative to server nowUtc.',
    };
  }

  // 3. L'invitation doit être encore `active`.
  if (invitation.status !== 'active') {
    return {
      ok: false,
      code: 'RM22_INVITATION_NOT_ACTIVE',
      detail: `Invitation is in terminal state '${invitation.status}'.`,
    };
  }

  // 4. Même active, vérifier qu'elle n'a pas dépassé sa date d'expiration.
  if (invitation.expiresAtUtc.getTime() < consent.consentedAtUtc.getTime()) {
    return {
      ok: false,
      code: 'RM22_INVITATION_EXPIRED',
      detail: 'Invitation expiresAtUtc is before consentedAtUtc.',
    };
  }

  // 5. Consentement explicite pour les données propres de l'aidant.
  if (!consent.acceptsOwnDataProcessing) {
    return {
      ok: false,
      code: 'RM22_MISSING_INVITEE_CONSENT',
      detail: 'Invitee must accept processing of their own data.',
    };
  }

  // 6. Acquittement explicite : le consentement ne couvre pas l'enfant.
  if (!consent.acknowledgesNotConsentingForChild) {
    return {
      ok: false,
      code: 'RM22_INVITEE_CANNOT_CONSENT_FOR_CHILD',
      detail:
        'Invitee cannot consent on behalf of the child; parent mandate is implicit and not transferable via invitation.',
    };
  }

  return { ok: true };
}
