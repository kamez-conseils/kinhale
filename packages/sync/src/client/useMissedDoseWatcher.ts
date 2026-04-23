import * as React from 'react';
import { detectMissedReminders } from '@kinhale/domain';
import type { KinhaleDoc } from '../doc/schema.js';
import {
  DEFAULT_REMINDER_HORIZON_MS,
  projectScheduledReminders,
} from '../projections/reminders.js';

/**
 * Arguments d'émission d'une notification locale `missed_dose`. Même forme
 * que `ScheduleLocalNotificationArgs` (brique 4), mais sans `triggerAtUtc` —
 * on notifie immédiatement.
 */
export interface NotifyMissedDoseArgs {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface UseMissedDoseWatcherDeps {
  /** Hook plateforme : document Automerge courant. */
  readonly useDoc: () => KinhaleDoc | null;
  /**
   * Callback invoqué pour chaque rappel qui vient de transitionner
   * à `missed`. L'implémentation plateforme décide comment appliquer le
   * change Automerge (ou laisse un no-op si la persistance du statut
   * `missed` n'est pas encore branchée — v1.0 peut se contenter de la
   * projection temps réel sans stocker la transition).
   */
  readonly markReminderMissed: (reminderId: string) => void;
  /**
   * Émet la notification locale `missed_dose`. **Chaînes déjà traduites**
   * fournies par {@link UseMissedDoseWatcherDeps.missedDoseTitle} /
   * `missedDoseBody`.
   *
   * Optionnel : si non fourni, le watcher ne fait que persister la
   * transition via `markReminderMissed` (le push utilisateur sera émis
   * par une autre couche, ex. e-mail fallback E5-S04).
   */
  readonly notifyMissedDose?: (args: NotifyMissedDoseArgs) => Promise<void>;
  /** Horloge injectée — testable. */
  readonly now: () => Date;
  /** Intervalle du polling en ms (défaut 60_000 = 1 min). */
  readonly tickMs?: number;
  /** Horizon de projection, défaut 48 h (cohérent avec le scheduler). */
  readonly horizonMs?: number;
  /**
   * Titre et corps **déjà traduits** du push `missed_dose`. Valeurs
   * sobres recommandées :
   * - title = "Kinhale"
   * - body  = "Dose non confirmée"
   *
   * **Interdit** : recommandation, diagnostic, mention de dose ou
   * pompe. Ligne rouge dispositif médical (CLAUDE.md, SPECS §7.4).
   */
  readonly missedDoseTitle: string;
  readonly missedDoseBody: string;
}

/**
 * Hook framework-agnostique : surveille le passage de rappels à `missed`
 * par polling toutes les `tickMs` (défaut 60 s — aligné sur O4 délai cible
 * ≤ 60 s).
 *
 * Fonctionnement à chaque tick :
 * - Si `doc === null`, no-op.
 * - Projette les rappels scheduled sur l'horizon.
 * - Applique `detectMissedReminders(reminders, now)` (RM25).
 * - Pour chaque rappel à transitionner :
 *   1. Appelle `markReminderMissed(reminderId)`.
 *   2. Si `notifyMissedDose` fourni, émet la notification locale.
 * - Tient un set local des ids déjà notifiés pour éviter les doublons
 *   si la projection continue à exposer le rappel (tant que la transition
 *   n'est pas persistée dans le doc, le rappel reste `scheduled` dans la
 *   prochaine projection — on s'appuie sur le set pour ne pas répéter).
 *
 * Choix de design : le watcher émet la notification `missed_dose` lui-même.
 * Alternative envisagée : laisser le `useReminderScheduler` recalculer et
 * émettre via la projection. Rejetée car (a) `Reminder.status` n'est pas
 * persisté en v1.0 — le scheduler n'a aucun signal pour distinguer un
 * rappel juste missed d'un rappel vraiment scheduled ; (b) séparer les
 * deux hooks garde leur invariant clair : « scheduler = futur »,
 * « watcher = transition courante ».
 *
 * Refs: KIN-038, E5-S03, SPECS §W4, §9, RM25.
 */
export function useMissedDoseWatcher(deps: UseMissedDoseWatcherDeps): void {
  const doc = deps.useDoc();

  // Latest-ref pattern : stabilise l'identité des callbacks.
  const markRef = React.useRef(deps.markReminderMissed);
  const notifyRef = React.useRef(deps.notifyMissedDose);
  const nowRef = React.useRef(deps.now);
  const titleRef = React.useRef(deps.missedDoseTitle);
  const bodyRef = React.useRef(deps.missedDoseBody);
  markRef.current = deps.markReminderMissed;
  notifyRef.current = deps.notifyMissedDose;
  nowRef.current = deps.now;
  titleRef.current = deps.missedDoseTitle;
  bodyRef.current = deps.missedDoseBody;

  // Référence stable sur le doc (pour lecture dans l'intervalle sans
  // recréer le timer à chaque mutation).
  const docRef = React.useRef(doc);
  docRef.current = doc;

  const tickMs = deps.tickMs ?? 60_000;
  const horizonMs = deps.horizonMs ?? DEFAULT_REMINDER_HORIZON_MS;

  // Ids déjà notifiés — évite la répétition tant que la transition n'est
  // pas persistée (v1.0).
  const notifiedIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;

    function check(): void {
      if (cancelled) return;
      const currentDoc = docRef.current;
      if (currentDoc === null) return;

      const reminders = projectScheduledReminders(currentDoc, nowRef.current(), horizonMs);
      const missed = detectMissedReminders(reminders, nowRef.current());

      for (const r of missed) {
        if (notifiedIdsRef.current.has(r.id)) continue;
        notifiedIdsRef.current.add(r.id);
        markRef.current(r.id);
        const notify = notifyRef.current;
        if (notify !== undefined) {
          void notify({
            id: r.id,
            title: titleRef.current,
            body: bodyRef.current,
          });
        }
      }
    }

    // On ne check pas au montage : le watcher est un *timer* — cohérent
    // avec la signature « toutes les tickMs » et évite un double-fire à
    // l'ouverture. Si on veut un check immédiat, on peut abaisser tickMs
    // côté app (déconseillé en prod).
    const handle = setInterval(check, tickMs);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [tickMs, horizonMs]);
}
