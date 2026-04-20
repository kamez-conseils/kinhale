import type { Dose } from '../entities/dose';
import type { Role } from '../entities/role';
import { DomainError } from '../errors';

/**
 * Fenêtre de grâce (en minutes) pendant laquelle l'auteur d'une prise peut
 * l'annuler librement (sans raison écrite). Passé ce délai, seul un Admin peut
 * voider, et `voidedReason` devient obligatoire.
 *
 * Borne **inclusive** : un void à 30 min 00 s pile reste dans la fenêtre
 * libre. Choix cohérent avec la lecture littérale de la spec (« dans les
 * 30 minutes suivant la saisie ») et moins surprenant pour l'utilisateur.
 */
export const VOID_FREE_WINDOW_MINUTES = 30;

const VOID_FREE_WINDOW_MS = VOID_FREE_WINDOW_MINUTES * 60_000;

/** Identité du demandeur d'une annulation (RM18). */
export interface VoidRequester {
  readonly caregiverId: string;
  readonly role: Role;
}

/** Options d'annulation d'une prise (RM18). */
export interface VoidDoseOptions {
  /** La prise à voider. */
  readonly dose: Dose;
  /** Aidant qui tente l'annulation. */
  readonly requester: VoidRequester;
  /**
   * Heure serveur courante (RM14). Toujours injectée — jamais `Date.now()`
   * côté règle, pour garantir la déterminisme des tests.
   */
  readonly nowUtc: Date;
  /**
   * Motif d'annulation. Requis **strictement** quand la fenêtre libre est
   * expirée. Une chaîne vide ou whitespace pur est considérée absente.
   */
  readonly voidedReason?: string;
}

/**
 * Conteneur interne décrivant la décision RM18. Séparé pour factoriser la
 * logique entre {@link canVoidDose}, {@link ensureCanVoidDose} et
 * {@link voidDose} sans dupliquer les branches.
 */
type VoidAuthorization =
  | { readonly ok: true; readonly normalizedReason: string | null }
  | { readonly ok: false; readonly errorCode: VoidErrorCode; readonly detail: string };

type VoidErrorCode = 'RM18_ALREADY_VOIDED' | 'RM18_NOT_AUTHORIZED' | 'RM18_VOIDED_REASON_REQUIRED';

/**
 * RM18 — prédicat : la demande d'annulation est-elle autorisée ? Retourne
 * simplement `true`/`false`, sans jamais lever. Pour obtenir la raison d'un
 * refus, utiliser {@link ensureCanVoidDose}.
 */
export function canVoidDose(options: VoidDoseOptions): boolean {
  return authorizeVoid(options).ok;
}

/**
 * RM18 — assertion : l'annulation est autorisée, sinon lève avec le code
 * d'erreur approprié.
 *
 * @throws {DomainError} `RM18_ALREADY_VOIDED` si la prise est déjà voidée.
 * @throws {DomainError} `RM18_NOT_AUTHORIZED` si le demandeur n'a pas les
 *   droits (contributor non-auteur, restricted_contributor, auteur hors
 *   fenêtre libre).
 * @throws {DomainError} `RM18_VOIDED_REASON_REQUIRED` si l'admin tente une
 *   annulation hors fenêtre libre sans raison écrite (vide ou whitespace).
 */
export function ensureCanVoidDose(options: VoidDoseOptions): void {
  const decision = authorizeVoid(options);
  if (decision.ok) {
    return;
  }
  throw new DomainError(decision.errorCode, decision.detail, {
    doseId: options.dose.id,
    caregiverId: options.requester.caregiverId,
    role: options.requester.role,
    recordedAtUtc: options.dose.recordedAtUtc?.toISOString() ?? null,
    nowUtc: options.nowUtc.toISOString(),
  });
}

/**
 * RM18 — applique l'annulation : retourne une **nouvelle** `Dose` avec
 * `status = 'voided'` et `voidedReason` normalisé (trim, null si vide).
 * Ne mute jamais la prise source.
 *
 * @throws {DomainError} Mêmes codes que {@link ensureCanVoidDose}.
 */
export function voidDose(options: VoidDoseOptions): Dose {
  const decision = authorizeVoid(options);
  if (!decision.ok) {
    throw new DomainError(decision.errorCode, decision.detail, {
      doseId: options.dose.id,
      caregiverId: options.requester.caregiverId,
      role: options.requester.role,
      nowUtc: options.nowUtc.toISOString(),
    });
  }
  return {
    ...options.dose,
    status: 'voided',
    voidedReason: decision.normalizedReason,
  };
}

function authorizeVoid(options: VoidDoseOptions): VoidAuthorization {
  const { dose, requester, nowUtc } = options;

  if (dose.status === 'voided') {
    return {
      ok: false,
      errorCode: 'RM18_ALREADY_VOIDED',
      detail: `Dose ${dose.id} is already voided.`,
    };
  }

  const normalizedReason = normalizeReason(options.voidedReason);
  const insideFreeWindow = isInsideFreeWindow(dose, nowUtc);
  const isAuthor = requester.caregiverId === dose.caregiverId;
  const isAdmin = requester.role === 'admin';

  if (requester.role === 'restricted_contributor') {
    return {
      ok: false,
      errorCode: 'RM18_NOT_AUTHORIZED',
      detail: 'restricted_contributor cannot void doses.',
    };
  }

  if (insideFreeWindow) {
    // Dans la fenêtre libre : auteur OR admin. voidedReason optionnel.
    if (isAuthor || isAdmin) {
      return { ok: true, normalizedReason };
    }
    return {
      ok: false,
      errorCode: 'RM18_NOT_AUTHORIZED',
      detail: 'Within free window, only the author or an admin can void the dose.',
    };
  }

  // Hors fenêtre libre : admin seul, raison obligatoire non vide.
  if (!isAdmin) {
    return {
      ok: false,
      errorCode: 'RM18_NOT_AUTHORIZED',
      detail: 'Free window expired; only an admin can void the dose after 30 minutes.',
    };
  }
  if (normalizedReason === null) {
    return {
      ok: false,
      errorCode: 'RM18_VOIDED_REASON_REQUIRED',
      detail: 'Admin void after free window requires a non-empty voidedReason.',
    };
  }
  return { ok: true, normalizedReason };
}

/**
 * Détermine si la prise est encore dans la fenêtre libre de 30 min.
 *
 * Référence temporelle : `recordedAtUtc` (RM14 — horodatage serveur). Si
 * absent (prise encore hors-ligne, jamais confirmée par le serveur), on
 * retombe sur `administeredAtUtc` pour ne pas bloquer un cas dégradé. La
 * borne est inclusive (`<= 30 min`).
 */
function isInsideFreeWindow(dose: Dose, nowUtc: Date): boolean {
  const reference = dose.recordedAtUtc ?? dose.administeredAtUtc;
  const elapsedMs = nowUtc.getTime() - reference.getTime();
  return elapsedMs <= VOID_FREE_WINDOW_MS;
}

/**
 * Normalise un `voidedReason` : `null` si absent, vide ou whitespace pur,
 * sinon la chaîne trimée.
 */
function normalizeReason(reason: string | undefined): string | null {
  if (reason === undefined) {
    return null;
  }
  const trimmed = reason.trim();
  return trimmed.length === 0 ? null : trimmed;
}
