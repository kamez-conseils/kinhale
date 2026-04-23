import * as React from 'react';
import { detectMissedReminders } from '@kinhale/domain';
import type { KinhaleDoc } from '../doc/schema.js';
import {
  DEFAULT_REMINDER_HORIZON_MS,
  projectScheduledReminders,
} from '../projections/reminders.js';

/**
 * TTL d'un id de rappel dans `notifiedIdsRef`. Un rappel missed ne peut
 * plus re-déclencher de notification 24 h après la fin de sa fenêtre : on
 * purge les entrées pour éviter une croissance monotone du Set (mémoire
 * session longue). 24 h > horizon de projection (48 h) n'est pas requis —
 * seuls les rappels **déjà passés** sont dans le Set, donc 24 h de rétention
 * post-fenêtre suffisent pour se prémunir d'un tick en retard.
 *
 * Refs: KIN-038 (kz-review M2, kz-securite m2).
 */
const NOTIFIED_IDS_TTL_MS = 24 * 60 * 60 * 1000;

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
  // Clé du foyer — déclenche un reset du Set de dédoublonnage quand elle
  // change (switch post-invitation / logout-relog). Un rappel d'un autre
  // foyer ne doit pas apparaître déjà « notifié » pour le nouveau.
  const householdKey: string | null = doc?.householdId ?? null;

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
  // pas persistée (v1.0). Map<id, windowEndMs> pour pouvoir purger au-delà
  // du TTL (cf. `NOTIFIED_IDS_TTL_MS`).
  const notifiedIdsRef = React.useRef<Map<string, number>>(new Map());

  // Reset du dédoublonnage quand le foyer change. Sans ça, un re-login sur
  // un autre household marque les nouveaux rappels comme déjà notifiés si
  // leurs ids collisionnaient (improbable vu le format `r:<planId>:<iso>`
  // mais défensif — aussi utile si un jour on rejoue un historique).
  React.useEffect(() => {
    notifiedIdsRef.current = new Map();
  }, [householdKey]);

  React.useEffect(() => {
    let cancelled = false;

    function check(): void {
      if (cancelled) return;
      const currentDoc = docRef.current;
      if (currentDoc === null) return;

      const nowDate = nowRef.current();
      const reminders = projectScheduledReminders(currentDoc, nowDate, horizonMs);
      const missed = detectMissedReminders(reminders, nowDate);

      // Purge TTL : un rappel dont la fenêtre s'est fermée il y a plus de
      // 24 h ne peut plus re-émettre (la projection ne le remontera plus
      // non plus, vu le lookback par défaut de 2 h). Garde le Set borné.
      const nowMs = nowDate.getTime();
      for (const [id, windowEndMs] of notifiedIdsRef.current) {
        if (windowEndMs + NOTIFIED_IDS_TTL_MS < nowMs) {
          notifiedIdsRef.current.delete(id);
        }
      }

      for (const r of missed) {
        if (notifiedIdsRef.current.has(r.id)) continue;
        const endMs = Date.parse(r.windowEndUtc);
        // Si `windowEndUtc` est non parsable, on mémorise avec `nowMs` —
        // le rappel n'aurait pas dû franchir `detectMissedReminders`, mais
        // on reste défensif sans crash.
        notifiedIdsRef.current.set(r.id, Number.isNaN(endMs) ? nowMs : endMs);
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

    // Check immédiat au montage : si l'utilisateur ouvre l'app **juste
    // après** qu'un rappel a dépassé sa fenêtre, on ne veut pas attendre
    // jusqu'à `tickMs` pour notifier (O4 cible ≤ 60 s).
    check();

    const handle = setInterval(check, tickMs);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [tickMs, horizonMs]);
}
