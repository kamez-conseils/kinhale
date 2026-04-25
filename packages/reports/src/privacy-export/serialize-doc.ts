/**
 * Sérialisation déterministe du document Automerge pour l'export RGPD/Loi 25.
 *
 * Cette fonction lit le doc local et produit un `SerializedDoc` plat qui :
 * - couvre **toutes** les données saisies par l'utilisateur (art. 20 RGPD —
 *   contrairement au rapport médecin qui filtre `freeFormTag` cf. RM8) ;
 * - est trié de façon stable pour garantir la **reproductibilité** du hash
 *   SHA-256 (un médecin / RPRP peut recalculer depuis le doc Automerge).
 *
 * Pure : aucun effet de bord, aucun appel réseau, aucun `Date.now()` caché.
 *
 * Refs: ADR-D14, KIN-085, E9-S02.
 */

import type { KinhaleDoc } from '@kinhale/sync';
import {
  projectCaregivers,
  projectChild,
  projectDoses,
  projectPlan,
  projectPumps,
} from '@kinhale/sync';
import type {
  SerializedCaregiver,
  SerializedChild,
  SerializedDoc,
  SerializedDose,
  SerializedPlan,
  SerializedPump,
} from './types.js';

/**
 * Construit le snapshot sérialisable du document Automerge.
 *
 * @param doc - Document Automerge déchiffré localement.
 * @param exportedAtMs - Horodatage UTC ms d'export (recopié dans le snapshot).
 *   Ne pas appeler `Date.now()` ici pour préserver la pureté.
 */
export function serializeDocForExport(doc: KinhaleDoc, exportedAtMs: number): SerializedDoc {
  return {
    householdId: doc.householdId,
    exportedAtMs,
    schemaVersion: 1,
    child: serializeChild(doc),
    caregivers: serializeCaregivers(doc),
    pumps: serializePumps(doc),
    plans: serializePlans(doc),
    doses: serializeDoses(doc),
  };
}

function serializeChild(doc: KinhaleDoc): SerializedChild | null {
  const projected = projectChild(doc);
  if (projected === null) return null;
  return {
    childId: projected.childId,
    firstName: projected.firstName,
    birthYear: projected.birthYear,
    recordedByDeviceId: projected.deviceId,
    recordedAtMs: projected.occurredAtMs,
  };
}

/**
 * Caregivers triés par `caregiverId` (UUID lexicographique stable).
 * Le tri par `invitedAtMs` ne suffirait pas — deux invitations à la
 * même milliseconde donneraient un ordre instable.
 */
function serializeCaregivers(doc: KinhaleDoc): ReadonlyArray<SerializedCaregiver> {
  const projected = projectCaregivers(doc);
  return projected
    .map(
      (c): SerializedCaregiver => ({
        caregiverId: c.caregiverId,
        role: c.role,
        displayName: c.displayName,
        status: c.status,
        invitedAtMs: c.invitedAtMs,
        acceptedAtMs: c.acceptedAtMs,
      }),
    )
    .sort((a, b) => (a.caregiverId < b.caregiverId ? -1 : a.caregiverId > b.caregiverId ? 1 : 0));
}

/**
 * Pompes triées par `pumpId`. `registeredAtMs` est l'`occurredAtMs` de
 * l'événement `PumpReplaced` correspondant (la pompe a été enregistrée /
 * remplacée à ce moment-là). Note : `projectPumps` n'expose pas cet
 * `occurredAtMs` directement — on lit le doc.
 */
function serializePumps(doc: KinhaleDoc): ReadonlyArray<SerializedPump> {
  const projected = projectPumps(doc);
  return projected
    .map(
      (p): SerializedPump => ({
        pumpId: p.pumpId,
        name: p.name,
        pumpType: p.pumpType,
        totalDoses: p.totalDoses,
        dosesRemaining: p.dosesRemaining,
        expiresAtMs: p.expiresAtMs,
        registeredAtMs: p.occurredAtMs,
      }),
    )
    .sort((a, b) => (a.pumpId < b.pumpId ? -1 : a.pumpId > b.pumpId ? 1 : 0));
}

/**
 * Plan unique projeté (RM13 → un seul plan actif). Le retour est un tableau
 * pour cohérence avec une éventuelle évolution v1.1 multi-plans, et pour
 * un consommateur RGPD qui s'attend à une liste.
 */
function serializePlans(doc: KinhaleDoc): ReadonlyArray<SerializedPlan> {
  const projected = projectPlan(doc);
  if (projected === null) return [];
  return [
    {
      planId: projected.planId,
      pumpId: projected.pumpId,
      // Recopie défensive (évite la fuite de référence vers la projection).
      scheduledHoursUtc: [...projected.scheduledHoursUtc],
      startAtMs: projected.startAtMs,
      endAtMs: projected.endAtMs,
      recordedAtMs: projected.occurredAtMs,
    },
  ];
}

/**
 * Doses triées par `(administeredAtMs ASC, doseId ASC)`. L'ordre ascendant
 * est plus naturel pour un consommateur tiers (lecture chronologique) que
 * celui de `projectDoses` qui retourne du décroissant pour l'UI.
 */
function serializeDoses(doc: KinhaleDoc): ReadonlyArray<SerializedDose> {
  const projected = projectDoses(doc);
  return projected
    .map(
      (d): SerializedDose => ({
        doseId: d.doseId,
        pumpId: d.pumpId,
        childId: d.childId,
        caregiverId: d.caregiverId,
        administeredAtMs: d.administeredAtMs,
        doseType: d.doseType,
        dosesAdministered: d.dosesAdministered,
        symptoms: [...d.symptoms],
        circumstances: [...d.circumstances],
        freeFormTag: d.freeFormTag,
        status: d.status,
        recordedByDeviceId: d.deviceId,
        recordedAtMs: d.occurredAtMs,
      }),
    )
    .sort((a, b) => {
      if (a.administeredAtMs !== b.administeredAtMs) return a.administeredAtMs - b.administeredAtMs;
      return a.doseId < b.doseId ? -1 : a.doseId > b.doseId ? 1 : 0;
    });
}

/**
 * Sérialise un objet en JSON canonique avec :
 * - clés triées alphabétiquement à chaque niveau,
 * - indentation 2 espaces (lisibilité humaine),
 * - terminateur `\n` final pour un diff git friendly.
 *
 * Cette représentation est **déterministe** — appelée deux fois sur le même
 * objet, elle produit la même chaîne, donc le même hash SHA-256.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(value, sortKeysReplacer, 2) + '\n';
}

function sortKeysReplacer(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    sorted[k] = obj[k];
  }
  return sorted;
}
