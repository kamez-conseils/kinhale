import type { MedicalReportStrings } from './templates/medical-report-html.js';

/**
 * Type utilitaire représentant une fonction i18n pluggée (t-style). Les
 * apps web/mobile passent leur `useTranslation('common').t` : on reste
 * agnostique du moteur i18n (compatibilité Jest React Native et
 * Vitest/jsdom).
 */
export type Translator = (key: string, fallback?: string) => string;

/**
 * Construit l'objet `MedicalReportStrings` à partir d'une fonction `t`.
 *
 * Conventions :
 * - Toutes les clés vivent sous le namespace `report.*` dans `common.json`.
 * - Les codes symptômes/circonstances sont alignés sur ceux de
 *   `journal.symptom.*` / `journal.circumstance.*` (déjà présents en v1.0).
 *
 * Le template `medical-report-html` est volontairement découplé de
 * `react-i18next` pour rester testable en pur Node (aucun setup React) —
 * c'est cette fonction qui fait le pont quand l'appelant est côté app.
 */
export function buildReportStrings(t: Translator): MedicalReportStrings {
  return {
    title: t('report.title'),
    header: {
      child: t('report.header.child'),
      range: t('report.header.range'),
      generator: t('report.header.generator'),
      generatedAt: t('report.header.generatedAt'),
      birthYear: t('report.header.birthYear'),
    },
    sections: {
      adherence: t('report.sections.adherence'),
      rescueFrequency: t('report.sections.rescueFrequency'),
      symptomTimeline: t('report.sections.symptomTimeline'),
    },
    labels: {
      scheduled: t('report.labels.scheduled'),
      confirmed: t('report.labels.confirmed'),
      ratio: t('report.labels.ratio'),
      pending: t('report.labels.pending'),
      week: t('report.labels.week'),
      none: t('report.labels.none'),
    },
    symptom: {
      cough: t('journal.symptom.cough'),
      wheezing: t('journal.symptom.wheezing'),
      shortness_of_breath: t('journal.symptom.shortness_of_breath'),
      chest_tightness: t('journal.symptom.chest_tightness'),
    },
    circumstance: {
      exercise: t('journal.circumstance.exercise'),
      allergen: t('journal.circumstance.allergen'),
      cold_air: t('journal.circumstance.cold_air'),
      night: t('journal.circumstance.night'),
      infection: t('journal.circumstance.infection'),
      stress: t('journal.circumstance.stress'),
    },
    disclaimer: t('report.disclaimer'),
    integrity: {
      label: t('report.integrity.label'),
      hashLabel: t('report.integrity.hashLabel'),
      generatorLabel: t('report.integrity.generatorLabel'),
      timestampLabel: t('report.integrity.timestampLabel'),
    },
  };
}
