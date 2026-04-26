import type { KinhaleDoc } from '../doc/schema.js';
import type {
  DoseAdministeredPayload,
  DoseVoidedPayload,
  PumpReplacedPayload,
} from '../events/types.js';
import { VOIDED_REASON_MAX_LENGTH } from '../events/types.js';

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
 * dosesRemaining = totalDoses - nombre de DoseAdministered **non voidées**
 * liées à cette pompe (RM18 / E4-S07 — un void ré-incrémente le décompte).
 * isExpired = expiresAtMs < Date.now().
 */
export function projectPumps(doc: KinhaleDoc): ProjectedPump[] {
  // 1. Pré-scan des annulations valides → set de doseIds voidés.
  const voidedDoseIds = new Set<string>();
  for (const event of doc.events) {
    if (event.type !== 'DoseVoided') continue;
    let voidPayload: DoseVoidedPayload;
    try {
      voidPayload = JSON.parse(event.payloadJson) as DoseVoidedPayload;
    } catch {
      continue;
    }
    if (typeof voidPayload.doseId !== 'string' || voidPayload.doseId.length === 0) continue;
    if (typeof voidPayload.voidedReason !== 'string') continue;
    const trimmedReason = voidPayload.voidedReason.trim();
    if (trimmedReason.length === 0 || trimmedReason.length > VOIDED_REASON_MAX_LENGTH) continue;
    voidedDoseIds.add(voidPayload.doseId);
  }

  // 2. Comptage des prises par pumpId, en excluant les doses voidées.
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
    if (typeof payload.doseId === 'string' && voidedDoseIds.has(payload.doseId)) continue;
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
