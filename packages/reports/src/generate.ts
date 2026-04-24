import type { KinhaleDoc } from '@kinhale/sync';
import { aggregateReportData } from './data/aggregate.js';
import { hashReportContent } from './hashing/sha256-report.js';
import type { DateRange } from './range/date-range.js';
import { validateDateRange } from './range/date-range.js';
import {
  renderMedicalReportHtml,
  type MedicalReportStrings,
  type RenderMedicalReportArgs,
} from './templates/medical-report-html.js';

export interface GenerateReportArgs {
  readonly doc: KinhaleDoc;
  readonly range: DateRange;
  readonly strings: MedicalReportStrings;
  readonly generator: string;
  readonly generatedAtMs: number;
  readonly locale: 'fr' | 'en';
}

export interface GenerateReportResult {
  /** HTML final (avec hash intégrité dans le pied de page). Prêt à imprimer. */
  readonly html: string;
  /** Hash SHA-256 hex (64 chars) du contenu **sans le bloc intégrité**. */
  readonly contentHash: string;
  /** Plage copiée pour debug / audit trail. */
  readonly range: DateRange;
  /** Timestamp de génération — repris tel quel côté audit. */
  readonly generatedAtMs: number;
}

/** Motifs d'erreur renvoyés par `generateMedicalReport`. */
export type GenerateReportError = 'invalid_timestamp' | 'invalid_order' | 'range_too_large';

/**
 * Erreur typée (discriminée) levée uniquement sur validation de plage.
 *
 * Toutes les autres phases (agrégation, rendu, hash) sont pures et
 * déterministes — elles ne peuvent pas échouer en dehors d'un crash runtime
 * majeur (Web Crypto indisponible). C'est pour cela qu'on utilise un
 * `throw` classique pour ce signal singulier plutôt qu'un Result type
 * partout (coût ergonomique disproportionné).
 */
export class InvalidReportRangeError extends Error {
  constructor(public readonly reason: GenerateReportError) {
    super(`Invalid report range: ${reason}`);
    this.name = 'InvalidReportRangeError';
  }
}

/**
 * Pipeline principal : valide la plage → agrège → rend → hash → ré-injecte
 * le hash dans le pied de page intégrité.
 *
 * Algorithme en **deux passes** pour respecter RM24 :
 * 1. Rendu du HTML **sans** le bloc intégrité → source canonique.
 * 2. Hash SHA-256 de cette source canonique.
 * 3. Rendu final **avec** le bloc intégrité (hash + generator + timestamp).
 *
 * Le médecin peut vérifier l'intégrité en recalculant étape 1 à partir
 * du doc Automerge et de la plage, et en comparant à `contentHash` imprimé
 * sur le PDF.
 *
 * Refs: W9, RM8, RM24, ADR-D12.
 */
export async function generateMedicalReport(
  args: GenerateReportArgs,
): Promise<GenerateReportResult> {
  const validation = validateDateRange(args.range);
  if (!validation.ok) {
    throw new InvalidReportRangeError(validation.error);
  }

  const data = aggregateReportData(args.doc, args.range);

  const baseRenderArgs: RenderMedicalReportArgs = {
    data,
    strings: args.strings,
    generator: args.generator,
    generatedAtMs: args.generatedAtMs,
    locale: args.locale,
  };

  // Passe 1 : canonical content (sans hash) → hash SHA-256.
  const canonicalHtml = renderMedicalReportHtml(baseRenderArgs);
  const contentHash = await hashReportContent(canonicalHtml);

  // Passe 2 : HTML final avec pied de page intégrité.
  const finalHtml = renderMedicalReportHtml({
    ...baseRenderArgs,
    integrityHash: contentHash,
  });

  return {
    html: finalHtml,
    contentHash,
    range: args.range,
    generatedAtMs: args.generatedAtMs,
  };
}
