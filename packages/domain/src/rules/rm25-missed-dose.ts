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
 * Tolérance appliquée sur `windowEndUtc` avant qu'un rappel ne soit
 * considéré manqué. Protège contre une dérive d'horloge device (NTP cassé
 * sur Android, tablette partagée en garderie) : si l'horloge locale est en
 * avance de ~2 min, on évite de basculer prématurément un rappel dont la
 * fenêtre est encore ouverte côté serveur / pairs.
 *
 * Valeur : 120 s — couvre les dérives observées sur parc public (< 60 s
 * en régime nominal, pic autour de 90 s après reboot NTP), sans trop
 * retarder la détection missed (O4 cible ≤ 60 s côté SLA produit mais le
 * buffer ne s'ajoute qu'au **seuil de bascule**, pas à la latence du tick).
 *
 * Refs: KIN-038 (kz-securite M2).
 */
export const MISSED_DOSE_CLOCK_SKEW_BUFFER_MS = 120_000;

/**
 * RM25 — détecte les rappels qui doivent transitionner vers `missed`.
 *
 * Un rappel est considéré manqué si :
 * - son `status` est `scheduled` ou `sent` (candidat à la confirmation —
 *   les états terminaux sont ignorés) ;
 * - l'instant courant dépasse **strictement** `windowEndUtc +
 *   MISSED_DOSE_CLOCK_SKEW_BUFFER_MS` (la borne nue reste exclusive : à
 *   T = windowEndUtc la fenêtre est encore ouverte d'une milliseconde ;
 *   on ajoute par-dessus un buffer de tolérance à la dérive d'horloge
 *   pour éviter de trigger un « Dose non confirmée » pendant que les
 *   pairs voient encore la fenêtre ouverte).
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

    if (nowMs > endMs + MISSED_DOSE_CLOCK_SKEW_BUFFER_MS) {
      result.push({ ...reminder, status: 'missed' });
    }
  }

  return result;
}
