import { DomainError } from '../errors';

/** Classification temporelle d'une prise par rapport à sa cible planifiée. */
export type DoseTiming =
  /** Dans la fenêtre [target - X, target + X] — confirmable normalement. */
  | 'on_time'
  /** Hors fenêtre mais rattrapable (target + X < t <= target + 24 h) — `source = backfill`. */
  | 'late_backfill'
  /** Plus de 24 h après la cible — refusée (RM17, RM2). */
  | 'too_late'
  /** Avant la fenêtre de confirmation (t < target - X) — refusée. */
  | 'too_early';

export const MIN_CONFIRMATION_WINDOW_MINUTES = 10;
export const MAX_CONFIRMATION_WINDOW_MINUTES = 120;
export const BACKFILL_HORIZON_MINUTES = 24 * 60;

/**
 * RM2 — classe une prise selon sa position relative à sa cible planifiée.
 *
 * La fenêtre `confirmationWindowMinutes` est configurable par foyer, bornée
 * à [10, 120]. En dehors de la fenêtre, une prise reste rattrapable jusqu'à
 * 24 h après la cible (RM17), avec `source = backfill`. Au-delà : refus.
 *
 * @throws {DomainError} `RM2_INVALID_WINDOW` si la fenêtre est hors bornes.
 */
export function classifyDoseTiming(params: {
  readonly targetAtUtc: Date;
  readonly administeredAtUtc: Date;
  readonly confirmationWindowMinutes: number;
}): DoseTiming {
  const { targetAtUtc, administeredAtUtc, confirmationWindowMinutes } = params;

  if (
    confirmationWindowMinutes < MIN_CONFIRMATION_WINDOW_MINUTES ||
    confirmationWindowMinutes > MAX_CONFIRMATION_WINDOW_MINUTES
  ) {
    throw new DomainError(
      'RM2_INVALID_WINDOW',
      `confirmationWindowMinutes must be in [${String(MIN_CONFIRMATION_WINDOW_MINUTES)}, ${String(MAX_CONFIRMATION_WINDOW_MINUTES)}], got ${String(confirmationWindowMinutes)}.`,
      { confirmationWindowMinutes },
    );
  }

  const deltaMinutes = (administeredAtUtc.getTime() - targetAtUtc.getTime()) / 60_000;

  if (deltaMinutes < -confirmationWindowMinutes) {
    return 'too_early';
  }
  if (deltaMinutes <= confirmationWindowMinutes) {
    return 'on_time';
  }
  if (deltaMinutes <= BACKFILL_HORIZON_MINUTES) {
    return 'late_backfill';
  }
  return 'too_late';
}

/**
 * RM2 — variante stricte : exige un timing acceptable (`on_time` ou
 * `late_backfill`) et lève sinon.
 *
 * @throws {DomainError} `RM2_TOO_EARLY` si la prise est antérieure à la fenêtre.
 * @throws {DomainError} `RM2_TOO_LATE` si la prise dépasse la fenêtre de rattrapage.
 * @throws {DomainError} `RM2_INVALID_WINDOW` si la fenêtre configurée est hors bornes.
 */
export function ensureDoseTimingAcceptable(params: {
  readonly targetAtUtc: Date;
  readonly administeredAtUtc: Date;
  readonly confirmationWindowMinutes: number;
}): Exclude<DoseTiming, 'too_early' | 'too_late'> {
  const timing = classifyDoseTiming(params);
  if (timing === 'too_early') {
    throw new DomainError('RM2_TOO_EARLY', 'Dose recorded before the confirmation window opens.', {
      targetAtUtc: params.targetAtUtc.toISOString(),
      administeredAtUtc: params.administeredAtUtc.toISOString(),
      confirmationWindowMinutes: params.confirmationWindowMinutes,
    });
  }
  if (timing === 'too_late') {
    throw new DomainError(
      'RM2_TOO_LATE',
      'Dose recorded more than 24 h after the target — backfill window closed.',
      {
        targetAtUtc: params.targetAtUtc.toISOString(),
        administeredAtUtc: params.administeredAtUtc.toISOString(),
      },
    );
  }
  return timing;
}
