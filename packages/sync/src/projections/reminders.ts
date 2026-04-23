import type { Reminder } from '@kinhale/domain';
import type { KinhaleDoc } from '../doc/schema.js';
import { projectPlan } from './plan.js';
import { projectDoses } from './doses.js';

/** Horizon par défaut pour la matérialisation des rappels (48 h). */
export const DEFAULT_REMINDER_HORIZON_MS = 48 * 60 * 60 * 1000;

/**
 * Rétro-visibilité par défaut : la projection conserve les créneaux dont
 * `targetAtUtc` est au plus 2 h dans le passé. Deux motivations :
 * - **Scheduler** (brique 4) : filtre ensuite par `targetAtUtc >= now` côté
 *   plateforme (l'OS refuserait un trigger passé de toute façon).
 * - **Watcher dose manquée** (brique 5) : a besoin des créneaux dont la
 *   fenêtre vient d'expirer pour détecter la transition → missed (RM25).
 *
 * 2 h couvre largement : fenêtre de confirmation = 30 min → un watcher
 * qui tick toutes les 60 s rattrape n'importe quel missed dans la marge.
 */
export const DEFAULT_REMINDER_LOOKBACK_MS = 2 * 60 * 60 * 1000;

/**
 * Tolérance **amont** sur la fenêtre de confirmation : un aidant peut
 * administrer la dose jusqu'à 5 min avant l'heure cible sans être pénalisé.
 * Aligné sur SPECS §9 (tolérance de déclenchement) et W2.
 */
export const REMINDER_WINDOW_BEFORE_MS = 5 * 60 * 1000;

/**
 * Fenêtre **aval** : une dose reste confirmable jusqu'à target + 30 min
 * (RM2, défaut X=30 min configurable par foyer entre 10 et 120 min).
 * En v1.0 on garde la valeur par défaut, le paramétrage foyer sera
 * ajouté en E5-S07.
 */
export const REMINDER_WINDOW_AFTER_MS = 30 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Matérialise les rappels `scheduled` à venir dans l'horizon fourni.
 *
 * Algorithme (pur, sans effet de bord) :
 * 1. Projette le plan actif le plus récent (`projectPlan`). Si aucun plan
 *    ou plan expiré (`endAtMs < now`), retourne `[]`.
 * 2. Pour chaque heure cible du plan (`scheduledHoursUtc`), parcourt les
 *    jours UTC couverts par `[now, now + horizonMs]` et produit un créneau
 *    `Date(Y-M-D, h:00Z)`.
 * 3. Filtre les créneaux hors intervalle `[now, now + horizonMs]`.
 * 4. Filtre les créneaux déjà confirmés par une dose `maintenance` dont
 *    `administeredAtMs` tombe dans la fenêtre `[windowStart, windowEnd]`
 *    ET dont la pompe correspond à celle du plan.
 * 5. Retourne la liste triée par `targetAtUtc` croissant.
 *
 * Zero-knowledge : la projection ne lit que des événements déjà présents
 * côté client (doc Automerge local), jamais depuis le relais. Elle ne
 * produit aucune chaîne contenant de donnée santé.
 *
 * @param doc      Document Automerge du foyer.
 * @param now      Horloge injectée pour permettre un test pur.
 * @param horizonMs Fenêtre de matérialisation (défaut 48 h).
 *
 * Refs: KIN-038, SPECS §3.7 (Rappel), §9 (délais), §W4, RM2.
 */
export function projectScheduledReminders(
  doc: KinhaleDoc,
  now: Date,
  horizonMs: number = DEFAULT_REMINDER_HORIZON_MS,
  lookbackMs: number = DEFAULT_REMINDER_LOOKBACK_MS,
): Reminder[] {
  const plan = projectPlan(doc);
  if (plan === null) return [];

  const nowMs = now.getTime();
  const horizonEndMs = nowMs + horizonMs;
  const lookbackStartMs = nowMs - lookbackMs;

  // Plan expiré (endAt strictement antérieur à now) : aucun rappel à émettre.
  if (plan.endAtMs !== null && plan.endAtMs < nowMs) {
    return [];
  }

  // Plan qui démarre après l'horizon : aucun créneau à matérialiser.
  if (plan.startAtMs > horizonEndMs) {
    return [];
  }

  const planStartMs = Math.max(plan.startAtMs, 0);
  // Effective start : max(plan.startAtMs, lookbackStart) pour itérer les jours
  // UTC pertinents sans produire une liste énorme pour les plans anciens.
  const iterStartMs = Math.max(planStartMs, lookbackStartMs - DAY_MS);
  // Effective end : min(plan.endAtMs, now + horizon).
  const iterEndMs = plan.endAtMs !== null ? Math.min(plan.endAtMs, horizonEndMs) : horizonEndMs;

  // Détermine la date UTC de départ et compte le nombre de jours à parcourir.
  const startDate = new Date(iterStartMs);
  const startDayUtcMs = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );

  // On itère au maximum sur 1 + ceil((iterEndMs - startDayUtcMs) / DAY_MS) jours.
  const days = Math.max(0, Math.ceil((iterEndMs - startDayUtcMs) / DAY_MS) + 1);
  const confirmedDoseIdsByTarget = buildConfirmedIndex(doc, plan.pumpId);

  const reminders: Reminder[] = [];
  for (let i = 0; i < days; i++) {
    const dayMs = startDayUtcMs + i * DAY_MS;
    for (const hour of plan.scheduledHoursUtc) {
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      const targetMs = dayMs + Math.floor(hour) * 60 * 60 * 1000;
      if (targetMs < lookbackStartMs || targetMs > horizonEndMs) continue;
      if (plan.endAtMs !== null && targetMs > plan.endAtMs) continue;

      const windowStartMs = targetMs - REMINDER_WINDOW_BEFORE_MS;
      const windowEndMs = targetMs + REMINDER_WINDOW_AFTER_MS;

      const targetIso = new Date(targetMs).toISOString();
      const confirmedDoseId = findConfirmingDose(
        confirmedDoseIdsByTarget,
        windowStartMs,
        windowEndMs,
      );
      if (confirmedDoseId !== null) continue;

      reminders.push({
        id: makeReminderId(plan.planId, targetIso),
        planId: plan.planId,
        targetAtUtc: targetIso,
        windowStartUtc: new Date(windowStartMs).toISOString(),
        windowEndUtc: new Date(windowEndMs).toISOString(),
        status: 'scheduled',
      });
    }
  }

  reminders.sort((a, b) => (a.targetAtUtc < b.targetAtUtc ? -1 : a.targetAtUtc > b.targetAtUtc ? 1 : 0));
  return reminders;
}

/**
 * Index minimaliste des doses `maintenance` confirmées pour la pompe du plan,
 * trié par `administeredAtMs`. Permet une recherche linéaire rapide par
 * fenêtre temporelle (on attend ≤ quelques centaines d'entrées par foyer sur
 * l'horizon récent, pas de besoin d'index B-tree).
 */
interface ConfirmedDose {
  readonly doseId: string;
  readonly administeredAtMs: number;
}

function buildConfirmedIndex(doc: KinhaleDoc, pumpId: string): ConfirmedDose[] {
  const out: ConfirmedDose[] = [];
  for (const dose of projectDoses(doc)) {
    if (dose.doseType !== 'maintenance') continue;
    if (dose.pumpId !== pumpId) continue;
    out.push({ doseId: dose.doseId, administeredAtMs: dose.administeredAtMs });
  }
  out.sort((a, b) => a.administeredAtMs - b.administeredAtMs);
  return out;
}

function findConfirmingDose(
  doses: ReadonlyArray<ConfirmedDose>,
  windowStartMs: number,
  windowEndMs: number,
): string | null {
  for (const dose of doses) {
    if (dose.administeredAtMs < windowStartMs) continue;
    if (dose.administeredAtMs > windowEndMs) break; // tri croissant
    return dose.doseId;
  }
  return null;
}

/**
 * ID déterministe du rappel : `r:<planId>:<targetIso>`.
 * Le format est stable pour garantir l'idempotence côté scheduler (même
 * rappel recalculé à chaque doc change doit retourner le même id pour
 * éviter une programmation duplicate côté OS).
 */
function makeReminderId(planId: string, targetIso: string): string {
  return `r:${planId}:${targetIso}`;
}
