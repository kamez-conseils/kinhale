/**
 * Plage de dates du rapport médecin (E8-S01).
 *
 * Bornes inclusives en UTC ms. Toute la validation et le rendu utilisent
 * cette représentation homogène — les conversions TZ (affichage humain)
 * sont de la responsabilité des couches UI, jamais du package reports.
 */
export interface DateRange {
  /** Début de plage inclus (UTC ms). */
  readonly startMs: number;
  /** Fin de plage inclus (UTC ms). */
  readonly endMs: number;
}

/** Milli-secondes dans un jour de 24 h (hors DST — la plage est UTC pure). */
export const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/**
 * Plafond haut de la plage — contrainte perf (AC E8-S01).
 *
 * Au-delà de 24 mois d'historique, la génération PDF peut dépasser le budget
 * p95 de 5 s (O3) sur device bas de gamme, et le rendu graphique 2 pages
 * cesse d'être lisible. Le refus est explicite pour que l'UI affiche un
 * message compréhensible plutôt que de laisser le user attendre.
 *
 * 24 mois sont matérialisés en jours fixes (24 × 30 = 720 j) pour garder
 * une comparaison triviale et déterministe qui ne dépend pas d'un calendrier
 * local — la sémantique produit est « pas plus de deux ans d'historique ».
 */
export const MAX_RANGE_MONTHS = 24;
const MAX_RANGE_MS = MAX_RANGE_MONTHS * 30 * MS_PER_DAY;

/** Presets offerts dans l'UI (E8-S01). */
export type RangePreset = '30d' | '90d';

/**
 * Construit une plage pré-configurée finissant à `nowMs` (passé en dépendance
 * pour rester pur/testable — aucun `Date.now()` caché ici).
 */
export function presetRange(preset: RangePreset, nowMs: number): DateRange {
  const days = preset === '30d' ? 30 : 90;
  return { startMs: nowMs - days * MS_PER_DAY, endMs: nowMs };
}

/**
 * Erreurs de validation renvoyées à l'UI. Les clés sont stables côté
 * front pour mapper un message i18n — ne jamais les renommer sans
 * migration coordonnée.
 */
export type DateRangeValidationError = 'invalid_timestamp' | 'invalid_order' | 'range_too_large';

/** Résultat d'une validation de plage. */
export type DateRangeValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DateRangeValidationError };

/**
 * Valide une plage en entrée UI.
 *
 * Contrôles :
 * 1. Timestamps finis (NaN / ±Infinity rejetés — défense contre `new Date("")`).
 * 2. `endMs > startMs` strict (une plage vide n'a pas de sens métier).
 * 3. Durée ≤ {@link MAX_RANGE_MONTHS} mois (perf O3).
 *
 * Aucun `console` : la règle ESLint no-console est active et la zero-knowledge
 * impose de ne pas logger de métadonnées utilisateur.
 */
export function validateDateRange(range: DateRange): DateRangeValidationResult {
  if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)) {
    return { ok: false, error: 'invalid_timestamp' };
  }
  if (range.endMs <= range.startMs) {
    return { ok: false, error: 'invalid_order' };
  }
  if (range.endMs - range.startMs > MAX_RANGE_MS) {
    return { ok: false, error: 'range_too_large' };
  }
  return { ok: true };
}
