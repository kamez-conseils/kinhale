import type { KinhaleDoc } from '../doc/schema.js';
import type { PumpReplacedPayload, DoseAdministeredPayload } from '../events/types.js';

export interface ProjectedPump {
  pumpId: string;
  name: string;
  pumpType: 'maintenance' | 'rescue';
  totalDoses: number;
  dosesRemaining: number;
  expiresAtMs: number | null;
  isExpired: boolean;
  eventId: string;
  occurredAtMs: number;
}

/**
 * Dérive la liste des pompes depuis le document Automerge.
 * dosesRemaining = totalDoses - nombre de DoseAdministered liées à cette pompe.
 * isExpired = expiresAtMs < Date.now().
 */
export function projectPumps(doc: KinhaleDoc): ProjectedPump[] {
  // Comptage des prises par pumpId
  const doseCountByPumpId = new Map<string, number>();
  for (const event of doc.events) {
    if (event.type !== 'DoseAdministered') continue;
    let payload: DoseAdministeredPayload;
    try {
      payload = JSON.parse(event.payloadJson) as DoseAdministeredPayload;
    } catch {
      // payload JSON invalide — ignoré silencieusement, aucun log (zero-knowledge)
      continue;
    }
    if (typeof payload.pumpId !== 'string') continue;
    doseCountByPumpId.set(payload.pumpId, (doseCountByPumpId.get(payload.pumpId) ?? 0) + 1);
  }

  const now = Date.now();
  const result: ProjectedPump[] = [];

  for (const event of doc.events) {
    if (event.type !== 'PumpReplaced') continue;
    let payload: PumpReplacedPayload;
    try {
      payload = JSON.parse(event.payloadJson) as PumpReplacedPayload;
    } catch {
      // payload JSON invalide — ignoré silencieusement, aucun log (zero-knowledge)
      continue;
    }
    if (
      typeof payload.pumpId !== 'string' ||
      typeof payload.name !== 'string' ||
      (payload.pumpType !== 'maintenance' && payload.pumpType !== 'rescue') ||
      typeof payload.totalDoses !== 'number'
    ) {
      continue;
    }
    const dosesUsed = doseCountByPumpId.get(payload.pumpId) ?? 0;
    result.push({
      pumpId: payload.pumpId,
      name: payload.name,
      pumpType: payload.pumpType as 'maintenance' | 'rescue',
      totalDoses: payload.totalDoses,
      dosesRemaining: Math.max(0, payload.totalDoses - dosesUsed),
      expiresAtMs: payload.expiresAtMs,
      isExpired: payload.expiresAtMs !== null && payload.expiresAtMs < now,
      eventId: event.id,
      occurredAtMs: event.occurredAtMs,
    });
  }

  return result;
}
