import type { KinhaleDoc } from '../doc/schema.js';
import type { DoseAdministeredPayload, DoseReviewFlaggedPayload } from '../events/types.js';

/**
 * Statut projeté d'une prise.
 *
 * - `recorded` : saisie normale, aucun conflit.
 * - `pending_review` : RM6 a détecté un doublon potentiel (paire < 2 min sur
 *   la même pompe, même type). L'aidant doit confirmer ou annuler.
 *
 * Le statut `voided` sera ajouté avec E4-S07 (annulation explicite) — pour
 * l'instant, seules les deux valeurs ci-dessus sont produites par la
 * projection.
 */
export type ProjectedDoseStatus = 'recorded' | 'pending_review';

export interface ProjectedDose extends DoseAdministeredPayload {
  /** ID de l'événement SignedEventRecord. */
  eventId: string;
  /** Timestamp UTC ms de l'événement signé (peut différer de administeredAtMs en cas de backfill). */
  occurredAtMs: number;
  /** Device ayant créé l'événement. */
  deviceId: string;
  /** Statut de la dose (RM6 pour `pending_review`). */
  status: ProjectedDoseStatus;
}

/**
 * Dérive la liste ordonnée des prises depuis le document Automerge.
 * Tri : administeredAtMs décroissant (plus récent en premier).
 *
 * Les événements `DoseReviewFlagged` sont lus pour enrichir le `status` de
 * chaque dose référencée (RM6). Un flag quel que soit son ordre de
 * réception bascule la dose en `pending_review` — c'est idempotent.
 */
export function projectDoses(doc: KinhaleDoc): ProjectedDose[] {
  const flaggedDoseIds = new Set<string>();
  for (const event of doc.events) {
    if (event.type !== 'DoseReviewFlagged') continue;
    let flagPayload: DoseReviewFlaggedPayload;
    try {
      flagPayload = JSON.parse(event.payloadJson) as DoseReviewFlaggedPayload;
    } catch {
      continue;
    }
    if (!Array.isArray(flagPayload.doseIds)) continue;
    for (const id of flagPayload.doseIds) {
      if (typeof id === 'string' && id.length > 0) {
        flaggedDoseIds.add(id);
      }
    }
  }

  const result: ProjectedDose[] = [];
  for (const event of doc.events) {
    if (event.type !== 'DoseAdministered') continue;
    let payload: DoseAdministeredPayload;
    try {
      payload = JSON.parse(event.payloadJson) as DoseAdministeredPayload;
    } catch {
      // payload JSON invalide — ignoré silencieusement, aucun log (zero-knowledge)
      continue;
    }
    if (
      typeof payload.doseType !== 'string' ||
      (payload.doseType !== 'maintenance' && payload.doseType !== 'rescue') ||
      !Array.isArray(payload.symptoms) ||
      !Array.isArray(payload.circumstances)
    ) {
      continue;
    }
    result.push({
      ...payload,
      eventId: event.id,
      occurredAtMs: event.occurredAtMs,
      deviceId: event.deviceId,
      status: flaggedDoseIds.has(payload.doseId) ? 'pending_review' : 'recorded',
    });
  }
  return result.sort((a, b) => b.administeredAtMs - a.administeredAtMs);
}
