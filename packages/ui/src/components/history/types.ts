// Types présentationnels pour les composants Historique. L'app appelante
// mappe ses projections (`@kinhale/sync` + calculs domain) vers ces
// types pure-presentational.

export type HistoryDoseKind = 'maint' | 'rescue';

/** État visuel d'une journée dans le calendrier. */
export type CalendarCellState =
  | 'done' // toutes les prises prévues ont été données
  | 'partial' // au moins une dose manquée ou rattrapée
  | 'missed' // aucune prise enregistrée
  | 'rescue' // au moins une prise de secours
  | 'todayPending' // jour courant — décompte en cours
  | 'future'; // après aujourd'hui — placeholder

export interface CalendarCell {
  /** Numéro du jour (1-31). `null` pour les cases de padding début de mois. */
  day: number | null;
  state: CalendarCellState;
  /** Identifiant ISO YYYY-MM-DD (utile pour le clic / navigation). */
  iso?: string | undefined;
}

/** État d'une prise dans le fil d'activité. */
export type FeedEntryState =
  | 'done'
  | 'missed'
  | 'voided'
  | 'pendingReview' // RM6 — double saisie en attente d'arbitrage
  | 'backfill'; // RM18 — saisie en rattrapage

export interface FeedEntry {
  id: string;
  kind: HistoryDoseKind;
  /** Libellé du moment (« Matin », « Soir », « Midi », etc.) — déjà localisé. */
  slot: string;
  /** Heure HH:mm ou « — » si missed. */
  time: string;
  /** Nom de l'aidant, déjà localisé. */
  who: string;
  state: FeedEntryState;
  /** Cause d'une prise de secours (ex. « Effort »). Optionnel. */
  cause?: string | undefined;
  /** Note optionnelle, plain text. */
  note?: string | undefined;
}

export interface FeedDay {
  /** Libellé localisé : « Aujourd'hui », « Hier », ou « 24 avril ». */
  label: string;
  entries: ReadonlyArray<FeedEntry>;
}

export interface HistoryStats {
  /** Adhérence du mois en pourcentage (0-100). */
  adherencePct: number;
  /** Nombre de prises de secours ce mois. */
  rescueCount: number;
  /** Plus longue série de jours consécutifs « done ». */
  longestStreakDays: number;
}

export type HistoryFilter = 'all' | 'maint' | 'rescue';

// ── Sidebar dashboard (réutilisé) ────────────────────────────────────────

export interface HistoryNavItem {
  key: string;
  label: string;
  active?: boolean;
  onPress?: (() => void) | undefined;
}

// ── Messages localisés ──────────────────────────────────────────────────

export interface HistoryListMessages {
  /** Eyebrow desktop (prénom enfant en uppercase). */
  childName: string;
  title: string;
  subtitle: string;
  filtersLabel: string;
  filterAll: string;
  filterMaint: string;
  filterRescue: string;
  exportLabel: string;
  /** « Adhérence ce mois », etc. */
  statAdherenceLabel: string;
  statRescueLabel: string;
  statStreakLabel: string;
  /** Suffixe pour les jours, ex. « j » ou « d ». */
  daysSuffix: string;
  /** Légende calendrier (5 entrées, déjà localisées). */
  legendDone: string;
  legendPartial: string;
  legendMissed: string;
  legendRescue: string;
  legendFuture: string;
  /** Mois affiché (ex. « Avril 2026 »). */
  monthLabel: string;
  /** Tableau des 7 jours (« L M M J V S D »). */
  weekdays: ReadonlyArray<string>;
  /** Pill localisée pour le fond / secours. */
  pillFond: string;
  pillSecours: string;
  /** Marqueurs de statut. */
  markerVoided: string;
  markerPendingReview: string;
  markerBackfill: string;
  markerMissed: string;
  /** « par {who} ». L'app fournit la fonction de format. */
  formatBy: (who: string) => string;
  /** État vide (aucune prise). */
  emptyTitle: string;
  emptySub: string;
  /** Disclaimer Kinhale. */
  notMedical: string;
  /** Bouton Ajouter (FAB / header — usage clavier + accessibilité). */
  addCta: string;
}

export interface HistoryListHandlers {
  onPressAdd?: (() => void) | undefined;
  onPressExport?: (() => void) | undefined;
  onPressEntry?: ((id: string) => void) | undefined;
  onPressDay?: ((iso: string) => void) | undefined;
  onPressPrevMonth?: (() => void) | undefined;
  onPressNextMonth?: (() => void) | undefined;
  onChangeFilter?: ((f: HistoryFilter) => void) | undefined;
}
