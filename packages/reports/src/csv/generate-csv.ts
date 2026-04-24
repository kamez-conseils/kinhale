import type { ReportData } from '../data/aggregate.js';

/**
 * Byte Order Mark UTF-8. Présent en tête du CSV pour garantir que Microsoft
 * Excel (et certains tableurs Windows) interprètent correctement les
 * caractères accentués / emoji. Les tableurs modernes (Numbers, LibreOffice,
 * Google Sheets) ignorent le BOM silencieusement.
 *
 * Le BOM compte ici comme une métadonnée d'encodage, **pas** comme du
 * contenu santé : il ne divulgue aucune donnée utilisateur.
 */
export const CSV_UTF8_BOM = '﻿';

/**
 * Colonnes du CSV dans l'**ordre stable** imposé par la story E8-S03.
 *
 * Les noms sont snake_case et anglophones pour maximiser l'interopérabilité
 * avec les outils tiers (Excel, Pandas, SAS, R). L'ordre est **figé** car
 * des scripts d'analyse peuvent référencer les colonnes par index — c'est
 * aussi requis pour le test de déterminisme.
 *
 * Absent volontairement :
 * - `freeFormTag` (fuite potentielle : prénoms de tiers, informations
 *   subjectives qui violeraient RM8 en plus d'exposer des tiers non consentants).
 * - `pump_name` (le nom de pompe peut contenir du vocabulaire pharma — on
 *   exporte `pump_id` opaque. Un destinataire analytique peut joindre
 *   plus tard avec un dictionnaire.)
 * - `caregiver_display_name` (PII d'un tiers — `caregiver_id` opaque suffit).
 */
export const CSV_COLUMNS = [
  'datetime_local',
  'datetime_utc',
  'type',
  'pump_id',
  'dose_count',
  'symptoms',
  'circumstances',
  'caregiver_id',
  'status',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/**
 * Séparateur de ligne du CSV. CRLF (`\r\n`) est **le** séparateur imposé par
 * RFC 4180, et c'est celui attendu par Excel sur Windows. Les tableurs
 * modernes tolèrent aussi LF seul — on reste sur CRLF pour la conformité.
 */
export const CSV_LINE_SEP = '\r\n';

/**
 * Séparateur de champ. Virgule universelle (RFC 4180). On ne bascule **pas**
 * sur `;` pour la locale FR : certains Excel FR interprètent `,` comme
 * séparateur décimal, mais la valeur `dose_count` est toujours entière — et
 * le quoting RFC 4180 protège toutes les valeurs contenant une virgule.
 * Rester sur `,` évite une dépendance fragile à la locale du tableur.
 */
export const CSV_FIELD_SEP = ',';

/**
 * Séparateur interne utilisé dans les colonnes multi-valeurs (`symptoms`,
 * `circumstances`). Le `|` est choisi car :
 * 1. Il est rare dans du texte libre.
 * 2. Il n'entre pas en collision avec le séparateur CSV (`,`).
 * 3. Les outils d'analyse (Pandas `str.split('|')`) le gèrent nativement.
 *
 * Les valeurs sont des **codes stables** (`cough`, `wheezing`, …) issus du
 * domaine — donc sans caractère à risque. Un quoting RFC 4180 est tout de
 * même appliqué au cas où une évolution future introduirait un caractère
 * spécial.
 */
export const CSV_MULTI_VALUE_SEP = '|';

/**
 * Construit l'ISO `YYYY-MM-DDTHH:mm:ss.sssZ` d'un timestamp UTC ms.
 *
 * Utilise `Date.prototype.toISOString` qui est **déterministe** (indépendant
 * du fuseau système ou de la locale JS). Garantit donc la reproductibilité
 * du CSV sur toute machine.
 */
function isoUtc(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Équivalent "local" pour l'affichage. Contrairement au PDF, le CSV est
 * destiné à être lu dans un tableur — l'utilisateur veut voir les dates
 * dans un format lisible. On ré-utilise `toISOString()` (donc UTC) pour
 * rester **déterministe** : un CSV généré sur un Mac à Tokyo et un Mac à
 * Paris donneront exactement le même contenu, condition sine qua non pour
 * que le hash d'intégrité (future extension v1.1) soit stable.
 *
 * La colonne `datetime_local` est tout de même conservée car la story
 * E8-S03 l'exige. Elle pourra être enrichie en v1.1 avec un offset injecté
 * explicitement (paramètre `timezone` au pipeline CSV). Pour v1.0, elle
 * reste égale au champ UTC — le consommateur peut interpréter.
 */
function isoLocal(ms: number): string {
  return isoUtc(ms);
}

/**
 * Échappement CSV conforme **RFC 4180 §2** :
 *
 * > If double-quotes are used to enclose fields, then a double-quote
 * > appearing inside a field must be escaped by preceding it with another
 * > double quote.
 *
 * Règle appliquée :
 * - Si la valeur contient **au moins un** de : `,`, `"`, `\r`, `\n`, on
 *   entoure la valeur de guillemets **et** on double chaque `"` interne.
 * - Sinon on renvoie la valeur telle quelle.
 *
 * Cette fonction est au cœur de la défense anti-injection CSV : elle empêche
 * qu'une valeur libre contenant une virgule ou un saut de ligne ne casse
 * l'alignement des colonnes côté consommateur.
 *
 * **Note Formula Injection** : cette fonction n'empêche pas le "CSV formula
 * injection" (`=cmd|…`). Les colonnes susceptibles d'être manipulées par
 * un attaquant ne sont **pas exportées** (le module `ReportData` exclut
 * `freeFormTag`, `pump.name`, `caregiver.displayName`). Le risque est donc
 * couvert par la minimisation en amont, pas par un préfixage défensif
 * ici — ce qui éviterait aussi de polluer les analyses légitimes.
 */
export function escapeCsvValue(raw: string): string {
  const needsQuoting = /[",\r\n]/.test(raw);
  if (!needsQuoting) return raw;
  const doubled = raw.replace(/"/g, '""');
  return `"${doubled}"`;
}

/**
 * Transforme une liste de codes (symptoms ou circumstances) en un champ CSV.
 * Joint avec `|` puis applique `escapeCsvValue` — belt-and-suspenders.
 */
function joinMultiValue(values: ReadonlyArray<string>): string {
  if (values.length === 0) return '';
  return escapeCsvValue(values.join(CSV_MULTI_VALUE_SEP));
}

/**
 * Projette une `CsvReportDose` en ligne CSV textuelle.
 *
 * Contrat :
 * - **Pas d'accès au `freeFormTag`** (absent de `CsvReportDose` par design).
 * - `dose_count` est un entier littéral (pas de formatage locale).
 * - Les deux colonnes datetime sont des ISO UTC (déterminisme).
 * - `pump_id`, `caregiver_id` sont des UUID opaques ; ils sont re-quotés
 *   par sécurité (même si aucun caractère spécial attendu aujourd'hui).
 */
function renderRow(dose: CsvReportDose): string {
  const fields: Readonly<Record<CsvColumn, string>> = {
    datetime_local: escapeCsvValue(isoLocal(dose.administeredAtMs)),
    datetime_utc: escapeCsvValue(isoUtc(dose.administeredAtMs)),
    type: escapeCsvValue(dose.doseType),
    pump_id: escapeCsvValue(dose.pumpId),
    dose_count: String(dose.dosesAdministered),
    symptoms: joinMultiValue(dose.symptoms),
    circumstances: joinMultiValue(dose.circumstances),
    caregiver_id: escapeCsvValue(dose.caregiverId),
    status: escapeCsvValue(dose.status),
  };
  return CSV_COLUMNS.map((col) => fields[col]).join(CSV_FIELD_SEP);
}

/**
 * Étend le type `ReportDose` utilisé dans l'agrégation avec les champs dont
 * le CSV a besoin mais que le PDF n'expose pas. On **n'enrichit pas**
 * `ReportData` pour ne pas casser le hash d'intégrité du PDF : le CSV est un
 * consommateur parallèle qui lit des champs supplémentaires exposés par la
 * projection Automerge d'origine.
 *
 * En pratique, les appelants (apps web/mobile) passent déjà le doc Automerge
 * et la plage — il leur suffit d'appeler `generateMedicalCsv` qui s'appuie
 * sur les projections de `@kinhale/sync`.
 */
export interface CsvReportDose {
  readonly administeredAtMs: number;
  readonly doseType: 'maintenance' | 'rescue';
  readonly symptoms: ReadonlyArray<string>;
  readonly circumstances: ReadonlyArray<string>;
  readonly status: 'recorded' | 'pending_review' | 'voided';
  readonly pumpId: string;
  readonly caregiverId: string;
  readonly dosesAdministered: number;
}

/**
 * Génère le CSV brut à partir d'une liste ordonnée de doses enrichies.
 *
 * **Pureté** : aucune I/O, aucune horloge, aucun accès réseau. La fonction
 * est déterministe — mêmes inputs → même string. Cette propriété est
 * testée explicitement (test de déterminisme) pour verrouiller le contrat.
 *
 * **Zero-knowledge** : aucune donnée n'est logguée. Le CSV vit uniquement
 * en mémoire de l'appelant et est partagé localement (download ou share
 * sheet OS) — jamais envoyé au relais Kamez.
 *
 * **RM8 (non-interprétatif)** : les champs exportés sont tous factuels.
 * Aucune colonne « severity », « control level », « recommendation ». Un
 * test keyword-filter dédié verrouille cette propriété.
 *
 * @param doses Liste des doses enrichies, pré-ordonnées par l'appelant.
 * @returns Chaîne CSV complète, BOM UTF-8 en tête, CRLF en fin de ligne,
 *   ligne de header en première position.
 */
export function generateMedicalCsv(doses: ReadonlyArray<CsvReportDose>): string {
  const header = CSV_COLUMNS.join(CSV_FIELD_SEP);
  const body = doses.map(renderRow).join(CSV_LINE_SEP);
  const content = body.length === 0 ? header : `${header}${CSV_LINE_SEP}${body}`;
  // Trailing newline final (RFC 4180 §2.2 : optionnel mais canoniquement
  // présent — assure que l'ajout d'une ligne future ne change pas la ligne
  // précédente côté diff).
  return `${CSV_UTF8_BOM}${content}${CSV_LINE_SEP}`;
}

/**
 * Construit une `CsvReportDose` à partir d'une `ReportData` + projections.
 *
 * `ReportData` expose un sous-ensemble restreint (pour RM8). Le CSV a besoin
 * du `pumpId` + `caregiverId` + `dosesAdministered` qui sont disponibles
 * dans la projection Automerge d'origine (`ProjectedDose`). Les appelants
 * web/mobile passent donc les deux sources à la fonction de haut niveau
 * `buildCsvDoses` (helper).
 *
 * **Important** : ne JAMAIS enrichir avec `freeFormTag` ou `pump.name` ou
 * `caregiver.displayName` — ces champs sont volontairement omis (cf. en-tête
 * de fichier).
 */
export function buildCsvDoses(
  data: ReportData,
  lookup: (doseId: string) => {
    pumpId: string;
    caregiverId: string;
    dosesAdministered: number;
  } | null,
): CsvReportDose[] {
  const rows: CsvReportDose[] = [];
  for (const dose of data.doses) {
    const extra = lookup(dose.doseId);
    if (extra === null) continue;
    rows.push({
      administeredAtMs: dose.administeredAtMs,
      doseType: dose.doseType,
      symptoms: dose.symptoms,
      circumstances: dose.circumstances,
      status: dose.status,
      pumpId: extra.pumpId,
      caregiverId: extra.caregiverId,
      dosesAdministered: extra.dosesAdministered,
    });
  }
  return rows;
}
