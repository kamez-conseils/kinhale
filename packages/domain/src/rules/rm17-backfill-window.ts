import { DomainError } from '../errors';

/**
 * Fenêtre maximale de rattrapage autorisée sans confirmation explicite (RM17).
 * Au-delà, une saisie `backfill` reste possible mais nécessite un accusé de
 * saisie explicite par l'aidant (« Je confirme cette prise à cette heure »).
 */
export const BACKFILL_MAX_WINDOW_HOURS = 24;

const BACKFILL_MAX_WINDOW_MS = BACKFILL_MAX_WINDOW_HOURS * 60 * 60_000;

/**
 * Seuil en-dessous duquel un écart `|recorded - administered|` est considéré
 * comme une saisie **temps réel** (pas un backfill). Exprimé en millisecondes.
 *
 * Valeur choisie : 5 s. Motivations :
 * - couvre le RTT réseau d'une saisie en ligne normale ;
 * - tolère une micro-désync d'horloge sans bruit de flag ;
 * - strictement < à la borne RM6 (2 min), donc sans interférence.
 *
 * Un écart de 3 secondes (ou de 0) reste classé `on_time` ; un écart > 5 s
 * bascule en `within_window` si le passé et dans la fenêtre des 24 h.
 */
const ON_TIME_TOLERANCE_MS = 5_000;

/**
 * Classification du timing d'une prise vs. le moment de saisie serveur (RM17).
 *
 * - `on_time` : saisie quasi temps réel (|Δ| ≤ 5 s).
 * - `within_window` : backfill valide, `lateBy` = combien de ms dans le passé.
 * - `future_refused` : saisie dans le futur strict (horloge client en avance
 *   ou tentative de falsification). Jamais autorisée, même avec confirmation.
 * - `too_old` : plus de 24 h dans le passé. Nécessite une confirmation
 *   explicite (« Je confirme cette prise à cette heure ») pour passer.
 */
export type BackfillValidity =
  | { readonly kind: 'on_time' }
  | { readonly kind: 'within_window'; readonly lateBy: number }
  | { readonly kind: 'future_refused'; readonly aheadBy: number }
  | { readonly kind: 'too_old'; readonly lateBy: number };

/** Résultat de la validation RM17 — purement informatif. */
export interface BackfillValidation {
  readonly validity: BackfillValidity;
  /**
   * `true` si la saisie dépasse 24 h dans le passé : l'UI doit exiger un
   * accusé de saisie explicite avant d'envoyer la requête.
   */
  readonly requiresExplicitConfirmation: boolean;
}

/** Options communes à {@link validateBackfillTiming} et {@link ensureBackfillAllowed}. */
export interface BackfillOptions {
  /** Horodatage déclaré par le client — RM14 : client fait foi. */
  readonly administeredAtUtc: Date;
  /** Horodatage serveur de la saisie — RM14 : autoritaire. */
  readonly recordedAtUtc: Date;
  /**
   * Accusé de saisie explicite de l'aidant. Pertinent uniquement quand la
   * classification est `too_old` : il permet de passer le contrôle. Ignoré
   * pour `future_refused` — le futur est toujours refusé.
   */
  readonly explicitlyConfirmed?: boolean;
}

/**
 * RM17 — classe le timing d'une prise par rapport à la fenêtre de rattrapage.
 *
 * Convention de signe : `administeredAtUtc < recordedAtUtc` ⇒ `lateBy > 0`
 * (saisie dans le passé, cas normal). `administeredAtUtc > recordedAtUtc` ⇒
 * `aheadBy > 0` (futur, toujours refusé). Égalité ou écart ≤ 5 s ⇒ `on_time`.
 *
 * Pure fonction : ne mute pas `administeredAtUtc` ni `recordedAtUtc`. Ignore
 * le flag `explicitlyConfirmed` — ce dernier n'est pris en compte que par
 * {@link ensureBackfillAllowed} qui traduit la classification en décision.
 */
export function validateBackfillTiming(options: BackfillOptions): BackfillValidation {
  const deltaMs = options.recordedAtUtc.getTime() - options.administeredAtUtc.getTime();

  if (deltaMs < -ON_TIME_TOLERANCE_MS) {
    // administered > recorded : futur
    return {
      validity: { kind: 'future_refused', aheadBy: -deltaMs },
      requiresExplicitConfirmation: false,
    };
  }

  if (deltaMs <= ON_TIME_TOLERANCE_MS) {
    return {
      validity: { kind: 'on_time' },
      requiresExplicitConfirmation: false,
    };
  }

  if (deltaMs <= BACKFILL_MAX_WINDOW_MS) {
    return {
      validity: { kind: 'within_window', lateBy: deltaMs },
      requiresExplicitConfirmation: false,
    };
  }

  return {
    validity: { kind: 'too_old', lateBy: deltaMs },
    requiresExplicitConfirmation: true,
  };
}

/**
 * RM17 — exige un timing acceptable : on_time, within_window, ou too_old avec
 * `explicitlyConfirmed = true`. Lève sinon.
 *
 * @throws {DomainError} `RM17_FUTURE_ADMINISTRATION_REFUSED` si la saisie est
 *   dans le futur — refus absolu, même avec `explicitlyConfirmed`.
 * @throws {DomainError} `RM17_TOO_OLD_REQUIRES_CONFIRMATION` si la saisie est
 *   au-delà de 24 h dans le passé ET `explicitlyConfirmed !== true`.
 */
export function ensureBackfillAllowed(options: BackfillOptions): void {
  const validation = validateBackfillTiming(options);

  switch (validation.validity.kind) {
    case 'on_time':
    case 'within_window':
      return;

    case 'future_refused':
      throw new DomainError(
        'RM17_FUTURE_ADMINISTRATION_REFUSED',
        'administeredAtUtc cannot be in the future: refused regardless of confirmation.',
        {
          administeredAtUtc: options.administeredAtUtc.toISOString(),
          recordedAtUtc: options.recordedAtUtc.toISOString(),
          aheadByMs: validation.validity.aheadBy,
        },
      );

    case 'too_old':
      if (options.explicitlyConfirmed === true) {
        return;
      }
      throw new DomainError(
        'RM17_TOO_OLD_REQUIRES_CONFIRMATION',
        `Backfill older than ${String(BACKFILL_MAX_WINDOW_HOURS)} h requires explicit confirmation.`,
        {
          administeredAtUtc: options.administeredAtUtc.toISOString(),
          recordedAtUtc: options.recordedAtUtc.toISOString(),
          lateByMs: validation.validity.lateBy,
          maxWindowHours: BACKFILL_MAX_WINDOW_HOURS,
        },
      );
  }
}
