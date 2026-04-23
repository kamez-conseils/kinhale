/**
 * Statuts possibles d'un rappel de dose de fond (SPECS §3.7 — Rappel).
 *
 * Transitions légales (simplifiées pour v1.0 — le flux complet est porté par
 * W4 et RM25) :
 * - `scheduled` → `sent`        : le device a déclenché la notification locale à T-0.
 * - `scheduled`/`sent` → `confirmed` : un aidant a saisi la dose dans la
 *   fenêtre `[target - X, target + X]` (RM2). Le champ `confirmedByDoseId`
 *   porte l'ID de la prise qui a clos le rappel.
 * - `scheduled`/`sent` → `missed`    : la fenêtre s'est écoulée sans
 *   confirmation (RM25). Les relances éventuelles sont portées par
 *   `rm25-reminder-retries`.
 * - `scheduled`/`sent` → `snoozed`  : report manuel par un aidant (W4 bis —
 *   hors périmètre v1.0 PR C).
 * - `scheduled`/`sent` → `cancelled` : plan mis en pause/archivé,
 *   disparition de la pompe associée, etc.
 */
export type ReminderStatus =
  | 'scheduled'
  | 'sent'
  | 'confirmed'
  | 'missed'
  | 'snoozed'
  | 'cancelled';

/**
 * Rappel de dose de fond — entité purement projetée depuis le document
 * Automerge (plans + doses confirmées). Aucun état de rappel n'est persisté
 * comme événement domaine en v1.0 : la source de vérité reste le plan et les
 * prises. Le statut est recalculé à chaque projection.
 *
 * Tous les instants sont en UTC (ISO 8601). La fenêtre de confirmation
 * `[windowStartUtc, windowEndUtc]` est dérivée de RM2 (défaut ±X min autour
 * de `targetAtUtc`, avec une pré-amorce de 5 min côté amont pour tolérer les
 * avances de pompe).
 *
 * Zéro donnée santé : un `Reminder` ne référence ni le prénom de l'enfant,
 * ni le nom de la pompe, ni la dose. Il n'expose que des identifiants opaques
 * et des horodatages.
 *
 * Refs: SPECS §3.7 (structure), §9 (délais), §W4 (parcours), RM2, RM25.
 */
export interface Reminder {
  /** UUID stable, déterministe : `planId + targetAtUtc` pour idempotence. */
  readonly id: string;
  /** Plan de traitement émetteur (RM3 : jamais une pompe de secours). */
  readonly planId: string;
  /** Heure cible prévue (ISO 8601 UTC). */
  readonly targetAtUtc: string;
  /** Début de la fenêtre de confirmation (ISO 8601 UTC). */
  readonly windowStartUtc: string;
  /** Fin de la fenêtre de confirmation (ISO 8601 UTC). */
  readonly windowEndUtc: string;
  /** Statut courant — voir {@link ReminderStatus}. */
  readonly status: ReminderStatus;
  /** Si `status === 'confirmed'`, ID de la prise qui a clos le rappel. */
  readonly confirmedByDoseId?: string;
}

/** Ensemble fermé des statuts valides — utile pour valider un input externe. */
export const REMINDER_STATUSES: ReadonlyArray<ReminderStatus> = [
  'scheduled',
  'sent',
  'confirmed',
  'missed',
  'snoozed',
  'cancelled',
] as const;

/**
 * Garde-fou structurel — vérifie qu'un objet inconnu (ex. désérialisé d'un
 * JSON tiers) est bien un `Reminder` valide. N'est **pas** un validateur
 * métier (ne contrôle pas la cohérence des fenêtres ni des transitions).
 *
 * Utilisable côté tests et côté projection pour écarter les payloads
 * malformés silencieusement (même pattern que `projectDoses`).
 */
export function isReminder(value: unknown): value is Reminder {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r['id'] !== 'string' || r['id'].length === 0) return false;
  if (typeof r['planId'] !== 'string' || r['planId'].length === 0) return false;
  if (typeof r['targetAtUtc'] !== 'string') return false;
  if (typeof r['windowStartUtc'] !== 'string') return false;
  if (typeof r['windowEndUtc'] !== 'string') return false;
  if (typeof r['status'] !== 'string') return false;
  if (!REMINDER_STATUSES.includes(r['status'] as ReminderStatus)) return false;
  if (r['confirmedByDoseId'] !== undefined && typeof r['confirmedByDoseId'] !== 'string') {
    return false;
  }
  // Les ISO strings doivent être parsables.
  if (Number.isNaN(Date.parse(r['targetAtUtc']))) return false;
  if (Number.isNaN(Date.parse(r['windowStartUtc']))) return false;
  if (Number.isNaN(Date.parse(r['windowEndUtc']))) return false;
  return true;
}
