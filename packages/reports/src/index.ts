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

// Génération CSV brut (E8-S03)
export type { CsvColumn, CsvReportDose } from './csv/generate-csv.js';
export {
  CSV_COLUMNS,
  CSV_FIELD_SEP,
  CSV_LINE_SEP,
  CSV_MULTI_VALUE_SEP,
  CSV_UTF8_BOM,
  buildCsvDoses,
  escapeCsvValue,
  generateMedicalCsv,
} from './csv/generate-csv.js';

// Export de portabilité RGPD/Loi 25 (E9-S02, KIN-085, ADR-D14)
export type {
  BuildPrivacyArchiveArgs,
  BuildPrivacyArchiveResult,
  RelayAuditEventInfo,
  RelayDeviceInfo,
  RelayExportMetadata,
  RelayNotificationPreferenceInfo,
  RelayQuietHoursInfo,
  SerializedCaregiver,
  SerializedChild,
  SerializedDoc,
  SerializedDose,
  SerializedPlan,
  SerializedPump,
} from './privacy-export/types.js';
export { canonicalJsonStringify, serializeDocForExport } from './privacy-export/serialize-doc.js';
export { buildPrivacyReadme } from './privacy-export/build-readme.js';
export { PRIVACY_ARCHIVE_FILENAMES, buildPrivacyArchive } from './privacy-export/build-archive.js';
