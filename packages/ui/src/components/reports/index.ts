export { RangePicker } from './RangePicker';
export type { RangePickerProps } from './RangePicker';

export { ReportsListMobile } from './ReportsListMobile';
export type { ReportsListMobileProps } from './ReportsListMobile';

export { ReportsListWeb } from './ReportsListWeb';
export type { ReportsListWebProps } from './ReportsListWeb';

export { ReportsSidebar } from './ReportsSidebar';
export type { ReportsSidebarProps } from './ReportsSidebar';

export { RescueEventsList } from './RescueEventsList';
export type { RescueEventsListProps } from './RescueEventsList';

export { AdherenceSparkline, ChartsCard, RescueBars } from './Sparklines';
export type { AdherenceSparklineProps, ChartsCardProps, RescueBarsProps } from './Sparklines';

export { StatBlock } from './StatBlock';
export type { StatBlockProps } from './StatBlock';

// `StatTone` est délibérément non re-exporté ici : le module `history`
// exporte déjà un type avec le même nom mais une union différente
// (`'maint' | 'ok' | 'rescue'` côté history vs `'ok' | 'rescue' |
// 'amber' | 'maint'` côté reports). Les consommateurs importent
// directement depuis `@kinhale/ui/reports/types` si besoin.
export type {
  RangePreset,
  RescueEventView,
  ReportRangeOption,
  ReportStat,
  ReportsHandlers,
  ReportsMessages,
  ReportsNavItem,
} from './types';
