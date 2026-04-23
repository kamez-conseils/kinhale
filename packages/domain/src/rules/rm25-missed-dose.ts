import type { Reminder } from '../entities/reminder';

/**
 * Variante de {@link Reminder} avec un statut strictement `missed` — sortie
 * de {@link detectMissedReminders}. Permet au consommateur d'exprimer dans
 * son type que la transition a bien été calculée.
 */
export type MissedReminder = Reminder & { status: 'missed' };

/**
 * Statuts dont un rappel doit partir pour pouvoir transitionner vers
 * `missed`. `confirmed`, `missed`, `snoozed`, `cancelled` sont des états
 * terminaux (ou déjà missed) — aucune nouvelle détection n'est possible.
 *
 * Exposé pour documentation ; l'implémentation utilise un set pour O(1).
 */
export const MISSED_ELIGIBLE_STATUSES: ReadonlyArray<Reminder['status']> = [
  'scheduled',
  'sent',
] as const;

const MISSED_ELIGIBLE_SET = new Set<Reminder['status']>(MISSED_ELIGIBLE_STATUSES);

/**
 * RM25 — détecte les rappels qui doivent transitionner vers `missed`.
 *
 * Un rappel est considéré manqué si :
 * - son `status` est `scheduled` ou `sent` (candidat à la confirmation —
 *   les états terminaux sont ignorés) ;
 * - l'instant courant dépasse **strictement** `windowEndUtc` (borne
 *   exclusive : à T = windowEndUtc la fenêtre est encore ouverte d'une
 *   milliseconde — cohérent avec RM2 qui traite la borne supérieure comme
 *   inclusive via la dose, mais côté rappel on évite un race avec la dose
 *   qui arrive à l'instant pile).
 *
 * Fonction **pure** : pas d'horloge injectée depuis le module (on reçoit
 * `now`), pas d'I/O. Retourne les rappels concernés en conservant leur
 * `targetAtUtc` d'origine ; l'appelant est responsable d'appliquer la
 * transition dans le document Automerge et d'émettre la notification
 * `missed_dose`.
 *
 * Si aucun rappel ne doit transitionner, retourne un tableau vide.
 *
 * Note d'implémentation : la sortie est un nouveau tableau, jamais l'entrée
 * d'origine mutée — conforme au principe « pas d'effet de bord » et à
 * l'immutabilité des projections.
 *
 * Refs: SPECS §W4 (parcours dose manquée), §9 (types de notifications),
 * RM25. Ce fichier est complémentaire à `rm25-reminder-retries` : ici on
 * calcule **la transition vers missed** ; le plan de relances ultérieur
 * est porté par `planReminderRetries`.
 */
export function detectMissedReminders(
  reminders: ReadonlyArray<Reminder>,
  now: Date,
): MissedReminder[] {
  const nowMs = now.getTime();
  const result: MissedReminder[] = [];

  for (const reminder of reminders) {
    if (!MISSED_ELIGIBLE_SET.has(reminder.status)) continue;

    const endMs = Date.parse(reminder.windowEndUtc);
    // windowEndUtc ISO invalide : on ignore plutôt que de throw — cohérent
    // avec la robustesse des projections (jamais de crash côté lecture).
    if (Number.isNaN(endMs)) continue;

    if (nowMs > endMs) {
      result.push({ ...reminder, status: 'missed' });
    }
  }

  return result;
}
