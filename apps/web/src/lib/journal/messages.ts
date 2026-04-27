import type { TFunction } from 'i18next';

import type {
  CalendarCell,
  CalendarCellState,
  FeedDay,
  FeedEntry,
  FeedEntryState,
  HistoryListMessages,
  HistoryStats,
} from '@kinhale/ui/history';
import type { ProjectedDose } from '@kinhale/sync';

export interface ProjectedCaregiverLite {
  caregiverId: string;
  /** Pseudonyme du foyer (ex. « Antoine »). Optionnel. */
  alias?: string | null;
}

interface BuildContext {
  /** Doses du foyer projetées depuis le doc Automerge. */
  doses: ReadonlyArray<ProjectedDose>;
  /** ID du device courant (pour déterminer « Vous » dans le fil). */
  currentDeviceId: string | null;
  /** Aidants du foyer. */
  caregivers: ReadonlyArray<ProjectedCaregiverLite>;
  /** Mois affiché — par défaut le mois courant. */
  reference?: Date;
  /** Locale BCP-47, ex. `'fr-CA'` ou `'en-CA'`. */
  locale: string;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function slotForHour(t: TFunction<'common'>, hour: number): string {
  if (hour < 5 || hour >= 21) return t('history.slot.night');
  if (hour < 12) return t('history.slot.morning');
  if (hour < 17) return t('history.slot.afternoon');
  return t('history.slot.evening');
}

function whoFor(
  t: TFunction<'common'>,
  caregiverId: string,
  caregivers: ReadonlyArray<ProjectedCaregiverLite>,
  currentDeviceId: string | null,
): string {
  if (currentDeviceId !== null && caregiverId === currentDeviceId) {
    return t('history.actor.you');
  }
  const found = caregivers.find((c) => c.caregiverId === caregiverId);
  if (found?.alias !== undefined && found.alias !== null && found.alias !== '') {
    return found.alias;
  }
  return t('history.actor.unknown');
}

function statusToFeedState(s: ProjectedDose['status']): FeedEntryState {
  if (s === 'voided') return 'voided';
  if (s === 'pending_review') return 'pendingReview';
  return 'done';
}

function dayLabelFor(t: TFunction<'common'>, iso: string, reference: Date): string {
  const todayIso = isoDay(reference);
  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = isoDay(yesterday);
  if (iso === todayIso) return t('history.today');
  if (iso === yIso) return t('history.yesterday');
  // « 24 avril » — mois sans année si année courante.
  const d = new Date(`${iso}T00:00:00`);
  const months = t('history.months', { returnObjects: true }) as string[];
  const month = months[d.getMonth()] ?? '';
  return `${d.getDate()} ${month}`;
}

export function buildHistoryListMessages(
  t: TFunction<'common'>,
  reference: Date,
): HistoryListMessages {
  const months = t('history.months', { returnObjects: true }) as string[];
  const weekdays = t('history.weekdays', { returnObjects: true }) as string[];
  const monthLabel = `${capitalize(months[reference.getMonth()] ?? '')} ${reference.getFullYear()}`;

  return {
    childName: t('home.dashboard.childName'),
    title: t('history.title'),
    subtitle: t('history.subtitle'),
    filtersLabel: t('history.filtersLabel'),
    filterAll: t('history.filterAll'),
    filterMaint: t('history.filterMaint'),
    filterRescue: t('history.filterRescue'),
    exportLabel: t('history.exportLabel'),
    addCta: t('history.addCta'),
    statAdherenceLabel: t('history.statAdherenceLabel'),
    statRescueLabel: t('history.statRescueLabel'),
    statStreakLabel: t('history.statStreakLabel'),
    daysSuffix: t('history.daysSuffix'),
    legendDone: t('history.legendDone'),
    legendPartial: t('history.legendPartial'),
    legendMissed: t('history.legendMissed'),
    legendRescue: t('history.legendRescue'),
    legendFuture: t('history.legendFuture'),
    monthLabel,
    weekdays,
    pillFond: t('history.pillFond'),
    pillSecours: t('history.pillSecours'),
    markerVoided: t('history.marker.voided'),
    markerPendingReview: t('history.marker.pendingReview'),
    markerBackfill: t('history.marker.backfill'),
    markerMissed: t('history.marker.missed'),
    formatBy: (who: string) => t('history.by', { who }),
    emptyTitle: t('history.emptyTitle'),
    emptySub: t('history.emptySub'),
    notMedical: t('history.notMedical'),
  };
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildCalendarCells(ctx: BuildContext): CalendarCell[] {
  const ref = ctx.reference ?? new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const todayIso = isoDay(new Date());

  // Index des doses par jour ISO (uniquement le mois courant).
  const byDay = new Map<string, ProjectedDose[]>();
  for (const dose of ctx.doses) {
    const d = new Date(dose.administeredAtMs);
    if (d < monthStart || d > monthEnd) continue;
    const key = isoDay(d);
    const arr = byDay.get(key) ?? [];
    arr.push(dose);
    byDay.set(key, arr);
  }

  // Padding début (lundi = 0).
  const cells: CalendarCell[] = [];
  const firstDayOfWeek = (monthStart.getDay() + 6) % 7;
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: null, state: 'future' });
  }
  for (let day = 1; day <= monthEnd.getDate(); day++) {
    const iso = isoDay(new Date(ref.getFullYear(), ref.getMonth(), day));
    const dayDoses = byDay.get(iso) ?? [];
    const visibleDoses = dayDoses.filter((d) => d.status !== 'voided');
    const isPast = iso < todayIso;
    const isToday = iso === todayIso;

    let state: CalendarCellState;
    if (iso > todayIso) {
      state = 'future';
    } else if (isToday) {
      state = visibleDoses.length === 0 ? 'todayPending' : 'done';
    } else if (visibleDoses.length === 0 && isPast) {
      state = 'missed';
    } else if (visibleDoses.some((d) => d.doseType === 'rescue')) {
      state = 'rescue';
    } else {
      state = 'done';
    }
    cells.push({ day, state, iso });
  }
  return cells;
}

export function buildStats(ctx: BuildContext): HistoryStats {
  const ref = ctx.reference ?? new Date();
  const monthStart = startOfMonth(ref);
  const monthEnd = endOfMonth(ref);
  const today = new Date();
  const dayCount = Math.min(
    today < monthEnd ? today.getDate() : monthEnd.getDate(),
    monthEnd.getDate(),
  );

  // Doses du mois (non voidées).
  const monthDoses = ctx.doses.filter((d) => {
    const t = new Date(d.administeredAtMs);
    return t >= monthStart && t <= monthEnd && d.status !== 'voided';
  });

  // Adhérence : % de jours écoulés du mois avec au moins 1 dose maint.
  const daysWithMaint = new Set<string>();
  for (const d of monthDoses) {
    if (d.doseType === 'maintenance') {
      daysWithMaint.add(isoDay(new Date(d.administeredAtMs)));
    }
  }
  const adherencePct = dayCount > 0 ? Math.round((daysWithMaint.size / dayCount) * 100) : 0;

  // Prises de secours du mois.
  const rescueCount = monthDoses.filter((d) => d.doseType === 'rescue').length;

  // Plus longue série consécutive de jours « avec maint ».
  let longestStreakDays = 0;
  let current = 0;
  for (let day = 1; day <= dayCount; day++) {
    const iso = isoDay(new Date(ref.getFullYear(), ref.getMonth(), day));
    if (daysWithMaint.has(iso)) {
      current += 1;
      if (current > longestStreakDays) longestStreakDays = current;
    } else {
      current = 0;
    }
  }

  return { adherencePct, rescueCount, longestStreakDays };
}

export function buildFeed(
  t: TFunction<'common'>,
  ctx: BuildContext,
  filter: 'all' | 'maint' | 'rescue',
): FeedDay[] {
  const ref = ctx.reference ?? new Date();
  const monthStart = startOfMonth(ref);

  const filtered = ctx.doses.filter((d) => {
    const time = new Date(d.administeredAtMs);
    if (time < monthStart) return false;
    if (filter === 'maint') return d.doseType === 'maintenance';
    if (filter === 'rescue') return d.doseType === 'rescue';
    return true;
  });

  // Tri décroissant pour avoir aujourd'hui d'abord.
  const sorted = [...filtered].sort((a, b) => b.administeredAtMs - a.administeredAtMs);

  const byDay = new Map<string, FeedEntry[]>();
  for (const dose of sorted) {
    const date = new Date(dose.administeredAtMs);
    const iso = isoDay(date);
    const slotLabel = slotForHour(t, date.getHours());
    const time = formatTime(dose.administeredAtMs, ctx.locale);
    const entry: FeedEntry = {
      id: dose.doseId,
      kind: dose.doseType === 'maintenance' ? 'maint' : 'rescue',
      slot: slotLabel,
      time: dose.status === 'voided' ? '—' : time,
      who: whoFor(t, dose.caregiverId, ctx.caregivers, ctx.currentDeviceId),
      state: statusToFeedState(dose.status),
      ...(dose.doseType === 'rescue' && dose.circumstances.length > 0
        ? { cause: dose.circumstances[0] }
        : {}),
      ...(dose.freeFormTag !== null && dose.freeFormTag !== '' ? { note: dose.freeFormTag } : {}),
    };
    const arr = byDay.get(iso) ?? [];
    arr.push(entry);
    byDay.set(iso, arr);
  }

  const days: FeedDay[] = [];
  for (const [iso, entries] of byDay.entries()) {
    days.push({ label: dayLabelFor(t, iso, ref), entries });
  }
  return days;
}
