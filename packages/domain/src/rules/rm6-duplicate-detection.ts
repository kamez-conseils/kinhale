import type { Dose, DoseType } from '../entities/dose';

/**
 * Fenêtre (exclusive) en minutes sous laquelle deux prises du même type sur la
 * même pompe sont considérées comme une double saisie potentielle (RM6).
 *
 * La comparaison est **strictement inférieure** à cette valeur : deux prises
 * séparées d'exactement 2 minutes ne sont PAS en conflit.
 */
export const DUPLICATE_DETECTION_WINDOW_MINUTES = 2;

const DUPLICATE_DETECTION_WINDOW_MS = DUPLICATE_DETECTION_WINDOW_MINUTES * 60_000;

/**
 * Signature minimale d'une prise requise par la détection RM6. Volontairement
 * réduite au strict nécessaire pour être alimentée depuis n'importe quelle
 * source (document Automerge, index mémoire, etc.) sans couplage à l'entité
 * `Dose` complète.
 *
 * Le temps de référence est `recordedAtUtc` (horodatage serveur — RM14), pas
 * `administeredAtUtc` : RM6 détecte la collision de **saisie** en temps réel.
 */
export interface DoseSignature {
  readonly doseId: string;
  readonly pumpId: string;
  readonly type: DoseType;
  readonly recordedAtUtc: Date;
}

/**
 * RM6 — détecte les prises existantes en collision avec une prise candidate.
 *
 * Deux prises sont en conflit lorsque :
 * - elles portent sur la **même pompe** (`pumpId`),
 * - elles sont du **même type** (`maintenance` ou `rescue`),
 * - l'écart absolu entre leurs `recordedAtUtc` est **strictement inférieur**
 *   à {@link DUPLICATE_DETECTION_WINDOW_MINUTES} minutes.
 *
 * La candidate elle-même est filtrée par `doseId` : si elle apparaît dans
 * `existing`, elle n'est jamais comptée comme son propre doublon. La fonction
 * est pure et ne mute aucun argument.
 *
 * RM6 ne **rejette** pas la prise candidate : elle documente le conflit.
 * L'appelant est responsable de basculer les deux prises en `pending_review`
 * (voir {@link markDosesAsPendingReview}).
 */
export function findDuplicateCandidates(
  candidate: DoseSignature,
  existing: readonly DoseSignature[],
): readonly DoseSignature[] {
  const candidateMs = candidate.recordedAtUtc.getTime();

  return existing.filter((other) => {
    if (other.doseId === candidate.doseId) {
      return false;
    }
    if (other.pumpId !== candidate.pumpId) {
      return false;
    }
    if (other.type !== candidate.type) {
      return false;
    }
    const deltaMs = Math.abs(other.recordedAtUtc.getTime() - candidateMs);
    return deltaMs < DUPLICATE_DETECTION_WINDOW_MS;
  });
}

/**
 * RM6 — vrai ssi la prise candidate doit être marquée `pending_review` du
 * fait d'au moins une collision détectée.
 */
export function mustFlagAsPendingReview(
  candidate: DoseSignature,
  existing: readonly DoseSignature[],
): boolean {
  return findDuplicateCandidates(candidate, existing).length > 0;
}

/**
 * RM6 — bascule une liste de prises en `pending_review` pour exiger une
 * confirmation humaine (par un aidant). Les prises déjà `voided` restent
 * intactes : une annulation explicite ne doit jamais être « réactivée » par
 * une détection automatique.
 *
 * La fonction est pure : elle renvoie de nouvelles instances et ne mute pas
 * les arguments. Idempotente — une prise déjà en `pending_review` reste
 * inchangée (même référence d'objet).
 */
export function markDosesAsPendingReview(doses: readonly Dose[]): readonly Dose[] {
  return doses.map((dose) => {
    if (dose.status === 'voided') {
      return dose;
    }
    if (dose.status === 'pending_review') {
      return dose;
    }
    return { ...dose, status: 'pending_review' };
  });
}
