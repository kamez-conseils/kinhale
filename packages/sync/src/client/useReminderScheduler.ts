import * as React from 'react';
import type { Reminder } from '@kinhale/domain';
import type { KinhaleDoc } from '../doc/schema.js';
import {
  DEFAULT_REMINDER_HORIZON_MS,
  projectScheduledReminders,
} from '../projections/reminders.js';

/**
 * Arguments passés à `scheduleLocalNotification` côté plateforme.
 *
 * Le contrat est volontairement minimal :
 * - `id` : identifiant stable pour annuler plus tard la notification.
 * - `triggerAtUtc` : ISO 8601 UTC ; l'implémentation plateforme calcule
 *   elle-même le délai par rapport à `Date.now()`.
 * - `title` / `body` : **chaînes déjà traduites** (pas de clé i18n —
 *   les wrappers apps résolvent i18n via leur hook `useTranslation`).
 */
export interface ScheduleLocalNotificationArgs {
  readonly id: string;
  readonly triggerAtUtc: string;
  readonly title: string;
  readonly body: string;
}

export interface UseReminderSchedulerDeps {
  /** Hook plateforme : document Automerge courant (source de vérité). */
  readonly useDoc: () => KinhaleDoc | null;
  /** Programme une notification locale — contrat idempotent : (re)programme l'id donné. */
  readonly scheduleLocalNotification: (args: ScheduleLocalNotificationArgs) => Promise<void>;
  /** Annule une notification locale précédemment programmée. No-op si inconnue. */
  readonly cancelLocalNotification: (id: string) => Promise<void>;
  /**
   * Horloge injectée. Doit retourner un `Date` représentant le temps UTC
   * courant. Injectable pour tests.
   */
  readonly now: () => Date;
  /**
   * Horizon de matérialisation (défaut 48 h — aligné sur la projection).
   * Si vous abaissez cette valeur, pensez à réduire le throttle côté OS.
   */
  readonly horizonMs?: number;
  /**
   * Titre et corps **déjà traduits** du push `reminder`.
   * Valeurs sobres par défaut recommandées :
   * - title = "Kinhale" (ou clé i18n `reminder.title`)
   * - body  = "Prise prévue" (ou clé i18n `reminder.body`)
   *
   * **Interdit** : toute mention de dose, pompe, prénom, action
   * thérapeutique ou médicale. La contrainte est opposable (non
   * dispositif médical, SPECS §7.4).
   */
  readonly reminderTitle: string;
  readonly reminderBody: string;
}

/**
 * Hook framework-agnostique qui maintient l'alignement entre les rappels
 * projetés depuis le doc Automerge et les notifications locales
 * programmées côté OS.
 *
 * Fonctionnement :
 * - À chaque changement du doc (ou de l'horloge via rerender), projette les
 *   rappels `scheduled` sur l'horizon (48 h).
 * - Diff avec l'état interne des notifications déjà programmées par ce hook.
 * - Programme les nouveaux (`scheduleLocalNotification`).
 * - Annule les obsolètes (`cancelLocalNotification`).
 *
 * Zéro donnée santé : le payload contient uniquement `title` + `body`
 * sobres — jamais le nom de la pompe, la dose ou le prénom. Cette
 * contrainte est portée par le contrat d'injection (`reminderTitle`,
 * `reminderBody`) ; elle ne peut pas être contournée par le hook.
 *
 * Refs: KIN-038, SPECS §9 (canaux, RM16-like pour notif locale).
 */
export function useReminderScheduler(deps: UseReminderSchedulerDeps): void {
  const doc = deps.useDoc();

  // Latest-ref pattern : stabilise l'identité des callbacks plateforme pour
  // que l'effet ne retrigger que sur changement de doc.
  const scheduleRef = React.useRef(deps.scheduleLocalNotification);
  const cancelRef = React.useRef(deps.cancelLocalNotification);
  const nowRef = React.useRef(deps.now);
  const titleRef = React.useRef(deps.reminderTitle);
  const bodyRef = React.useRef(deps.reminderBody);
  scheduleRef.current = deps.scheduleLocalNotification;
  cancelRef.current = deps.cancelLocalNotification;
  nowRef.current = deps.now;
  titleRef.current = deps.reminderTitle;
  bodyRef.current = deps.reminderBody;

  const horizonMs = deps.horizonMs ?? DEFAULT_REMINDER_HORIZON_MS;

  // État local persistant : ids de notifications programmées par ce hook.
  // Stocké dans une ref pour ne pas déclencher de re-render.
  const scheduledIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (doc === null) return undefined;

    const nowDate = nowRef.current();
    const nowMs = nowDate.getTime();
    // Lookback 0 : le scheduler n'a pas besoin des créneaux passés. L'OS
    // refuserait un trigger antérieur ; autant ne pas tenter.
    const reminders = projectScheduledReminders(doc, nowDate, horizonMs, 0).filter(
      (r) => Date.parse(r.targetAtUtc) >= nowMs,
    );
    const desiredIds = new Set(reminders.map((r) => r.id));
    const currentIds = scheduledIdsRef.current;

    const toSchedule: Reminder[] = reminders.filter((r) => !currentIds.has(r.id));
    const toCancel: string[] = [];
    for (const id of currentIds) {
      if (!desiredIds.has(id)) toCancel.push(id);
    }

    // Applique les opérations en parallèle — le hook ne dépend pas du résultat.
    for (const reminder of toSchedule) {
      currentIds.add(reminder.id);
      void scheduleRef.current({
        id: reminder.id,
        triggerAtUtc: reminder.targetAtUtc,
        title: titleRef.current,
        body: bodyRef.current,
      });
    }
    for (const id of toCancel) {
      currentIds.delete(id);
      void cancelRef.current(id);
    }

    return undefined;
  }, [doc, horizonMs]);

  // Au démontage, annule toutes les notifs programmées par ce hook. Évite
  // les notifs « orphelines » si l'utilisateur se déconnecte.
  React.useEffect(() => {
    return () => {
      const ids = Array.from(scheduledIdsRef.current);
      scheduledIdsRef.current.clear();
      for (const id of ids) {
        void cancelRef.current(id);
      }
    };
  }, []);
}
