import type { ReportData, SymptomEntry, WeekBucket } from '../data/aggregate.js';

/**
 * Marqueur DOM stable autour du disclaimer RM8. Utilisé par les tests et
 * facilitera un éventuel audit conformité (kz-conformite) qui pourra
 * localiser le bloc de façon fiable, sans parser le texte.
 */
export const DISCLAIMER_KEY = 'kinhale-report-disclaimer';

/**
 * Chaînes traduites injectées par la couche appelante. Le template est
 * volontairement découplé de `react-i18next` pour rester pur et testable
 * côté Vitest Node sans setup React.
 */
export interface MedicalReportStrings {
  readonly title: string;
  readonly header: {
    readonly child: string;
    readonly range: string;
    readonly generator: string;
    readonly generatedAt: string;
    readonly birthYear: string;
  };
  readonly sections: {
    readonly adherence: string;
    readonly rescueFrequency: string;
    readonly symptomTimeline: string;
  };
  readonly labels: {
    readonly scheduled: string;
    readonly confirmed: string;
    readonly ratio: string;
    readonly pending: string;
    readonly week: string;
    readonly none: string;
  };
  readonly symptom: Readonly<Record<string, string>>;
  readonly circumstance: Readonly<Record<string, string>>;
  readonly disclaimer: string;
  readonly integrity: {
    readonly label: string;
    readonly hashLabel: string;
    readonly generatorLabel: string;
    readonly timestampLabel: string;
  };
}

export interface RenderMedicalReportArgs {
  readonly data: ReportData;
  readonly strings: MedicalReportStrings;
  /** Ex : "Kinhale v1.0.0-preview". Imprimé dans le pied de page intégrité. */
  readonly generator: string;
  /** Horodatage de génération (UTC ms) — injecté pour déterminisme. */
  readonly generatedAtMs: number;
  /** Code BCP-47 pour `lang` + formatage dates (ex : 'fr'). */
  readonly locale: 'fr' | 'en';
  /**
   * Hash SHA-256 hex, **optionnel** : le template peut être rendu une fois
   * sans hash (pour calculer le hash du contenu lui-même), puis re-rendu
   * en ré-injectant le hash dans le pied de page final. Voir
   * {@link renderMedicalReportHtml} pour l'algorithme en deux passes.
   */
  readonly integrityHash?: string;
}

/**
 * Rend le HTML complet du rapport médecin.
 *
 * **Structure A4** : une mise en page CSS orientée portrait (210 × 297 mm),
 * compatible avec `expo-print` (iOS/Android) et `jsPDF.html()` (web). Pas
 * de JS côté document (incompatible rendu PDF), pas de dépendance externe
 * (pas de police distante — risque offline + zero-knowledge).
 *
 * **Déterminisme** : aucun `Date.now()`, `Math.random()`, ni chaîne
 * dépendante de la locale système. Toutes les sources d'entropie sont des
 * paramètres de fonction.
 *
 * **Zero-knowledge** : aucun appel réseau, aucun chargement de police
 * distante (`<link href="https://...">`). Les polices sont les sans-serif
 * système.
 *
 * Refs: W9 (§5.9), RM8 (pas de reco), RM24 (intégrité), ADR-D12.
 */
export function renderMedicalReportHtml(args: RenderMedicalReportArgs): string {
  const { data, strings, generator, generatedAtMs, locale, integrityHash } = args;

  const rangeLabel = `${formatIsoDate(data.range.startMs)} – ${formatIsoDate(data.range.endMs)}`;
  const generatedAtLabel = formatIsoDateTime(generatedAtMs);

  const hashSection =
    integrityHash !== undefined
      ? `<div class="integrity" data-key="kinhale-report-integrity">
    <strong>${escapeHtml(strings.integrity.label)}</strong>
    <div><span>${escapeHtml(strings.integrity.hashLabel)} :</span> <code>${escapeHtml(integrityHash)}</code></div>
    <div><span>${escapeHtml(strings.integrity.generatorLabel)} :</span> ${escapeHtml(generator)}</div>
    <div><span>${escapeHtml(strings.integrity.timestampLabel)} :</span> ${escapeHtml(generatedAtLabel)}</div>
  </div>`
      : '';

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(strings.title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111; font-size: 11pt; line-height: 1.45; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 4mm 0; }
  h2 { font-size: 13pt; margin: 6mm 0 2mm 0; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
  .header { margin-bottom: 6mm; }
  .header dl { display: grid; grid-template-columns: auto 1fr; column-gap: 4mm; row-gap: 1mm; margin: 0; }
  .header dt { font-weight: 600; }
  .adherence-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin: 2mm 0; }
  .adherence-summary .card { border: 1px solid #ddd; padding: 3mm; border-radius: 2mm; }
  .adherence-summary .card .label { font-size: 9pt; color: #666; }
  .adherence-summary .card .value { font-size: 18pt; font-weight: 700; }
  .week-chart { border-collapse: collapse; width: 100%; }
  .week-chart th, .week-chart td { border-bottom: 1px solid #eee; padding: 1mm 2mm; text-align: left; font-size: 10pt; }
  .week-chart .bar { background: #444; height: 3mm; display: inline-block; vertical-align: middle; }
  .timeline { list-style: none; padding: 0; margin: 0; }
  .timeline li { border-left: 2px solid #999; padding: 1mm 0 2mm 3mm; margin-bottom: 1mm; font-size: 10pt; }
  .timeline .date { font-weight: 600; }
  .disclaimer { margin-top: 6mm; border: 1px solid #999; padding: 3mm; background: #f7f7f7; font-size: 9.5pt; }
  .integrity { margin-top: 6mm; font-size: 8.5pt; color: #555; border-top: 1px dashed #bbb; padding-top: 2mm; }
  .integrity code { word-break: break-all; }
  .no-data { color: #666; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(strings.title)}</h1>
    <dl>
      <dt>${escapeHtml(strings.header.child)} :</dt>
      <dd>${escapeHtml(data.childAlias ?? strings.labels.none)}${
        data.childBirthYear !== null
          ? ` <span>(${escapeHtml(strings.header.birthYear)} ${data.childBirthYear})</span>`
          : ''
      }</dd>
      <dt>${escapeHtml(strings.header.range)} :</dt>
      <dd>${escapeHtml(rangeLabel)}</dd>
      <dt>${escapeHtml(strings.header.generator)} :</dt>
      <dd>${escapeHtml(generator)}</dd>
      <dt>${escapeHtml(strings.header.generatedAt)} :</dt>
      <dd>${escapeHtml(generatedAtLabel)}</dd>
    </dl>
  </div>

  <section>
    <h2>${escapeHtml(strings.sections.adherence)}</h2>
    <div class="adherence-summary">
      <div class="card">
        <div class="label">${escapeHtml(strings.labels.scheduled)}</div>
        <div class="value">${data.adherence.scheduled}</div>
      </div>
      <div class="card">
        <div class="label">${escapeHtml(strings.labels.confirmed)}</div>
        <div class="value">${data.adherence.confirmed}</div>
      </div>
      <div class="card">
        <div class="label">${escapeHtml(strings.labels.ratio)}</div>
        <div class="value">${formatRatio(data.adherence.ratio)}</div>
      </div>
    </div>
  </section>

  <section>
    <h2>${escapeHtml(strings.sections.rescueFrequency)}</h2>
    ${renderWeekChart(data.rescueCountByWeek, strings)}
  </section>

  <section>
    <h2>${escapeHtml(strings.sections.symptomTimeline)}</h2>
    ${renderTimeline(data.symptomTimeline, strings)}
  </section>

  <div class="disclaimer" data-key="${DISCLAIMER_KEY}">
    ${escapeHtml(strings.disclaimer)}
  </div>

  ${hashSection}
</body>
</html>`;
}

/**
 * Rend un tableau simple des semaines (pas de SVG : garantit un rendu fidèle
 * dans expo-print sans dépendance à un moteur SVG). Les barres sont des div
 * dont la largeur est proportionnelle à la valeur max, bornée à 60 mm.
 */
function renderWeekChart(weeks: ReadonlyArray<WeekBucket>, strings: MedicalReportStrings): string {
  if (weeks.length === 0) {
    return `<p class="no-data">${escapeHtml(strings.labels.none)}</p>`;
  }
  const max = weeks.reduce((m, w) => (w.count > m ? w.count : m), 0);
  const rows = weeks
    .map((w) => {
      const widthMm = max === 0 ? 0 : Math.max(1, Math.round((w.count / max) * 60));
      return `<tr>
  <td>${escapeHtml(strings.labels.week)} ${escapeHtml(w.weekStartIso)}</td>
  <td><span class="bar" style="width:${widthMm}mm"></span> ${w.count}</td>
</tr>`;
    })
    .join('\n');
  return `<table class="week-chart"><tbody>${rows}</tbody></table>`;
}

function renderTimeline(
  entries: ReadonlyArray<SymptomEntry>,
  strings: MedicalReportStrings,
): string {
  if (entries.length === 0) {
    return `<p class="no-data">${escapeHtml(strings.labels.none)}</p>`;
  }
  const items = entries
    .map((e) => {
      const date = formatIsoDateTime(e.administeredAtMs);
      const symptomLabels = e.symptoms
        .map((s) => strings.symptom[s] ?? s)
        .map(escapeHtml)
        .join(' · ');
      const circLabels = e.circumstances
        .map((c) => strings.circumstance[c] ?? c)
        .map(escapeHtml)
        .join(' · ');
      const parts: string[] = [];
      if (symptomLabels.length > 0) parts.push(symptomLabels);
      if (circLabels.length > 0) parts.push(circLabels);
      const payload = parts.length > 0 ? parts.join(' — ') : escapeHtml(strings.labels.none);
      return `<li><span class="date">${escapeHtml(date)}</span> — ${payload}</li>`;
    })
    .join('\n');
  return `<ul class="timeline">${items}</ul>`;
}

/**
 * Encodeur HTML strict :
 * - Échappe `&`, `<`, `>`, `"`, `'` — couvre les contextes texte et
 *   attribut (les seuls utilisés par le template).
 * - Convertit un nombre/bool en chaîne sans surprise.
 *
 * Défense en profondeur — le template ne consomme déjà que des données
 * filtrées (projections), mais le prénom enfant et le `weekStartIso`
 * passent via ce helper pour garantir qu'aucun `<script>` injecté côté
 * Automerge (via un device compromis) ne puisse être interprété.
 */
function escapeHtml(value: string | number | boolean | null | undefined): string {
  const raw =
    value === null || value === undefined ? '' : typeof value === 'string' ? value : String(value);
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Formatte un timestamp UTC en `YYYY-MM-DD` déterministe. */
function formatIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Formatte un timestamp UTC en `YYYY-MM-DD HH:mm` déterministe. */
function formatIsoDateTime(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}Z`;
}

/** Ratio formaté en pourcentage entier (ex : 0.917 → "92 %"). */
function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0 %';
  const pct = Math.round(ratio * 100);
  return `${pct} %`;
}
