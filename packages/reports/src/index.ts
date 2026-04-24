// Plage de dates
export type {
  DateRange,
  DateRangeValidationError,
  DateRangeValidationResult,
  RangePreset,
} from './range/date-range.js';
export {
  MAX_RANGE_MONTHS,
  MS_PER_DAY,
  presetRange,
  validateDateRange,
} from './range/date-range.js';

// Agrégation (pure)
export type {
  AdherenceSummary,
  ReportData,
  ReportDose,
  SymptomEntry,
  WeekBucket,
} from './data/aggregate.js';
export { aggregateReportData } from './data/aggregate.js';

// Template HTML
export type {
  MedicalReportStrings,
  RenderMedicalReportArgs,
} from './templates/medical-report-html.js';
export { DISCLAIMER_KEY, renderMedicalReportHtml } from './templates/medical-report-html.js';

// Hashing (SHA-256 via @kinhale/crypto)
export { hashReportContent } from './hashing/sha256-report.js';

// Pipeline principal
export type { GenerateReportArgs, GenerateReportError, GenerateReportResult } from './generate.js';
export { generateMedicalReport, InvalidReportRangeError } from './generate.js';

// Strings loader (pont avec react-i18next)
export type { Translator } from './i18n-strings.js';
export { buildReportStrings } from './i18n-strings.js';
