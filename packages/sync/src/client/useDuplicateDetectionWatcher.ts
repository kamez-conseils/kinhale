import * as React from 'react';
import { findDuplicateCandidates, type DoseSignature } from '@kinhale/domain';
import type { KinhaleDoc } from '../doc/schema.js';
import type { DoseReviewFlaggedPayload } from '../events/types.js';
import { projectDoses } from '../projections/doses.js';

/**
 * Paire canonique de doses en conflit, triée par `doseId` pour idempotence.
 */
export interface DuplicateDosePair {
  readonly doseIds: [string, string];
  readonly detectedAtMs: number;
}

export interface NotifyDuplicateArgs {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface UseDuplicateDetectionWatcherDeps {
  /** Hook plateforme : document Automerge courant. */
  readonly useDoc: () => KinhaleDoc | null;
  /**
   * Persiste un événement `DoseReviewFlagged` dans le doc Automerge.
   * Implémentation plateforme (append + signature). Le hook passe les
   * `doseIds` triés par ordre lexicographique pour canonicalité.
   */
  readonly flagDuplicatePair: (pair: DuplicateDosePair) => Promise<void>;
  /**
   * Émet la notification locale "double saisie". Chaînes déjà traduites
   * fournies par les wrappers apps. Optionnel : absence = no-op silencieux.
   *
   * **Interdit** : aucune donnée santé ne doit transiter par ces chaînes
   * (pas de nom de pompe, pas de dose, pas de prénom). Ligne rouge
   * dispositif médical (CLAUDE.md §À ne jamais faire).
   */
  readonly notifyDuplicate?: (args: NotifyDuplicateArgs) => Promise<void>;
  /** Horloge injectée — testable. */
  readonly now: () => Date;
  /** Titre déjà traduit de la notification (ex : "Kinhale"). */
  readonly duplicateTitle: string;
  /** Corps déjà traduit (ex : "Double saisie détectée"). */
  readonly duplicateBody: string;
}

/**
 * Construit une clé canonique pour une paire de doses (indépendante de
 * l'ordre des IDs).
 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Hook framework-agnostique qui applique RM6 à chaque changement du doc :
 * détecte les paires de prises du même type sur la même pompe dans une
 * fenêtre de moins de 2 min, puis :
 * 1. Émet un événement `DoseReviewFlagged` via `flagDuplicatePair`.
 * 2. Émet une notification locale "double saisie" (chaînes i18n fournies).
 *
 * Garde-fous :
 * - Lit les `DoseReviewFlagged` déjà présents dans le doc pour ne pas
 *   re-flaguer une paire déjà connue (idempotence cross-device).
 * - Cache local `flaggedPairsRef` pour éviter les doublons quand le hook
 *   rerender avec le même doc avant que le flag ait été appliqué (latence
 *   Automerge).
 * - Aucun tick périodique : la détection se fait uniquement au changement
 *   du doc (moins d'empreinte CPU qu'un polling).
 *
 * Principe zero-knowledge : le hook lit uniquement des données déjà
 * présentes en mémoire (doc déchiffré localement). Aucune donnée santé
 * n'est loguée ; la notification porte uniquement les chaînes i18n
 * fournies par le wrapper (garantie par l'interface).
 *
 * Refs: KIN-73, E7-S03, RM6 (§4 SPECS), CLAUDE.md.
 */
export function useDuplicateDetectionWatcher(deps: UseDuplicateDetectionWatcherDeps): void {
  const doc = deps.useDoc();

  // Cache local des paires déjà traitées localement pour éviter un double
  // flag quand le doc rerender avant la réconciliation Automerge.
  const flaggedPairsRef = React.useRef<Set<string>>(new Set());

  // Latest ref pattern pour stabiliser l'identité des deps dans l'effet.
  const flagDuplicatePairRef = React.useRef(deps.flagDuplicatePair);
  const notifyDuplicateRef = React.useRef(deps.notifyDuplicate);
  const nowRef = React.useRef(deps.now);
  const titleRef = React.useRef(deps.duplicateTitle);
  const bodyRef = React.useRef(deps.duplicateBody);
  flagDuplicatePairRef.current = deps.flagDuplicatePair;
  notifyDuplicateRef.current = deps.notifyDuplicate;
  nowRef.current = deps.now;
  titleRef.current = deps.duplicateTitle;
  bodyRef.current = deps.duplicateBody;

  React.useEffect(() => {
    if (doc === null) return undefined;

    // 1. Agréger les paires déjà flaggées dans le doc (DoseReviewFlagged).
    const alreadyFlaggedPairs = new Set<string>();
    for (const event of doc.events) {
      if (event.type !== 'DoseReviewFlagged') continue;
      let payload: DoseReviewFlaggedPayload;
      try {
        payload = JSON.parse(event.payloadJson) as DoseReviewFlaggedPayload;
      } catch {
        continue;
      }
      if (!Array.isArray(payload.doseIds) || payload.doseIds.length < 2) continue;
      const [a, b] = payload.doseIds;
      if (typeof a !== 'string' || typeof b !== 'string') continue;
      alreadyFlaggedPairs.add(pairKey(a, b));
    }

    // 2. Projeter les doses et construire les DoseSignature pour RM6.
    //
    //    Horodatage : on utilise `occurredAtMs` (instant de création de
    //    l'événement signé côté client) plutôt que `administeredAtMs`
    //    (instant déclaré de la prise, potentiellement rétroactif via
    //    backfill RM17). Un backfill d'une ancienne prise ne doit pas
    //    flagger les prises actuelles proches de son `administeredAtMs`.
    //    `occurredAtMs` est le meilleur proxy de `recordedAtUtc` (serveur)
    //    tant que RM14 n'est pas branché côté client. Refs: kz-review-KIN-073 §M1.
    const doses = projectDoses(doc);
    const signatures: DoseSignature[] = doses.map((d) => ({
      doseId: d.doseId,
      pumpId: d.pumpId,
      type: d.doseType,
      recordedAtUtc: new Date(d.occurredAtMs),
    }));

    // 3. Pour chaque paire (i, j > i), chercher un conflit RM6. Itérer
    //    j = i+1 au lieu de filtrer évite la double visite de chaque paire
    //    et divise le travail par 2. Complexité O(n²) mais acceptable pour
    //    n ≤ quelques milliers de doses (TODO: indexation par bucket
    //    minute/pompe/type pour n plus grand — ticket de suivi).
    //    Refs: kz-review-KIN-073 §M2.
    const nowMs = nowRef.current().getTime();
    const pairsToFlag: DuplicateDosePair[] = [];

    for (let i = 0; i < signatures.length; i++) {
      const candidate = signatures[i];
      if (candidate === undefined) continue;
      for (let j = i + 1; j < signatures.length; j++) {
        const other = signatures[j];
        if (other === undefined) continue;
        const conflicts = findDuplicateCandidates(candidate, [other]);
        if (conflicts.length === 0) continue;
        const key = pairKey(candidate.doseId, other.doseId);
        if (alreadyFlaggedPairs.has(key)) continue;
        if (flaggedPairsRef.current.has(key)) continue;
        flaggedPairsRef.current.add(key);
        pairsToFlag.push({
          doseIds: canonicalPair(candidate.doseId, other.doseId),
          detectedAtMs: nowMs,
        });
      }
    }

    if (pairsToFlag.length === 0) return undefined;

    void (async () => {
      for (const pair of pairsToFlag) {
        try {
          await flagDuplicatePairRef.current(pair);
        } catch {
          // L'écriture a échoué (ex. device verrouillé). On retire la
          // paire du cache pour permettre un retry au prochain cycle.
          flaggedPairsRef.current.delete(pairKey(pair.doseIds[0], pair.doseIds[1]));
          continue;
        }

        // Notification OS : id stable par paire pour dédoublonnage natif.
        const notifId = `dup:${pair.doseIds[0]}:${pair.doseIds[1]}`;
        try {
          await notifyDuplicateRef.current?.({
            id: notifId,
            title: titleRef.current,
            body: bodyRef.current,
          });
        } catch {
          // La notification est best-effort : l'utilisateur verra le
          // statut `pending_review` dans l'UI même sans notif OS.
        }
      }
    })();

    // Pas de cleanup du cache ici : `flaggedPairsRef` persiste entre les
    // re-runs de l'effet déclenchés par un changement du doc (chaque
    // mutation crée un nouveau doc référence). Purger ici déclencherait
    // un re-flag au tick suivant tant qu'Automerge n'a pas encore propagé
    // le flag nouvellement appendé. Le cache est vidé automatiquement au
    // démontage du composant (garbage collection). Un ticket de suivi
    // pourra traiter le cas spécifique d'une bascule de foyer (rarissime
    // en session continue). Refs: kz-securite-KIN-073 §M3.
    return undefined;
  }, [doc]);
}
