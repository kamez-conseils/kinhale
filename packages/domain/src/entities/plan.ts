import type { Pump } from './pump';

/** Statut d'un plan de traitement. */
export type PlanStatus = 'active' | 'paused' | 'archived';

/**
 * Plan de traitement — associe une pompe de fond à une posologie. Un plan
 * n'est **jamais** attaché à une pompe de type `rescue` (RM3). Au plus un
 * plan `active` par pompe à un instant T (specs §3.5).
 */
export interface Plan {
  readonly id: string;
  readonly householdId: string;
  readonly pumpId: string;
  readonly status: PlanStatus;
  /** Doses planifiées par jour (ex : 2 = matin + soir). */
  readonly dosesPerDay: number;
  /** Heures cibles UTC, exprimées en minutes depuis minuit local (0-1439). */
  readonly targetMinutesOfDayLocal: ReadonlyArray<number>;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly createdAt: Date;
}

/**
 * Raccourci : un plan peut-il être attaché à cette pompe ? RM3.
 * (Valeur booléenne — la règle RM3 dans `rules/` exige à la place.)
 */
export function isPumpEligibleForPlan(pump: Pump): boolean {
  return pump.type === 'maintenance';
}
