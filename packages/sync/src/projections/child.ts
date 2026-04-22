import type { KinhaleDoc } from '../doc/schema.js';
import type { ChildRegisteredPayload } from '../events/types.js';

export interface ProjectedChild extends ChildRegisteredPayload {
  /** ID de l'événement SignedEventRecord. */
  eventId: string;
  /** Timestamp UTC ms de l'événement signé. */
  occurredAtMs: number;
  /** Device ayant créé l'événement. */
  deviceId: string;
}

/**
 * Dérive l'enfant du foyer depuis le document Automerge.
 * RM13 : un seul enfant par foyer — retourne le plus récent ChildRegistered.
 */
export function projectChild(doc: KinhaleDoc): ProjectedChild | null {
  let latest: ProjectedChild | null = null;
  for (const event of doc.events) {
    if (event.type !== 'ChildRegistered') continue;
    let payload: ChildRegisteredPayload;
    try {
      payload = JSON.parse(event.payloadJson) as ChildRegisteredPayload;
    } catch {
      // payload JSON invalide — ignoré silencieusement, aucun log (zero-knowledge)
      continue;
    }
    if (
      typeof payload.childId !== 'string' ||
      typeof payload.firstName !== 'string' ||
      typeof payload.birthYear !== 'number'
    ) {
      continue;
    }
    const projected: ProjectedChild = {
      ...payload,
      eventId: event.id,
      occurredAtMs: event.occurredAtMs,
      deviceId: event.deviceId,
    };
    if (latest === null || projected.occurredAtMs > latest.occurredAtMs) {
      latest = projected;
    }
  }
  return latest;
}
