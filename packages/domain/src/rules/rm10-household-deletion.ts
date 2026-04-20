import { sha256HexFromString } from '@kinhale/crypto';
import { activeAdmins } from '../entities/household';
import type { Household } from '../entities/household';
import { DomainError } from '../errors';

/**
 * RM10 — Suppression de compte / foyer (SPECS §4 RM10, W10).
 *
 * Le domaine modélise la **machine à états** de la suppression et les
 * invariants de consentement / délai. Il ne génère pas les PDF/CSV de
 * portabilité ni ne déclenche les rotations de clé KMS ; ceux-ci vivent
 * dans `apps/api`. RM10 fournit :
 *
 * 1. la **transition d'état** demandée par l'Admin (`active` →
 *    `pending_deletion`) + le **manifeste d'archive de portabilité**
 *    (CSV + PDF, 12 mois glissants) ;
 * 2. la possibilité d'**annuler** pendant la période de grâce de 7 jours
 *    (borne inclusive) ;
 * 3. le **calcul d'état** courant en fonction de l'horloge (transition
 *    `pending_deletion` → `deleted` une fois la grâce expirée) ;
 * 4. la **deadline de purge** des backups rotatifs (`deletedAtUtc + 30j`) ;
 * 5. un helper de **pseudonymisation** déterministe pour l'audit trail
 *    conservé au-delà de la purge (SHA-256 + salt secret serveur).
 *
 * ## Pourquoi l'état est séparé du `Household`
 *
 * On introduit `HouseholdDeletionState` comme structure distincte plutôt
 * que d'ajouter des champs sur `Household`. Ceci évite de polluer
 * l'entité métier principale (utilisée à chaque saisie) avec des champs
 * ne concernant que < 0,1 % des cycles de vie, et rend la règle
 * explicite pour le reviewer sécurité.
 *
 * ## Choix sémantiques tranchés
 *
 * - **Couverture archive = 365 jours glissants**, pas « 12 mois
 *   calendaires ». Simplicité + cohérence avec les autres règles qui
 *   expriment les fenêtres en millisecondes (RM2, RM17, RM20, RM28).
 * - **Bornes inclusives** pour les délais (7 jours, 30 jours) —
 *   cohérent avec RM18 (`VOID_FREE_WINDOW_MINUTES`) et RM22.
 * - **Refus strict > 1 admin actif** — RM10 refuse de court-circuiter
 *   W11 (transfert d'admin). Un Admin qui part doit d'abord transférer.
 *
 * ## Horloge
 *
 * Aucune lecture `Date.now()` : `nowUtc` est injecté partout.
 */

/**
 * Durée de la période de grâce (en jours) pendant laquelle la
 * suppression peut être annulée. Borne **inclusive**.
 */
export const DELETION_GRACE_PERIOD_DAYS = 7;

/**
 * Délai maximal (en jours) après le passage à `deleted` pour que les
 * backups rotatifs soient purgés (contrainte infra + RGPD / Loi 25).
 */
export const DELETION_PURGE_MAX_DAYS = 30;

/**
 * Couverture de l'archive de portabilité (en jours) — 12 mois
 * approximés à 365 jours pour cohérence millisecondes avec les autres
 * règles du domaine.
 */
export const DELETION_PORTABILITY_COVERAGE_DAYS = 365;

const DAY_MS = 86_400_000;
const GRACE_PERIOD_MS = DELETION_GRACE_PERIOD_DAYS * DAY_MS;
const PURGE_MAX_MS = DELETION_PURGE_MAX_DAYS * DAY_MS;
const PORTABILITY_COVERAGE_MS = DELETION_PORTABILITY_COVERAGE_DAYS * DAY_MS;

/** Les trois états possibles. */
export type HouseholdDeletionStatus = 'active' | 'pending_deletion' | 'deleted';

/**
 * État de suppression d'un foyer.
 *
 * - `active` : tous les champs `requested*` et `deleted*` sont `null`.
 * - `pending_deletion` : `requestedAtUtc`, `graceExpiresAtUtc` et
 *   `requestedByCaregiverId` sont non-null ; `deletedAtUtc` est `null`.
 * - `deleted` : `requestedAtUtc`, `graceExpiresAtUtc`,
 *   `requestedByCaregiverId` et `deletedAtUtc` sont tous non-null.
 */
export interface HouseholdDeletionState {
  readonly status: HouseholdDeletionStatus;
  readonly requestedAtUtc: Date | null;
  readonly graceExpiresAtUtc: Date | null;
  readonly deletedAtUtc: Date | null;
  readonly requestedByCaregiverId: string | null;
}

/**
 * Manifeste d'archive de portabilité. C'est une **structure déclarative**
 * — le domaine ne génère pas le CSV ni le PDF réels, mais décrit ce que
 * l'infra (`apps/api`) doit matérialiser et envoyer par e-mail.
 *
 * - `coveragePeriodFromUtc` = `requestedAtUtc - 365 jours`.
 * - `coveragePeriodToUtc` = `requestedAtUtc` (exclusif côté consommateur).
 * - `formats` = **obligatoirement** CSV + PDF (couple, pas un choix
 *   client).
 */
export interface PortabilityArchiveManifest {
  readonly householdId: string;
  readonly requestedAtUtc: Date;
  readonly requestedByCaregiverId: string;
  readonly coveragePeriodFromUtc: Date;
  readonly coveragePeriodToUtc: Date;
  readonly formats: readonly ['csv', 'pdf'];
}

/**
 * Demande de suppression d'un foyer.
 *
 * @throws {DomainError} `RM10_HOUSEHOLD_NOT_ACTIVE` — le foyer transmis
 *   est déjà considéré comme en suppression. La détection se fait
 *   implicitement : l'appelant doit construire un `Household` et la
 *   règle refuse si > 1 admin. La vraie détection `active` est côté
 *   infra (champ persisté). Ici on valide surtout la **topologie** du
 *   foyer. NOTE : ce code n'est PAS levé par la règle elle-même (le
 *   domaine ne connaît pas le champ `status` sur `Household`) — il est
 *   exposé via l'enum pour que `apps/api` l'utilise lors de l'appel
 *   préliminaire.
 * @throws {DomainError} `RM10_MULTIPLE_ADMINS_PRESENT` — doit passer par
 *   W11 d'abord.
 * @throws {DomainError} `RM10_NOT_AUTHORIZED` — le requester n'est pas
 *   un admin actif du foyer.
 */
export function requestHouseholdDeletion(options: {
  readonly household: Household;
  readonly requesterCaregiverId: string;
  readonly nowUtc: Date;
}): {
  readonly nextState: HouseholdDeletionState;
  readonly archiveManifest: PortabilityArchiveManifest;
} {
  const { household, requesterCaregiverId, nowUtc } = options;

  const admins = activeAdmins(household);
  const requesterIsActiveAdmin = admins.some((c) => c.id === requesterCaregiverId);

  if (!requesterIsActiveAdmin) {
    throw new DomainError(
      'RM10_NOT_AUTHORIZED',
      'Only an active admin of the household can request its deletion.',
      { householdId: household.id, requesterCaregiverId },
    );
  }

  if (admins.length > 1) {
    throw new DomainError(
      'RM10_MULTIPLE_ADMINS_PRESENT',
      'Household has multiple active admins; transfer admin (W11) before deletion.',
      { householdId: household.id, activeAdminCount: admins.length },
    );
  }

  const requestedAtUtc = new Date(nowUtc.getTime());
  const graceExpiresAtUtc = new Date(nowUtc.getTime() + GRACE_PERIOD_MS);

  const nextState: HouseholdDeletionState = {
    status: 'pending_deletion',
    requestedAtUtc,
    graceExpiresAtUtc,
    deletedAtUtc: null,
    requestedByCaregiverId: requesterCaregiverId,
  };

  const archiveManifest: PortabilityArchiveManifest = {
    householdId: household.id,
    requestedAtUtc: new Date(nowUtc.getTime()),
    requestedByCaregiverId: requesterCaregiverId,
    coveragePeriodFromUtc: new Date(nowUtc.getTime() - PORTABILITY_COVERAGE_MS),
    coveragePeriodToUtc: new Date(nowUtc.getTime()),
    formats: ['csv', 'pdf'],
  };

  return { nextState, archiveManifest };
}

/**
 * Annule une suppression en cours. Refusée hors statut
 * `pending_deletion` ou après expiration de la grâce (borne inclusive).
 *
 * Retourne un état `active` « frais » (tous les champs de suppression
 * remis à `null`). Le `requesterCaregiverId` est accepté **sans**
 * vérification de rôle ici : la réactivation est volontairement permise
 * à n'importe quel membre du foyer (la grâce n'est pas un contrôle
 * d'autorisation mais un délai de rétractation). La vérification de
 * membre du foyer reste à la charge de l'API (cf. RM11).
 *
 * @throws {DomainError} `RM10_CANNOT_CANCEL` si `currentState.status !==
 *   'pending_deletion'`.
 * @throws {DomainError} `RM10_GRACE_PERIOD_EXPIRED` si `nowUtc >
 *   graceExpiresAtUtc`.
 */
export function cancelHouseholdDeletion(options: {
  readonly currentState: HouseholdDeletionState;
  readonly nowUtc: Date;
  readonly requesterCaregiverId: string;
}): HouseholdDeletionState {
  const { currentState, nowUtc, requesterCaregiverId } = options;

  if (currentState.status !== 'pending_deletion') {
    throw new DomainError(
      'RM10_CANNOT_CANCEL',
      `Cannot cancel deletion when current status is '${currentState.status}'.`,
      { status: currentState.status, requesterCaregiverId },
    );
  }

  const graceExpiresAtUtc = currentState.graceExpiresAtUtc;
  if (graceExpiresAtUtc === null) {
    // Défense : état pending_deletion doit toujours avoir graceExpiresAtUtc.
    throw new DomainError(
      'RM10_CANNOT_CANCEL',
      'Inconsistent pending_deletion state: graceExpiresAtUtc is null.',
      { requesterCaregiverId },
    );
  }

  if (nowUtc.getTime() > graceExpiresAtUtc.getTime()) {
    throw new DomainError(
      'RM10_GRACE_PERIOD_EXPIRED',
      'Deletion grace period has expired; cancellation is no longer possible.',
      {
        graceExpiresAtUtc: graceExpiresAtUtc.toISOString(),
        nowUtc: nowUtc.toISOString(),
      },
    );
  }

  return {
    status: 'active',
    requestedAtUtc: null,
    graceExpiresAtUtc: null,
    deletedAtUtc: null,
    requestedByCaregiverId: null,
  };
}

/**
 * Calcule l'état de suppression au temps `nowUtc`.
 *
 * - `pending_deletion` avec grâce expirée (`nowUtc > graceExpiresAtUtc`)
 *   → transition `deleted`, `deletedAtUtc = nowUtc`. La détection est
 *   strictement supérieure pour aligner avec l'inclusivité de
 *   {@link cancelHouseholdDeletion}.
 * - Sinon : retourne l'état inchangé (copie défensive).
 */
export function evaluateDeletionState(options: {
  readonly currentState: HouseholdDeletionState;
  readonly nowUtc: Date;
}): HouseholdDeletionState {
  const { currentState, nowUtc } = options;

  if (currentState.status !== 'pending_deletion') {
    return cloneState(currentState);
  }

  const graceExpiresAtUtc = currentState.graceExpiresAtUtc;
  if (graceExpiresAtUtc !== null && nowUtc.getTime() > graceExpiresAtUtc.getTime()) {
    return {
      status: 'deleted',
      requestedAtUtc: cloneDate(currentState.requestedAtUtc),
      graceExpiresAtUtc: cloneDate(graceExpiresAtUtc),
      deletedAtUtc: new Date(nowUtc.getTime()),
      requestedByCaregiverId: currentState.requestedByCaregiverId,
    };
  }

  return cloneState(currentState);
}

/**
 * Deadline de purge des backups rotatifs. Retourne `null` si le foyer
 * n'est pas encore `deleted` — la purge n'est prévue qu'à partir de la
 * transition `deleted`.
 */
export function purgeDeadlineUtc(deletedState: HouseholdDeletionState): Date | null {
  if (deletedState.status !== 'deleted' || deletedState.deletedAtUtc === null) {
    return null;
  }
  return new Date(deletedState.deletedAtUtc.getTime() + PURGE_MAX_MS);
}

/**
 * Pseudonymisation stable et déterministe d'un `householdId` pour
 * l'historique d'audit conservé après purge (RM10).
 *
 * Contrat :
 * - `SHA-256(householdId + '|' + auditSalt)` en hex minuscule, 64 car.
 * - **Déterministe** : même couple → même sortie (utile pour corréler
 *   plusieurs entrées d'audit d'un même foyer purgé).
 * - **Irréversible** : la préimage nécessite la connaissance du
 *   `auditSalt` ; ce dernier est un secret serveur (Secrets Manager),
 *   jamais stocké en base avec les entrées d'audit.
 * - **Sensibilité au salt** : une rotation du salt brise la corrélation
 *   pour les nouvelles entrées (choix d'exploitation, à documenter).
 *
 * Le séparateur `|` est ajouté pour éviter une collision théorique du
 * type `concat('AB', 'C') === concat('A', 'BC')` — les UUID et les salt
 * n'en contiennent pas, mais la règle reste robuste même si un jour un
 * salt libre est introduit.
 *
 * Appelle `sha256HexFromString` depuis `@kinhale/crypto` — seul point
 * d'accès autorisé à la crypto dans le domaine (règle CLAUDE.md).
 */
export async function pseudonymizeHouseholdForAudit(options: {
  readonly householdId: string;
  readonly auditSalt: string;
}): Promise<string> {
  const preimage = `${options.householdId}|${options.auditSalt}`;
  return sha256HexFromString(preimage);
}

function cloneState(state: HouseholdDeletionState): HouseholdDeletionState {
  return {
    status: state.status,
    requestedAtUtc: cloneDate(state.requestedAtUtc),
    graceExpiresAtUtc: cloneDate(state.graceExpiresAtUtc),
    deletedAtUtc: cloneDate(state.deletedAtUtc),
    requestedByCaregiverId: state.requestedByCaregiverId,
  };
}

function cloneDate(d: Date | null): Date | null {
  return d === null ? null : new Date(d.getTime());
}
