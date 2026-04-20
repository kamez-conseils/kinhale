import type { Pump, PumpStatus } from '../entities/pump';
import { DomainError } from '../errors';

/**
 * Seuil d'alerte par défaut (en doses restantes) en dessous duquel une pompe
 * bascule en statut `low` et déclenche une notification `pump_low`. Valeur
 * configurable par foyer via `Foyer.pump_alert_threshold_doses` (SPECS §3.2).
 */
export const DEFAULT_PUMP_ALERT_THRESHOLD_DOSES = 20;

/**
 * Événements métier émis par {@link applyConfirmedDoseToPump} pour signaler
 * les transitions d'état de la pompe. Consommés côté `apps/api` pour mapper
 * vers les notifications `pump_low` et `pump_emptied` (SPECS §3.10).
 *
 * - `pump_low_threshold_crossed` : la pompe vient de franchir (descendant) le
 *   seuil d'alerte configuré. Émis **une seule fois** au franchissement, pas à
 *   chaque prise en dessous du seuil.
 * - `pump_emptied` : la pompe vient d'atteindre `dosesRemaining = 0`. Émis
 *   une fois au passage à l'état vide.
 */
export type PumpCountdownEvent = 'pump_low_threshold_crossed' | 'pump_emptied';

/**
 * Résultat de l'application d'une prise `confirmed` sur une pompe : nouvelle
 * instance de pompe (décrémentée + statut mis à jour) et liste d'événements
 * métier déclenchés par cette prise.
 */
export interface PumpCountdownUpdate {
  readonly pump: Pump;
  readonly events: ReadonlyArray<PumpCountdownEvent>;
}

/** Statuts sur lesquels un décompte est autorisé. */
const USABLE_STATUSES: ReadonlySet<PumpStatus> = new Set<PumpStatus>(['active', 'low']);

/**
 * RM7 — applique une prise `confirmed` à une pompe : décrémente
 * `dosesRemaining` et calcule les transitions de statut (`active` → `low` →
 * `empty`) ainsi que les événements à propager (`pump_low_threshold_crossed`,
 * `pump_emptied`).
 *
 * Sémantique de déclenchement :
 * - `pump_low_threshold_crossed` n'est émis **qu'une seule fois**, au moment
 *   où la pompe franchit le seuil (ancien remaining > seuil ET nouveau
 *   remaining ≤ seuil). Pas réémis aux prises suivantes sous le seuil.
 * - Si la prise amène directement la pompe à zéro, seul `pump_emptied` est
 *   émis (pas de double événement low + empty).
 * - `dosesRemaining` est clampé à 0 : un décrément qui dépasserait zéro amène
 *   la pompe à l'état `empty` sans valeur négative.
 *
 * Fonction **pure** : aucune mutation des arguments, retour d'une nouvelle
 * instance de pompe. Aucun I/O, aucune lecture d'horloge.
 *
 * @throws {DomainError} `RM7_INVALID_DOSES_AMOUNT` si `dosesAdministered` ≤ 0
 *   ou non entier.
 * @throws {DomainError} `RM7_INVALID_THRESHOLD` si `alertThresholdDoses` ≤ 0.
 * @throws {DomainError} `RM7_PUMP_ALREADY_EMPTY` si la pompe est déjà `empty`.
 * @throws {DomainError} `RM7_PUMP_NOT_USABLE` si la pompe est `expired` ou
 *   `archived` (état qui interdit toute nouvelle prise).
 */
export function applyConfirmedDoseToPump(options: {
  readonly pump: Pump;
  readonly dosesAdministered: number;
  readonly alertThresholdDoses?: number;
}): PumpCountdownUpdate {
  const { pump, dosesAdministered } = options;
  const threshold = options.alertThresholdDoses ?? DEFAULT_PUMP_ALERT_THRESHOLD_DOSES;

  if (!Number.isInteger(dosesAdministered) || dosesAdministered <= 0) {
    throw new DomainError(
      'RM7_INVALID_DOSES_AMOUNT',
      `dosesAdministered must be a positive integer, got ${String(dosesAdministered)}.`,
      { dosesAdministered },
    );
  }

  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new DomainError(
      'RM7_INVALID_THRESHOLD',
      `alertThresholdDoses must be strictly positive, got ${String(threshold)}.`,
      { alertThresholdDoses: threshold },
    );
  }

  if (pump.status === 'empty') {
    throw new DomainError(
      'RM7_PUMP_ALREADY_EMPTY',
      `Pump ${pump.id} is already empty; cannot record a new dose against it.`,
      { pumpId: pump.id },
    );
  }

  if (!USABLE_STATUSES.has(pump.status)) {
    throw new DomainError(
      'RM7_PUMP_NOT_USABLE',
      `Pump ${pump.id} has status ${pump.status}; only active and low pumps accept doses.`,
      { pumpId: pump.id, pumpStatus: pump.status },
    );
  }

  const previousRemaining = pump.dosesRemaining;
  const rawNext = previousRemaining - dosesAdministered;
  const newRemaining = rawNext < 0 ? 0 : rawNext;

  const events: PumpCountdownEvent[] = [];
  let nextStatus: PumpStatus = pump.status;

  if (newRemaining <= 0) {
    nextStatus = 'empty';
    events.push('pump_emptied');
  } else if (newRemaining <= threshold && previousRemaining > threshold) {
    nextStatus = 'low';
    events.push('pump_low_threshold_crossed');
  }

  const updatedPump: Pump = {
    ...pump,
    dosesRemaining: newRemaining,
    status: nextStatus,
  };

  return { pump: updatedPump, events };
}

/**
 * RM7 — vrai ssi la pompe est considérée « basse » : statut déjà `low`, OU
 * statut `active` avec `dosesRemaining` inférieur ou égal au seuil. Une pompe
 * `empty` n'est **pas** considérée « low » (elle est vide — état distinct).
 * Les statuts non utilisables (`expired`, `archived`) renvoient `false` : ils
 * ne participent plus au cycle de vie des alertes.
 */
export function isPumpLow(
  pump: Pump,
  threshold: number = DEFAULT_PUMP_ALERT_THRESHOLD_DOSES,
): boolean {
  if (pump.status === 'low') {
    return true;
  }
  if (pump.status !== 'active') {
    return false;
  }
  return pump.dosesRemaining <= threshold;
}

/**
 * RM7 — vrai ssi la pompe est en statut `empty`. La comparaison se fait sur
 * le statut (source de vérité), pas uniquement sur `dosesRemaining`.
 */
export function isPumpEmpty(pump: Pump): boolean {
  return pump.status === 'empty';
}
