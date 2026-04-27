import type { TFunction } from 'i18next';

import type {
  RangePreset as PresentationRangePreset,
  ReportRangeOption,
  ReportStat,
  ReportsMessages,
  RescueEventView,
} from '@kinhale/ui/reports';
import type { ReportData } from '@kinhale/reports';
import type { ProjectedDose } from '@kinhale/sync';

/**
 * Mappe un `PresentationRangePreset` (ce que voit l'utilisateur dans la
 * maquette : 7 j / 30 j / 3 mois / 6 mois / Personnalisé) vers le
 * `RangePreset` du package `@kinhale/reports` (qui ne supporte que `30d`
 * et `90d` pour le moment).
 *
 * 7d  → 30d (la couche métier ne supporte pas encore 7d ; le rapport
 *           portera sur 30 jours mais l'UI affichera bien l'intention)
 * 3m  → 90d (équivalent strict)
 * 6m  → 90d (limite fonctionnelle ; le filtrage 90 j reste défensif)
 *
 * Quand l'utilisateur choisit `custom`, on appelle `computeRange` côté
 * page avec les bornes `customStart` / `customEnd`.
 */
export function presetToInternal(p: PresentationRangePreset): '30d' | '90d' {
  if (p === '3m' || p === '6m') return '90d';
  return '30d';
}

const SHORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
};

function formatShort(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, SHORT_DATE_OPTIONS).format(new Date(ms));
}

/**
 * Construit le libellé `selectedRangeLabel` (ex. « Du 27 janv. au 26
 * avril 2026 · 90 jours »).
 */
export function buildSelectedRangeLabel(
  t: TFunction<'common'>,
  startMs: number,
  endMs: number,
  locale: string,
): string {
  const days = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
  return t('reports.selectedRangeFormat', {
    from: formatShort(startMs, locale),
    to: formatShort(endMs, locale),
    days,
  });
}

export function buildPresets(t: TFunction<'common'>): ReadonlyArray<ReportRangeOption> {
  return [
    { value: '7d', label: t('reports.preset.7d') },
    { value: '30d', label: t('reports.preset.30d') },
    { value: '3m', label: t('reports.preset.3m') },
    { value: '6m', label: t('reports.preset.6m') },
    { value: 'custom', label: t('reports.preset.custom') },
  ];
}

export interface AggregatedStats {
  /** Adhérence en pourcentage (0-100), arrondie. */
  adherencePct: number;
  /** Jours « ratés » sur la période (au moins 1 dose maint manquée). */
  missedDays: number;
  /** Total de jours de la période. */
  totalDays: number;
  /** Nombre de prises de secours. */
  rescueCount: number;
  /** Nombre de jours symptomatiques (≥ 1 dose avec symptôme/circonstance). */
  symptomDays: number;
  /** Nombre de réveils nocturnes (rescue entre 21h-5h). */
  nightWakings: number;
}

/**
 * Calcule les statistiques agrégées affichées dans les `StatBlock`. Le
 * package `@kinhale/reports` fournit `aggregateReportData` mais avec
 * un format orienté PDF — on extrait ici les chiffres clés pour l'UI.
 */
export function aggregateUiStats(data: ReportData, totalDays: number): AggregatedStats {
  const ratio = data.adherence.ratio;
  const adherencePct = Number.isFinite(ratio) ? Math.round(ratio * 100) : 0;
  const rescueCount = data.doses.filter((d) => d.doseType === 'rescue').length;
  const missedDays = Math.max(0, totalDays - Math.round((adherencePct / 100) * totalDays));
  // `symptomDays` = nombre de jours uniques avec au moins une entrée
  // dans la `symptomTimeline` (approximation côté UI ; la définition
  // stricte reste au domain). `nightWakings` n'est pas encore exposé
  // par le package métier — on retourne 0 plutôt que de masquer le
  // bloc côté UI.
  const symptomIsoDays = new Set<string>();
  for (const entry of data.symptomTimeline) {
    symptomIsoDays.add(new Date(entry.administeredAtMs).toISOString().slice(0, 10));
  }
  return {
    adherencePct,
    missedDays,
    totalDays,
    rescueCount,
    symptomDays: symptomIsoDays.size,
    nightWakings: 0,
  };
}

export function buildStats(t: TFunction<'common'>, s: AggregatedStats): ReadonlyArray<ReportStat> {
  return [
    {
      key: 'adherence',
      label: t('reports.stat.adherence'),
      value: String(s.adherencePct),
      suffix: '%',
      sub: t('reports.stat.adherenceSub', { count: s.missedDays, total: s.totalDays }),
      tone: 'ok',
    },
    {
      key: 'rescue',
      label: t('reports.stat.rescueUses'),
      value: String(s.rescueCount),
      sub: t('reports.stat.rescueUsesSub', { count: s.rescueCount }),
      tone: 'rescue',
    },
    {
      key: 'symptomDays',
      label: t('reports.stat.asthmaDays'),
      value: String(s.symptomDays),
      suffix: t('history.daysSuffix'),
      sub: t('reports.stat.asthmaDaysSub'),
      tone: 'amber',
    },
    {
      key: 'sleep',
      label: t('reports.stat.sleepImpact'),
      value: String(s.nightWakings),
      sub: t('reports.stat.sleepImpactSub', { count: s.nightWakings }),
      tone: 'maint',
    },
  ];
}

export function buildReportsMessages(args: {
  t: TFunction<'common'>;
  childName: string;
  selectedRangeLabel: string;
  stats: ReadonlyArray<ReportStat>;
}): ReportsMessages {
  const { t, childName, selectedRangeLabel, stats } = args;
  return {
    childName,
    title: t('reports.title'),
    subtitle: t('reports.subtitle'),
    rangeLabel: t('reports.rangeLabel'),
    presets: buildPresets(t),
    selectedRangeLabel,
    summaryTitle: t('reports.summaryTitle'),
    stats,
    rescueLogTitle: t('reports.rescueLogTitle'),
    reliefSuffix: t('reports.reliefSuffix'),
    adherenceChartLabel: t('reports.adherenceChartLabel'),
    rescueChartLabel: t('reports.rescueChartLabel'),
    exportLabel: t('reports.exportLabel'),
    shareLabel: t('reports.shareLabel'),
    notMedical: t('reports.notMedical'),
    emptyRescueTitle: t('reports.emptyRescueTitle'),
    emptyRescueSub: t('reports.emptyRescueSub'),
  };
}

/**
 * Convertit les prises de secours du `doc` projecté en `RescueEventView`
 * pour le journal de la page Rapports.
 */
export function rescueDosesToEvents(
  doses: ReadonlyArray<ProjectedDose>,
  rangeStartMs: number,
  rangeEndMs: number,
  locale: string,
): RescueEventView[] {
  const filtered = doses
    .filter(
      (d) =>
        d.doseType === 'rescue' &&
        d.status !== 'voided' &&
        d.administeredAtMs >= rangeStartMs &&
        d.administeredAtMs <= rangeEndMs,
    )
    .sort((a, b) => b.administeredAtMs - a.administeredAtMs);

  return filtered.map((d) => {
    const date = new Date(d.administeredAtMs);
    const cause = d.circumstances[0] ?? d.symptoms[0] ?? 'Inconnu';
    const view: RescueEventView = {
      id: d.doseId,
      date: new Intl.DateTimeFormat(locale, SHORT_DATE_OPTIONS).format(date),
      time: new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date),
      cause,
      who: '—',
    };
    if (d.freeFormTag !== null && d.freeFormTag !== '') {
      return { ...view, note: d.freeFormTag };
    }
    return view;
  });
}

/**
 * Calcule deux séries quotidiennes (30 derniers jours) à partir des
 * prises projetées : adhérence quotidienne (% maint donné) et nombre
 * de prises de secours par jour. Format compatible avec
 * `AdherenceSparkline` et `RescueBars`.
 */
export function buildDailySeries(
  doses: ReadonlyArray<ProjectedDose>,
  endMs: number,
  windowDays: number,
): { adherence: number[]; rescue: number[] } {
  const adherence: number[] = [];
  const rescue: number[] = [];
  const startWindow = endMs - windowDays * 86_400_000;
  for (let i = 0; i < windowDays; i += 1) {
    const dayStart = startWindow + i * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const dayDoses = doses.filter(
      (d) => d.status !== 'voided' && d.administeredAtMs >= dayStart && d.administeredAtMs < dayEnd,
    );
    const maintCount = dayDoses.filter((d) => d.doseType === 'maintenance').length;
    const rescueCount = dayDoses.filter((d) => d.doseType === 'rescue').length;
    // Adhérence approximative : 100 % si au moins 1 maint, 0 sinon.
    // Pour une métrique plus fine il faudrait connaître les plans
    // (RM6 / projectPlans) — futur ticket.
    adherence.push(maintCount > 0 ? 100 : 0);
    rescue.push(rescueCount);
  }
  return { adherence, rescue };
}
