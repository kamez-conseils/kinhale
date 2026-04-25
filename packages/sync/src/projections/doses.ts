import type { KinhaleDoc } from '../doc/schema.js';
import type {
  DoseAdministeredPayload,
  DoseEditedPayload,
  DoseReviewFlaggedPayload,
  DoseVoidedPayload,
} from '../events/types.js';
import { VOIDED_REASON_MAX_LENGTH } from '../events/types.js';

/**
 * Statut projeté d'une prise.
 *
 * - `recorded` : saisie normale, aucun conflit, non annulée.
 * - `pending_review` : RM6 a détecté un doublon potentiel (paire < 2 min sur
 *   la même pompe, même type). L'aidant doit confirmer ou annuler. Source :
 *   événements `DoseReviewFlagged` (KIN-073).
 * - `voided` : prise annulée logiquement (RM18 — KIN-094 / E4-S07). La
 *   priorité est **stricte** sur `pending_review` : un void postérieur à un
 *   `DoseReviewFlagged` prévaut. La prise reste visible (gris barré côté UI)
 *   et n'est jamais supprimée physiquement (audit trail intact).
 */
export type ProjectedDoseStatus = 'recorded' | 'pending_review' | 'voided';

export interface ProjectedDose extends DoseAdministeredPayload {
  /** ID de l'événement SignedEventRecord d'origine (`DoseAdministered`). */
  eventId: string;
  /** Timestamp UTC ms de l'événement signé (peut différer de administeredAtMs en cas de backfill). */
  occurredAtMs: number;
  /** Device ayant créé l'événement d'origine. */
  deviceId: string;
  /** Statut courant après application des `DoseEdited` / `DoseVoided` / `DoseReviewFlagged`. */
  status: ProjectedDoseStatus;
  /** Raison de l'annulation. Présente uniquement si `status === 'voided'`. */
  voidedReason?: string;
  /** Device qui a annulé. Présent uniquement si `status === 'voided'`. */
  voidedByDeviceId?: string;
  /** UTC ms de l'annulation. Présent uniquement si `status === 'voided'`. */
  voidedAtMs?: number;
}

/**
 * Filtre permissif sur un patch `DoseEdited` : retient uniquement les
 * champs valides typés. Évite qu'une valeur exotique (`null`, `NaN`,
 * tableau hétérogène) ne corrompe la projection.
 */
function sanitizeEditPatch(
  raw: DoseEditedPayload['patch'] | undefined,
): Partial<
  Pick<
    DoseAdministeredPayload,
    'administeredAtMs' | 'dosesAdministered' | 'symptoms' | 'circumstances' | 'freeFormTag'
  >
> {
  if (raw === null || raw === undefined || typeof raw !== 'object') return {};
  const out: Partial<
    Pick<
      DoseAdministeredPayload,
      'administeredAtMs' | 'dosesAdministered' | 'symptoms' | 'circumstances' | 'freeFormTag'
    >
  > = {};

  if (typeof raw.administeredAtMs === 'number' && Number.isFinite(raw.administeredAtMs)) {
    out.administeredAtMs = raw.administeredAtMs;
  }
  if (
    typeof raw.dosesAdministered === 'number' &&
    Number.isFinite(raw.dosesAdministered) &&
    raw.dosesAdministered >= 0
  ) {
    out.dosesAdministered = raw.dosesAdministered;
  }
  if (
    Array.isArray(raw.symptoms) &&
    raw.symptoms.every((s): s is string => typeof s === 'string')
  ) {
    out.symptoms = [...raw.symptoms];
  }
  if (
    Array.isArray(raw.circumstances) &&
    raw.circumstances.every((c): c is string => typeof c === 'string')
  ) {
    out.circumstances = [...raw.circumstances];
  }
  if (raw.freeFormTag === null || typeof raw.freeFormTag === 'string') {
    out.freeFormTag = raw.freeFormTag;
  }
  return out;
}

interface VoidEntry {
  readonly voidedReason: string;
  readonly voidedByDeviceId: string;
  readonly voidedAtMs: number;
}

/**
 * Dérive la liste ordonnée des prises depuis le document Automerge.
 * Tri : administeredAtMs décroissant (plus récent en premier).
 *
 * Application des événements (un seul passage de lecture, deux scans) :
 * 1. Pré-scan agrégant
 *    - les `DoseReviewFlagged` (RM6) → set des doseIds en `pending_review`,
 *    - les `DoseEdited` cumulés par doseId (le dernier patch reçu dans
 *      l'ordre du log Automerge gagne, par champ),
 *    - les `DoseVoided` par doseId (le premier `DoseVoided` reçu fait foi —
 *      un re-void supplémentaire n'apporte aucune information utile).
 * 2. Scan principal sur les `DoseAdministered` qui produit la projection
 *    finale en appliquant patches puis statut. Le `voided` prévaut
 *    strictement sur `pending_review`.
 *
 * **Audit trail intact** : la projection ne modifie rien dans le doc — elle
 * agrège seulement ce qu'elle lit. L'événement `DoseAdministered` original
 * subsiste, ainsi que la séquence chronologique des édits.
 *
 * **Zero-knowledge** : aucune donnée n'est loguée, les payloads JSON
 * malformés sont ignorés silencieusement.
 */
export function projectDoses(doc: KinhaleDoc): ProjectedDose[] {
  const editsByDoseId = new Map<string, ReturnType<typeof sanitizeEditPatch>>();
  const voidsByDoseId = new Map<string, VoidEntry>();
  // Pairs de doseIds liées par un DoseReviewFlagged. On résout `flaggedDoseIds`
  // en deuxième passe, après avoir collecté les voids — une dose dont tous ses
  // partenaires sont voidés est implicitement « la conservée » et repasse à
  // `recorded` (AC E4-S05).
  const flagPairs: Array<readonly string[]> = [];

  for (const event of doc.events) {
    if (event.type === 'DoseReviewFlagged') {
      let flagPayload: DoseReviewFlaggedPayload;
      try {
        flagPayload = JSON.parse(event.payloadJson) as DoseReviewFlaggedPayload;
      } catch {
        continue;
      }
      if (!Array.isArray(flagPayload.doseIds)) continue;
      const ids = flagPayload.doseIds.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );
      if (ids.length > 0) flagPairs.push(ids);
      continue;
    }

    if (event.type === 'DoseEdited') {
      let editPayload: DoseEditedPayload;
      try {
        editPayload = JSON.parse(event.payloadJson) as DoseEditedPayload;
      } catch {
        continue;
      }
      if (typeof editPayload.doseId !== 'string' || editPayload.doseId.length === 0) continue;
      const sanitized = sanitizeEditPatch(editPayload.patch);
      if (Object.keys(sanitized).length === 0) continue;
      const existing = editsByDoseId.get(editPayload.doseId) ?? {};
      // Le dernier patch reçu écrase les champs précédents (champs absents préservés).
      editsByDoseId.set(editPayload.doseId, { ...existing, ...sanitized });
      continue;
    }

    if (event.type === 'DoseVoided') {
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
      if (
        typeof voidPayload.voidedByDeviceId !== 'string' ||
        voidPayload.voidedByDeviceId.length === 0
      )
        continue;
      if (typeof voidPayload.voidedAtMs !== 'number' || !Number.isFinite(voidPayload.voidedAtMs))
        continue;
      // Premier void reçu = source de vérité (idempotent vis-à-vis d'un re-void).
      if (voidsByDoseId.has(voidPayload.doseId)) continue;
      voidsByDoseId.set(voidPayload.doseId, {
        voidedReason: trimmedReason,
        voidedByDeviceId: voidPayload.voidedByDeviceId,
        voidedAtMs: voidPayload.voidedAtMs,
      });
    }
  }

  // Résolution des flags : une dose reste flaggée si et seulement si au moins
  // un de ses partenaires de paire n'est pas voidé. Sinon, elle est
  // « la conservée » et repasse à `recorded` (AC E4-S05).
  const flaggedDoseIds = new Set<string>();
  for (const ids of flagPairs) {
    const liveIds = ids.filter((id) => !voidsByDoseId.has(id));
    if (liveIds.length >= 2) {
      for (const id of liveIds) flaggedDoseIds.add(id);
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

    // Application des édits.
    const patch = editsByDoseId.get(payload.doseId);
    const merged: DoseAdministeredPayload =
      patch === undefined ? payload : { ...payload, ...patch };

    // Détermination du statut. `voided` prime sur `pending_review`.
    const voidEntry = voidsByDoseId.get(payload.doseId);
    let status: ProjectedDoseStatus;
    if (voidEntry !== undefined) {
      status = 'voided';
    } else if (flaggedDoseIds.has(payload.doseId)) {
      status = 'pending_review';
    } else {
      status = 'recorded';
    }

    const projected: ProjectedDose = {
      ...merged,
      eventId: event.id,
      occurredAtMs: event.occurredAtMs,
      deviceId: event.deviceId,
      status,
    };
    if (voidEntry !== undefined) {
      projected.voidedReason = voidEntry.voidedReason;
      projected.voidedByDeviceId = voidEntry.voidedByDeviceId;
      projected.voidedAtMs = voidEntry.voidedAtMs;
    }
    result.push(projected);
  }
  return result.sort((a, b) => b.administeredAtMs - a.administeredAtMs);
}
