import type { Pump } from '../entities/pump';
import { DomainError } from '../errors';

/**
 * RM3 — Un plan de traitement ne peut être attaché qu'à une pompe de fond
 * (`maintenance`). Les pompes de secours (`rescue`) sont prises ponctuellement
 * et ne portent aucune planification.
 *
 * @throws {DomainError} `RM3_PLAN_ON_RESCUE_PUMP` si la pompe est de type `rescue`.
 */
export function ensureCanAttachPlanToPump(pump: Pump): void {
  if (pump.type === 'rescue') {
    throw new DomainError(
      'RM3_PLAN_ON_RESCUE_PUMP',
      `Cannot attach a treatment plan to rescue pump ${pump.id}.`,
      { pumpId: pump.id, pumpType: pump.type },
    );
  }
}
