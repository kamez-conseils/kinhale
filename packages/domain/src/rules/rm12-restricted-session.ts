import { activeAdmins } from '../entities/household';
import type { Household } from '../entities/household';
import type { Role } from '../entities/role';
import { DomainError } from '../errors';

/**
 * RM12 — Session Contributeur restreint (SPECS §4 RM12, W6).
 *
 * Les aidants `restricted_contributor` (garderie, nounou, famille
 * élargie) ouvrent une session « kiosque » sur un appareil partagé. Les
 * invariants :
 *
 * 1. **TTL strict de 8 heures** — non renouvelable automatiquement.
 *    Au-delà, la session expire ; le PIN doit être re-saisi pour
 *    créer une **nouvelle** session (jamais prolonger l'ancienne).
 * 2. **Révocation par Admin à tout moment** — un Admin peut couper la
 *    session immédiatement depuis E8 (gestion aidants), par exemple si
 *    un appareil est perdu ou si le personnel de garderie change.
 * 3. **Auto-révocation refusée** — un restricted_contributor ne peut
 *    pas révoquer sa propre session (choix produit : la coupure doit
 *    être tracée côté Admin pour l'audit). Un contributor (non Admin)
 *    non plus : la gestion des sessions est un privilège Admin.
 *
 * Ce module modélise la structure et les transitions ; l'émission du
 * token JWT et la persistance sont côté `apps/api`. Pur, zéro I/O,
 * horloge injectée.
 */

/**
 * Durée de vie d'une session `restricted_contributor` en heures (TTL
 * strict, non renouvelable). Exposée pour être réutilisée côté API lors
 * de l'émission du JWT.
 */
export const RESTRICTED_SESSION_TTL_HOURS = 8;

const RESTRICTED_SESSION_TTL_MS = RESTRICTED_SESSION_TTL_HOURS * 3_600_000;

/**
 * Session kiosque pour un aidant `restricted_contributor`.
 *
 * - `createdAtUtc` : instant de création (après vérification du PIN).
 * - `expiresAtUtc` : `createdAtUtc + 8h`, **borne inclusive** pour la
 *   validité (voir {@link evaluateSessionValidity}).
 * - `revokedAtUtc` : non null si un Admin a révoqué explicitement la
 *   session. La révocation est définitive — jamais de « réactivation ».
 */
export interface RestrictedSession {
  readonly id: string;
  readonly caregiverId: string;
  readonly householdId: string;
  readonly createdAtUtc: Date;
  readonly expiresAtUtc: Date;
  readonly revokedAtUtc: Date | null;
  readonly revokedByCaregiverId: string | null;
}

/** Résultat structurel d'une évaluation de validité. */
export type SessionValidity =
  | { readonly kind: 'valid' }
  | { readonly kind: 'expired'; readonly expiredAtUtc: Date }
  | { readonly kind: 'revoked'; readonly revokedAtUtc: Date };

/**
 * Crée une session en posant `expiresAtUtc = createdAtUtc + 8h`
 * **exactement**. L'appelant ne peut pas injecter une durée custom —
 * garantit l'invariant TTL strict.
 */
export function createRestrictedSession(options: {
  readonly id: string;
  readonly caregiverId: string;
  readonly householdId: string;
  readonly createdAtUtc: Date;
}): RestrictedSession {
  // Clone du createdAt pour éviter tout aliasing avec l'appelant.
  const createdAtUtc = new Date(options.createdAtUtc.getTime());
  const expiresAtUtc = new Date(createdAtUtc.getTime() + RESTRICTED_SESSION_TTL_MS);
  return {
    id: options.id,
    caregiverId: options.caregiverId,
    householdId: options.householdId,
    createdAtUtc,
    expiresAtUtc,
    revokedAtUtc: null,
    revokedByCaregiverId: null,
  };
}

/**
 * Évalue la validité structurelle d'une session.
 *
 * Ordre des priorités :
 * 1. `revoked` — la révocation prend le dessus, même si la session est
 *    aussi expirée (le motif de coupure est l'information utile pour
 *    l'utilisateur).
 * 2. `expired` — la session a dépassé son TTL.
 * 3. `valid` — sinon.
 *
 * Borne d'expiration **inclusive** : `nowUtc === expiresAtUtc` reste
 * `valid`. Choix cohérent avec RM18 (`VOID_FREE_WINDOW_MINUTES`) : les
 * bornes temporelles du domaine sont inclusives. L'appelant qui veut
 * une sémantique strictement différente doit comparer lui-même
 * `nowUtc > expiresAtUtc`.
 */
export function evaluateSessionValidity(options: {
  readonly session: RestrictedSession;
  readonly nowUtc: Date;
}): SessionValidity {
  const { session, nowUtc } = options;
  if (session.revokedAtUtc !== null) {
    return { kind: 'revoked', revokedAtUtc: new Date(session.revokedAtUtc.getTime()) };
  }
  if (nowUtc.getTime() > session.expiresAtUtc.getTime()) {
    return { kind: 'expired', expiredAtUtc: new Date(session.expiresAtUtc.getTime()) };
  }
  return { kind: 'valid' };
}

/** Prédicat non-levant. */
export function isSessionValid(options: {
  readonly session: RestrictedSession;
  readonly nowUtc: Date;
}): boolean {
  return evaluateSessionValidity(options).kind === 'valid';
}

/**
 * Assertion : la session est valide, sinon lève `RM12_SESSION_EXPIRED`
 * ou `RM12_SESSION_REVOKED`.
 *
 * @throws {DomainError} `RM12_SESSION_EXPIRED` si TTL dépassé.
 * @throws {DomainError} `RM12_SESSION_REVOKED` si révoquée par un Admin.
 */
export function ensureSessionValid(options: {
  readonly session: RestrictedSession;
  readonly nowUtc: Date;
}): void {
  const decision = evaluateSessionValidity(options);
  if (decision.kind === 'valid') {
    return;
  }
  if (decision.kind === 'revoked') {
    throw new DomainError(
      'RM12_SESSION_REVOKED',
      'Restricted session has been revoked by an admin.',
      {
        sessionId: options.session.id,
        revokedAtUtc: decision.revokedAtUtc.toISOString(),
      },
    );
  }
  throw new DomainError(
    'RM12_SESSION_EXPIRED',
    'Restricted session TTL (8h) has expired; the PIN must be re-entered to create a new session.',
    {
      sessionId: options.session.id,
      expiredAtUtc: decision.expiredAtUtc.toISOString(),
      nowUtc: options.nowUtc.toISOString(),
    },
  );
}

/**
 * Révocation d'une session.
 *
 * Autorisation :
 * - Seul un **Admin actif du foyer de la session** peut révoquer.
 * - Un contributor ou un restricted_contributor ne peut pas révoquer
 *   (même sa propre session), pour garantir la traçabilité Admin.
 * - Le `revokerRole` fourni par l'appelant est croisé avec la
 *   présence effective du caregiver dans `household.caregivers` (status
 *   === 'active', role === 'admin'). On ne fait pas confiance au seul
 *   `revokerRole` : un claim hostile serait facile à émettre.
 *
 * Le paramètre `household` DOIT être le foyer de la session. Si le
 * `session.householdId` diffère de `household.id`, on refuse (défense
 * anti-IDOR en complément de RM11).
 *
 * @throws {DomainError} `RM12_ALREADY_REVOKED` si la session est déjà
 *   révoquée (la révocation n'est pas re-jouable).
 * @throws {DomainError} `RM12_NOT_AUTHORIZED_TO_REVOKE` si le revoker
 *   n'est pas un Admin actif du foyer de la session.
 */
export function revokeSession(options: {
  readonly session: RestrictedSession;
  readonly revokerCaregiverId: string;
  readonly revokerRole: Role;
  readonly nowUtc: Date;
  readonly household: Household;
}): RestrictedSession {
  const { session, revokerCaregiverId, revokerRole, nowUtc, household } = options;

  if (session.revokedAtUtc !== null) {
    throw new DomainError('RM12_ALREADY_REVOKED', 'Session is already revoked.', {
      sessionId: session.id,
      previouslyRevokedAtUtc: session.revokedAtUtc.toISOString(),
    });
  }

  // Le household passé doit être celui de la session.
  if (household.id !== session.householdId) {
    throw new DomainError(
      'RM12_NOT_AUTHORIZED_TO_REVOKE',
      'Revoker household does not match session household.',
      { sessionId: session.id },
    );
  }

  // Le revoker doit être un Admin actif déclaré dans le foyer.
  const admins = activeAdmins(household);
  const revokerIsActiveAdmin = admins.some((c) => c.id === revokerCaregiverId);

  if (revokerRole !== 'admin' || !revokerIsActiveAdmin) {
    throw new DomainError(
      'RM12_NOT_AUTHORIZED_TO_REVOKE',
      'Only an active admin of the session household can revoke a restricted session.',
      { sessionId: session.id },
    );
  }

  return {
    ...session,
    revokedAtUtc: new Date(nowUtc.getTime()),
    revokedByCaregiverId: revokerCaregiverId,
  };
}
