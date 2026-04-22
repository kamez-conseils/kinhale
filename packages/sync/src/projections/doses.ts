import type { KinhaleDoc } from '../doc/schema.js';
import type { DoseAdministeredPayload } from '../events/types.js';

export interface ProjectedDose extends DoseAdministeredPayload {
  /** ID de l'événement SignedEventRecord. */
  eventId: string;
  /** Timestamp UTC ms de l'événement signé (peut différer de administeredAtMs en cas de backfill). */
  occurredAtMs: number;
  /** Device ayant créé l'événement. */
  deviceId: string;
}

/**
 * Dérive la liste ordonnée des prises depuis le document Automerge.
 * Tri : administeredAtMs décroissant (plus récent en premier).
 */
export function projectDoses(doc: KinhaleDoc): ProjectedDose[] {
  const result: ProjectedDose[] = [];
  for (const event of doc.events) {
    if (event.type !== 'DoseAdministered') continue;
    const payload = JSON.parse(event.payloadJson) as DoseAdministeredPayload;
    result.push({
      ...payload,
      eventId: event.id,
      occurredAtMs: event.occurredAtMs,
      deviceId: event.deviceId,
    });
  }
  return result.sort((a, b) => b.administeredAtMs - a.administeredAtMs);
}
