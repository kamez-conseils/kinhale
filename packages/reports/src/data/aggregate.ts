import {
  projectChild,
  projectDoses,
  projectPlan,
  type KinhaleDoc,
  type ProjectedDose,
} from '@kinhale/sync';
import { MS_PER_DAY, type DateRange } from '../range/date-range.js';

/**
 * Données agrégées du rapport médecin — structure pure consommée par le
 * template HTML. **Aucune** propriété ne doit contenir de contenu santé
 * non filtré (ex. `freeFormTag`) : ce champ est volontairement absent car
 * il peut contenir des informations sensibles (prénoms de tiers, etc.)
 * qui ne conviennent pas à un document destiné au médecin (RM8).
 */
export interface ReportData {
  /** Prénom enfant ou null si non renseigné. Source : `ChildRegistered`. */
  readonly childAlias: string | null;
  /** Année de naissance (source `ChildRegistered`) ou null. Utilisée pour dériver un âge approximatif. */
  readonly childBirthYear: number | null;
  /** Plage effective couverte (recopiée pour le template). */
  readonly range: DateRange;
  /** Doses (maintenance + rescue) strictement incluses dans `[startMs, endMs]`, triées par `administeredAtMs` desc. */
  readonly doses: ReadonlyArray<ReportDose>;
  /** Comptage prises de secours par semaine UTC (lundi → dimanche). */
  readonly rescueCountByWeek: ReadonlyArray<WeekBucket>;
  /** Timeline chronologique (décroissante) des événements symptomatiques (prises secours avec symptômes/circonstances). */
  readonly symptomTimeline: ReadonlyArray<SymptomEntry>;
  /** Résumé observance plan de fond. */
  readonly adherence: AdherenceSummary;
}

/**
 * Dose minimaliste exposée au template — sous-ensemble strict de la
 * projection. `freeFormTag` est volontairement exclu (cf. RM8 — le
 * rapport médecin est un relevé factuel, pas un carnet de bord annotatif).
 */
export interface ReportDose {
  readonly doseId: string;
  readonly administeredAtMs: number;
  readonly doseType: 'maintenance' | 'rescue';
  readonly symptoms: ReadonlyArray<string>;
  readonly circumstances: ReadonlyArray<string>;
  readonly status: 'recorded' | 'pending_review' | 'voided';
}

export interface WeekBucket {
  /** ISO du lundi de la semaine UTC (YYYY-MM-DD, 00:00:00Z). Clé d'affichage. */
  readonly weekStartIso: string;
  /** Nombre de prises rescue pendant cette semaine. */
  readonly count: number;
}

export interface SymptomEntry {
  readonly doseId: string;
  readonly administeredAtMs: number;
  readonly symptoms: ReadonlyArray<string>;
  readonly circumstances: ReadonlyArray<string>;
}

export interface AdherenceSummary {
  /** Nombre total de créneaux prévus par le plan sur la plage (0 si pas de plan). */
  readonly scheduled: number;
  /** Nombre total de prises `maintenance` confirmées sur la plage. */
  readonly confirmed: number;
  /** Ratio `confirmed / scheduled`. 0 si `scheduled === 0` (pas de division par zéro). */
  readonly ratio: number;
}

const HOURS_IN_DAY = 24;

/**
 * Construit l'agrégation du rapport médecin depuis un doc Automerge local.
 *
 * Propriétés clés :
 * - **Pure** : aucun effet de bord, aucun accès DOM, aucun `Date.now()` caché.
 *   Les tests peuvent fixer `range` arbitrairement.
 * - **Déterministe** : l'ordre des sorties dépend strictement des inputs et
 *   de clés stables (doseId/date iso). Crucial pour garantir la
 *   reproductibilité du hash SHA-256 (RM24).
 * - **Zero-knowledge** : n'utilise que les projections déjà sécurisées, et
 *   n'émet aucun log / aucun appel réseau.
 *
 * @param doc Document Automerge déchiffré localement.
 * @param range Plage de dates validée (voir `validateDateRange`).
 */
export function aggregateReportData(doc: KinhaleDoc, range: DateRange): ReportData {
  const child = projectChild(doc);
  const allDoses = projectDoses(doc);

  const dosesInRange = allDoses.filter(
    (d) =>
      Number.isFinite(d.administeredAtMs) &&
      d.administeredAtMs >= range.startMs &&
      d.administeredAtMs <= range.endMs,
  );

  const reportDoses: ReportDose[] = dosesInRange
    .map((d) => ({
      doseId: d.doseId,
      administeredAtMs: d.administeredAtMs,
      doseType: d.doseType,
      // Recopie des tableaux pour éviter une fuite de référence vers la projection
      // (défensif : garantit l'immuabilité côté consumer).
      symptoms: [...d.symptoms],
      circumstances: [...d.circumstances],
      status: d.status,
    }))
    .sort((a, b) => b.administeredAtMs - a.administeredAtMs);

  const rescueCountByWeek = buildRescueWeeks(dosesInRange, range);
  const symptomTimeline = buildSymptomTimeline(dosesInRange);
  const adherence = computeAdherence(doc, range, dosesInRange);

  return {
    childAlias: child?.firstName ?? null,
    childBirthYear: child?.birthYear ?? null,
    range,
    doses: reportDoses,
    rescueCountByWeek,
    symptomTimeline,
    adherence,
  };
}

/**
 * Construit la liste des semaines UTC couvertes par `range`. Chaque semaine
 * commence le lundi UTC (ISO week style) pour lisibilité. Les semaines sans
 * prise rescue sont émises à `count: 0` pour garder un axe temporel complet
 * sur le graphique du PDF (le médecin voit la continuité).
 */
function buildRescueWeeks(doses: ReadonlyArray<ProjectedDose>, range: DateRange): WeekBucket[] {
  if (range.endMs <= range.startMs) return [];

  const startMondayUtc = mondayUtcOf(range.startMs);
  const endMondayUtc = mondayUtcOf(range.endMs);
  const weeks: WeekBucket[] = [];
  const countByWeek = new Map<string, number>();

  for (const dose of doses) {
    if (dose.doseType !== 'rescue') continue;
    const weekKey = toIsoDateOnly(mondayUtcOf(dose.administeredAtMs));
    countByWeek.set(weekKey, (countByWeek.get(weekKey) ?? 0) + 1);
  }

  let cursor = startMondayUtc;
  while (cursor <= endMondayUtc) {
    const key = toIsoDateOnly(cursor);
    weeks.push({ weekStartIso: key, count: countByWeek.get(key) ?? 0 });
    cursor += 7 * MS_PER_DAY;
  }
  return weeks;
}

/**
 * Timeline filtrée des symptômes : uniquement les doses avec au moins un
 * symptôme ou une circonstance (une prise rescue muette apporte peu
 * d'information au médecin). Triée par `administeredAtMs` décroissant.
 */
function buildSymptomTimeline(doses: ReadonlyArray<ProjectedDose>): SymptomEntry[] {
  return doses
    .filter((d) => d.symptoms.length > 0 || d.circumstances.length > 0)
    .map((d) => ({
      doseId: d.doseId,
      administeredAtMs: d.administeredAtMs,
      symptoms: [...d.symptoms],
      circumstances: [...d.circumstances],
    }))
    .sort((a, b) => b.administeredAtMs - a.administeredAtMs);
}

/**
 * Observance : calcule un ratio simple `confirmed / scheduled` où
 * - `scheduled` = nombre de créneaux du plan tombant dans la plage, bornés
 *   par `planStart` et `planEnd` (null = ouvert).
 * - `confirmed` = nombre de doses `maintenance` (toutes pompes confondues)
 *   administrées dans la plage. RM8 précise que le rapport médecin inclut
 *   toutes les prises `confirmed` (`voided` signalées séparément, hors scope
 *   E8-S02).
 *
 * **Non-interprétatif** (RM8) : ce ratio est une donnée brute, jamais
 * traduite en « bon »/« mauvais » niveau de contrôle. Le template affiche
 * la valeur nue.
 */
function computeAdherence(
  doc: KinhaleDoc,
  range: DateRange,
  dosesInRange: ReadonlyArray<ProjectedDose>,
): AdherenceSummary {
  const plan = projectPlan(doc);
  if (plan === null) {
    const confirmedMaintenance = dosesInRange.filter((d) => d.doseType === 'maintenance').length;
    return { scheduled: 0, confirmed: confirmedMaintenance, ratio: 0 };
  }

  const planStart = Math.max(plan.startAtMs, range.startMs);
  const planEnd = plan.endAtMs !== null ? Math.min(plan.endAtMs, range.endMs) : range.endMs;

  if (planStart >= planEnd) {
    const confirmedMaintenance = dosesInRange.filter((d) => d.doseType === 'maintenance').length;
    return { scheduled: 0, confirmed: confirmedMaintenance, ratio: 0 };
  }

  const validHours = plan.scheduledHoursUtc.filter(
    (h) => Number.isFinite(h) && h >= 0 && h < HOURS_IN_DAY,
  );
  if (validHours.length === 0) {
    const confirmedMaintenance = dosesInRange.filter((d) => d.doseType === 'maintenance').length;
    return { scheduled: 0, confirmed: confirmedMaintenance, ratio: 0 };
  }

  // Itération jour par jour UTC : pour chaque jour dans [planStart, planEnd],
  // on compte le nombre d'heures cibles tombant dans cet intervalle. Approche
  // naïve mais robuste (≤ 730 jours × 24 h = ~17k itérations au pire ; largement
  // sous le budget p95 5 s sur device moderne).
  const startDayUtc = dayUtcFloor(planStart);
  const endDayUtc = dayUtcFloor(planEnd);
  let scheduled = 0;
  for (let day = startDayUtc; day <= endDayUtc; day += MS_PER_DAY) {
    for (const hour of validHours) {
      const slotMs = day + Math.floor(hour) * 60 * 60 * 1_000;
      if (slotMs >= planStart && slotMs <= planEnd) scheduled += 1;
    }
  }

  const confirmed = dosesInRange.filter((d) => d.doseType === 'maintenance').length;
  const ratio = scheduled > 0 ? confirmed / scheduled : 0;
  return { scheduled, confirmed, ratio };
}

/**
 * Retourne le timestamp UTC 00:00:00 du lundi de la semaine contenant `ms`.
 * Algorithme :
 * - `getUTCDay()` renvoie 0 (dim) → 6 (sam).
 * - Offset au lundi : `(day + 6) % 7` → lundi = 0, dim = 6.
 */
function mondayUtcOf(ms: number): number {
  const d = new Date(ms);
  const dayOfWeek = d.getUTCDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset, 0, 0, 0, 0);
}

function dayUtcFloor(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0);
}

function toIsoDateOnly(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
