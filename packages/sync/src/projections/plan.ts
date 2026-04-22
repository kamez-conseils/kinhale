import type { KinhaleDoc } from '../doc/schema.js';
import type { PlanUpdatedPayload } from '../events/types.js';

export interface ProjectedPlan extends PlanUpdatedPayload {
  /** ID de l'événement SignedEventRecord. */
  eventId: string;
  /** Timestamp UTC ms de l'événement signé. */
  occurredAtMs: number;
}

/**
 * Dérive le plan de traitement actif depuis le document Automerge.
 * Retourne le plus récent PlanUpdated, ou null si aucun.
 */
export function projectPlan(doc: KinhaleDoc): ProjectedPlan | null {
  let latest: ProjectedPlan | null = null;
  for (const event of doc.events) {
    if (event.type !== 'PlanUpdated') continue;
    let payload: PlanUpdatedPayload;
    try {
      payload = JSON.parse(event.payloadJson) as PlanUpdatedPayload;
    } catch {
      // payload JSON invalide — ignoré silencieusement, aucun log (zero-knowledge)
      continue;
    }
    if (
      typeof payload.planId !== 'string' ||
      typeof payload.pumpId !== 'string' ||
      !Array.isArray(payload.scheduledHoursUtc) ||
      typeof payload.startAtMs !== 'number'
    ) {
      continue;
    }
    const projected: ProjectedPlan = {
      ...payload,
      eventId: event.id,
      occurredAtMs: event.occurredAtMs,
    };
    if (latest === null || projected.occurredAtMs > latest.occurredAtMs) {
      latest = projected;
    }
  }
  return latest;
}
