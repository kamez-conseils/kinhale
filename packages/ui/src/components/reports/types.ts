// Types présentationnels pour la page Rapports (clinical-calm v2).

export type RangePreset = '7d' | '30d' | '3m' | '6m' | 'custom';

export interface ReportRangeOption {
  value: RangePreset;
  label: string;
}

export type StatTone = 'ok' | 'rescue' | 'amber' | 'maint';

export interface ReportStat {
  key: string;
  label: string;
  value: string;
  /** Suffixe court (ex. `"%"`, `"j"`). */
  suffix?: string | undefined;
  sub: string;
  tone: StatTone;
}

export interface RescueEventView {
  id: string;
  /** Date courte (ex. `"24 avr."`). */
  date: string;
  /** Heure HH:mm. */
  time: string;
  /** Cause / déclencheur (déjà localisé). */
  cause: string;
  /** Aidant ayant consigné. */
  who: string;
  /** Note libre (parent). Optionnel. */
  note?: string | undefined;
  /** Durée en minutes jusqu'au soulagement. Optionnel. */
  reliefMinutes?: number | undefined;
}

// ── Sidebar dashboard ───────────────────────────────────────────────────

export interface ReportsNavItem {
  key: string;
  label: string;
  active?: boolean;
  onPress?: (() => void) | undefined;
}

// ── Messages ────────────────────────────────────────────────────────────

export interface ReportsMessages {
  /** Eyebrow desktop (prénom + âge calculé, ex. « LÉA, 6 ANS »). */
  childName: string;
  title: string;
  subtitle: string;
  rangeLabel: string;
  /** Range presets déjà localisés. */
  presets: ReadonlyArray<ReportRangeOption>;
  /** Plage sélectionnée formatée (ex. « Du 27 janv. au 26 avril 2026 · 90 jours »). */
  selectedRangeLabel: string;
  /** Section « Synthèse ». */
  summaryTitle: string;
  /** Stats déjà localisées + valeurs calculées. */
  stats: ReadonlyArray<ReportStat>;
  /** Section « Journal des secours ». */
  rescueLogTitle: string;
  /** Préfixe « Soulagée en X min ». */
  reliefSuffix: string;
  /** Étiquettes des graphes. */
  adherenceChartLabel: string;
  rescueChartLabel: string;
  /** Boutons. */
  exportLabel: string;
  shareLabel: string;
  /** Disclaimer Kinhale. */
  notMedical: string;
  /** Quand aucune prise de secours sur la période. */
  emptyRescueTitle: string;
  emptyRescueSub: string;
}

export interface ReportsHandlers {
  onChangeRange?: ((preset: RangePreset) => void) | undefined;
  onPressExport?: (() => void) | undefined;
  onPressShare?: (() => void) | undefined;
  onPressEvent?: ((id: string) => void) | undefined;
}
