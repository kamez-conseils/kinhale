import type { Circumstance, Dose, Symptom } from '../entities/dose';
import { DomainError } from '../errors';

/**
 * RM8 — Rapport médecin structuré (SPECS §4 RM8 + §W9 export rapport).
 *
 * Ce module produit la **structure canonique** d'un rapport médecin à
 * partir d'un jeu de prises. Aucune I/O ; le rendu PDF est exécuté côté
 * `apps/api` qui consomme cette structure. RM24 en calcule ensuite le pied
 * d'intégrité (hash SHA-256).
 *
 * ## Contenu imposé (SPECS §4 RM8 ligne 332)
 *
 * > « Le rapport médecin inclut toutes les prises `confirmed` (voidées
 * > signalées séparément) sur la plage demandée + un graphique de
 * > fréquence secours/semaine + la liste des symptômes et circonstances. »
 *
 * - `confirmedDoses` : toutes les prises confirmées de la période, triées
 *   chronologiquement croissant par `administeredAtUtc` (RM14 autorité
 *   serveur).
 * - `voidedDoses` : prises voidées signalées séparément (dans leur propre
 *   section), avec `voidedReason` pour que le praticien juge du contexte.
 * - `rescueFrequencyByWeek` : agrégation hebdomadaire (semaine ISO,
 *   lundi-dimanche UTC) du **nombre** de prises rescue confirmées —
 *   PAS le `dosesAdministered`, on compte les événements (chaque
 *   déclenchement de pompe est une crise potentielle).
 * - `symptomsEncountered` : union des symptômes apparus au moins une fois
 *   dans les prises confirmées de la période, dé-dupliqués, ordre de
 *   première occurrence chronologique.
 * - `circumstancesEncountered` : idem pour les circonstances.
 *
 * ## Contenu interdit (ligne rouge dispositif médical)
 *
 * Ce module **ne produit pas**, et la structure de sortie **ne permet
 * pas de porter** :
 *
 * - AUCUNE recommandation de dose (pas de champ `recommendation`)
 * - AUCUNE interprétation de contrôle (pas de champ `interpretation`,
 *   `controlScore`, `asthmaControlTest`)
 * - AUCUN diagnostic (pas de champ `diagnosis`)
 * - AUCUN message d'alerte type « appelez votre médecin » (pas de champ
 *   `alert` / `advice`)
 *
 * Un test explicite (`ligne rouge dispositif médical`) verrouille
 * l'absence de ces champs au runtime. Toute extension doit repasser par
 * `kz-conformite`.
 *
 * ## Frontières de période
 *
 * La période est **inclusive aux deux bornes** :
 * `period.fromUtc <= administeredAtUtc <= period.toUtc`. Choix délibéré —
 * SPECS §RM8 dit « plage demandée » sans préciser ; l'inclusivité est
 * plus intuitive pour un praticien qui demande « du 1er au 30 avril » et
 * s'attend à voir ces deux jours complets inclus. L'appelant qui veut une
 * semaine civile passera `to = dimanche 23:59:59.999`.
 *
 * ## Définition de semaine
 *
 * Les semaines sont **ISO 8601** : lundi 00:00:00.000 UTC → dimanche
 * 23:59:59.999 UTC. Le `weekStartUtc` est toujours un lundi à minuit UTC.
 * Pas d'adaptation au fuseau du praticien — un rapport généré à Montréal
 * (UTC-4) pour un enfant à Paris (UTC+2) verrait sinon deux semaines
 * différentes selon le locuteur. UTC est la seule heure stable.
 *
 * ## Protection des données enfant
 *
 * Le rapport porte uniquement `childFirstName` + `childYearOfBirth`
 * (pas de date complète, pas de nom de famille, pas d'ID). Ce sont les
 * seules données nécessaires pour qu'un praticien identifie son patient
 * sans exposer plus. L'année de naissance suffit à l'anamnèse
 * (« enfant de 5-6 ans ») — la date exacte n'apporte rien de clinique
 * et serait une donnée nominative superflue.
 */

/** Période demandée pour le rapport, bornes **inclusives** aux deux extrémités. */
export interface MedicalReportPeriod {
  readonly fromUtc: Date;
  readonly toUtc: Date;
}

/** Agrégat hebdomadaire du nombre de prises rescue. */
export interface WeeklyRescueFrequency {
  /** Lundi 00:00:00.000 UTC de la semaine ISO. */
  readonly weekStartUtc: Date;
  /** Nombre de prises rescue confirmées dans la semaine. */
  readonly rescueCount: number;
}

/**
 * Résumé d'une prise confirmée tel qu'imprimé dans le rapport. Contient
 * uniquement des champs factuels — ni recommandation, ni interprétation.
 */
export interface ConfirmedDoseSummary {
  readonly doseId: string;
  readonly type: 'maintenance' | 'rescue';
  readonly administeredAtUtc: Date;
  readonly dosesAdministered: number;
  readonly pumpId: string;
  readonly symptoms: ReadonlyArray<Symptom>;
  readonly circumstances: ReadonlyArray<Circumstance>;
  readonly freeFormTag: string | null;
}

/** Résumé d'une prise voidée signalée séparément dans le rapport. */
export interface VoidedDoseSummary {
  readonly doseId: string;
  readonly voidedReason: string | null;
  readonly originalAdministeredAtUtc: Date;
}

/** Rapport médecin canonique. Structure volontairement restreinte (pas de DM). */
export interface MedicalReport {
  readonly period: MedicalReportPeriod;
  readonly childFirstName: string;
  readonly childYearOfBirth: number;
  readonly confirmedDoses: ReadonlyArray<ConfirmedDoseSummary>;
  readonly voidedDoses: ReadonlyArray<VoidedDoseSummary>;
  readonly rescueFrequencyByWeek: ReadonlyArray<WeeklyRescueFrequency>;
  readonly symptomsEncountered: ReadonlyArray<Symptom>;
  readonly circumstancesEncountered: ReadonlyArray<Circumstance>;
}

/** Borne inférieure plausible pour une année de naissance (grands-parents inclus). */
const MIN_BIRTH_YEAR = 1900;

/**
 * RM8 — construit la structure du rapport médecin pour une période donnée.
 *
 * Fonction **pure** : aucune lecture d'horloge, aucun I/O, aucune mutation
 * des inputs. Déterministe pour un même `doses` + `period`.
 *
 * @throws {DomainError} `RM8_INVALID_PERIOD` si `fromUtc > toUtc`.
 * @throws {DomainError} `RM8_INVALID_CHILD` si `childFirstName` est vide
 *   ou whitespace-only, ou si `childYearOfBirth` est hors [1900, année de
 *   `period.toUtc`].
 */
export function buildMedicalReport(options: {
  readonly doses: readonly Dose[];
  readonly period: MedicalReportPeriod;
  readonly childFirstName: string;
  readonly childYearOfBirth: number;
}): MedicalReport {
  const { doses, period, childFirstName, childYearOfBirth } = options;

  // --- Validation période ---
  if (period.fromUtc.getTime() > period.toUtc.getTime()) {
    throw new DomainError(
      'RM8_INVALID_PERIOD',
      `period.fromUtc (${period.fromUtc.toISOString()}) must be <= period.toUtc (${period.toUtc.toISOString()}).`,
    );
  }

  // --- Validation enfant ---
  if (childFirstName.trim().length === 0) {
    throw new DomainError('RM8_INVALID_CHILD', 'childFirstName must be a non-empty string.');
  }
  const periodEndYear = period.toUtc.getUTCFullYear();
  if (
    !Number.isInteger(childYearOfBirth) ||
    childYearOfBirth < MIN_BIRTH_YEAR ||
    childYearOfBirth > periodEndYear
  ) {
    throw new DomainError(
      'RM8_INVALID_CHILD',
      `childYearOfBirth must be an integer in [${MIN_BIRTH_YEAR}, ${periodEndYear}], got ${childYearOfBirth}.`,
    );
  }

  // --- Filtrage période + statut ---
  const fromMs = period.fromUtc.getTime();
  const toMs = period.toUtc.getTime();
  const inPeriod = (d: Dose): boolean => {
    const t = d.administeredAtUtc.getTime();
    return t >= fromMs && t <= toMs;
  };

  const dosesInPeriod = doses.filter(inPeriod);

  const confirmedInPeriod = dosesInPeriod
    .filter((d) => d.status === 'confirmed')
    .slice()
    .sort((a, b) => a.administeredAtUtc.getTime() - b.administeredAtUtc.getTime());

  const voidedInPeriod = dosesInPeriod
    .filter((d) => d.status === 'voided')
    .slice()
    .sort((a, b) => a.administeredAtUtc.getTime() - b.administeredAtUtc.getTime());

  // --- Confirmed summaries ---
  const confirmedDoses: ConfirmedDoseSummary[] = confirmedInPeriod.map((d) => ({
    doseId: d.id,
    type: d.type,
    administeredAtUtc: d.administeredAtUtc,
    dosesAdministered: d.dosesAdministered,
    pumpId: d.pumpId,
    symptoms: d.symptoms,
    circumstances: d.circumstances,
    freeFormTag: d.freeFormTag,
  }));

  // --- Voided summaries ---
  const voidedDoses: VoidedDoseSummary[] = voidedInPeriod.map((d) => ({
    doseId: d.id,
    voidedReason: d.voidedReason,
    originalAdministeredAtUtc: d.administeredAtUtc,
  }));

  // --- Rescue frequency by week (ISO, lundi UTC) ---
  const rescueFrequencyByWeek = aggregateRescuePerWeek(confirmedInPeriod);

  // --- Symptoms / circumstances uniques en ordre de première occurrence ---
  const symptomsEncountered = uniqueInOrder<Symptom>(
    confirmedInPeriod.flatMap((d) => [...d.symptoms]),
  );
  const circumstancesEncountered = uniqueInOrder<Circumstance>(
    confirmedInPeriod.flatMap((d) => [...d.circumstances]),
  );

  return {
    period: { fromUtc: period.fromUtc, toUtc: period.toUtc },
    childFirstName,
    childYearOfBirth,
    confirmedDoses,
    voidedDoses,
    rescueFrequencyByWeek,
    symptomsEncountered,
    circumstancesEncountered,
  };
}

/**
 * Dé-duplique en préservant l'ordre de première occurrence. Pure.
 */
function uniqueInOrder<T>(items: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/**
 * Retourne le début de la semaine ISO (lundi 00:00:00.000 UTC) qui
 * contient la date fournie. Pour une date un lundi à 00:00 UTC, retourne
 * exactement cette date. Pour un dimanche à 23:59:59 UTC, retourne le
 * lundi précédent à 00:00 UTC.
 *
 * Implémentation : `getUTCDay()` renvoie 0 pour dimanche, 1 pour lundi,
 * etc. On calcule l'offset vers le lundi précédent (0 si lundi, 6 si
 * dimanche, etc.) puis on recule la date de cet offset à minuit UTC.
 */
function startOfWeekUtc(date: Date): Date {
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7; // lundi=0, ..., dimanche=6
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday),
  );
  return d;
}

/**
 * Compte le nombre de prises rescue par semaine ISO. Retourne une liste
 * triée chronologiquement croissante par `weekStartUtc`. Seules les prises
 * de type `rescue` contribuent ; les maintenance sont ignorées.
 */
function aggregateRescuePerWeek(
  confirmedDoses: readonly Dose[],
): ReadonlyArray<WeeklyRescueFrequency> {
  const buckets = new Map<number, { weekStartUtc: Date; rescueCount: number }>();
  for (const dose of confirmedDoses) {
    if (dose.type !== 'rescue') {
      continue;
    }
    const weekStart = startOfWeekUtc(dose.administeredAtUtc);
    const key = weekStart.getTime();
    const existing = buckets.get(key);
    if (existing) {
      buckets.set(key, {
        weekStartUtc: existing.weekStartUtc,
        rescueCount: existing.rescueCount + 1,
      });
    } else {
      buckets.set(key, { weekStartUtc: weekStart, rescueCount: 1 });
    }
  }
  return [...buckets.values()].sort((a, b) => a.weekStartUtc.getTime() - b.weekStartUtc.getTime());
}
