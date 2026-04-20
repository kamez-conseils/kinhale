import { DomainError } from '../errors';
import { CLOCK_SKEW_TOLERANCE_MS } from './rm14-recorded-timestamp';

/**
 * Documents de consentement obligatoires à la création de compte puis à
 * chaque bump majeur (SPECS §4 RM9, ligne 333).
 *
 * Les valeurs sont stables côté API — ne pas renommer sans migration
 * explicite.
 */
export type DocumentKind = 'terms_of_service' | 'privacy_policy';

const DOCUMENT_KINDS_CANONICAL_ORDER: ReadonlyArray<DocumentKind> = [
  'terms_of_service',
  'privacy_policy',
];

/**
 * Version publiée d'un document de consentement. Le `version` suit le format
 * semver strict `MAJOR.MINOR.PATCH` (trois segments numériques entiers non
 * négatifs, sans préfixe `v`, sans pre-release). Un bump majeur bloque
 * l'usage jusqu'à ré-acceptation ; `MINOR` et `PATCH` sont considérés
 * comme rétro-compatibles vis-à-vis du consentement.
 */
export interface DocumentVersion {
  readonly kind: DocumentKind;
  /** Format strict `MAJOR.MINOR.PATCH`. */
  readonly version: string;
  readonly publishedAtUtc: Date;
}

/**
 * Acceptation horodatée d'un document par un utilisateur. Jamais
 * pré-cochée côté UI (contrainte UX, RM9 ligne 333). Le domaine ne peut
 * pas prouver l'explicitness de l'interaction UI (pas de télémétrie d'event
 * `click`), mais exige la cohérence minimale :
 * - `acceptedAtUtc` pas dans le futur au-delà de la tolérance NTP,
 * - `kind` cohérent avec le document auquel il est confronté,
 * - `acceptedVersion` au format semver valide.
 *
 * Le contrat vers la couche application est documenté : l'API qui
 * enregistre une acceptation DOIT s'assurer que l'utilisateur a explicitement
 * coché la case (pas de valeur par défaut `true` côté formulaire).
 */
export interface DocumentAcceptance {
  readonly kind: DocumentKind;
  /** Version acceptée (semver strict). */
  readonly acceptedVersion: string;
  readonly acceptedAtUtc: Date;
  readonly userId: string;
}

/**
 * Résultat de l'évaluation globale du consentement d'un utilisateur.
 *
 * Sémantique de priorité (ordre décroissant) :
 * 1. `never_accepted` — au moins un document n'a jamais été accepté. C'est
 *    le cas de la création de compte et de l'ajout d'un nouveau type de
 *    document en cours de vie produit.
 * 2. `major_bump_requires_reacceptance` — tous les documents ont été
 *    acceptés un jour, mais un ou plusieurs ont subi un bump majeur depuis.
 * 3. `all_accepted_current` — utilisateur à jour (bumps minor/patch inclus).
 *
 * Si les deux états 1 et 2 coexistent (doc A jamais accepté, doc B
 * obsolète), on remonte `never_accepted` avec uniquement le doc A dans
 * `missing`. La couche application décide de l'UI unifiée ; le domaine
 * expose l'état le plus grave de manière déterministe.
 */
export type ConsentStatus =
  | { readonly kind: 'all_accepted_current' }
  | {
      readonly kind: 'major_bump_requires_reacceptance';
      readonly outdated: ReadonlyArray<DocumentKind>;
    }
  | {
      readonly kind: 'never_accepted';
      readonly missing: ReadonlyArray<DocumentKind>;
    };

/**
 * RM9 — Extrait le numéro major d'une version semver stricte.
 *
 * Accepte exactement trois segments entiers non négatifs, séparés par `.`.
 * Aucun préfixe, aucune pre-release, aucune tolérance.
 *
 * @throws {DomainError} `RM9_INVALID_VERSION_FORMAT` si le format diverge.
 */
export function parseMajorVersion(version: string): number {
  return parseSemverOrThrow(version).major;
}

interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

const SEMVER_STRICT_REGEX = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function parseSemverOrThrow(version: string): ParsedSemver {
  if (typeof version !== 'string' || version.length === 0) {
    throw new DomainError('RM9_INVALID_VERSION_FORMAT', 'Version is empty or not a string.', {
      reason: 'empty',
    });
  }

  const match = SEMVER_STRICT_REGEX.exec(version);
  if (match === null) {
    throw new DomainError(
      'RM9_INVALID_VERSION_FORMAT',
      `Version "${version}" is not in strict MAJOR.MINOR.PATCH format.`,
      { reason: 'format' },
    );
  }

  // Les trois groupes sont garantis par le regex ; on convertit sans risque.
  const [, majorStr, minorStr, patchStr] = match;
  return {
    major: Number.parseInt(majorStr as string, 10),
    minor: Number.parseInt(minorStr as string, 10),
    patch: Number.parseInt(patchStr as string, 10),
  };
}

function tryParseSemver(version: string): ParsedSemver | null {
  try {
    return parseSemverOrThrow(version);
  } catch {
    return null;
  }
}

/**
 * RM9 — Évalue l'état global de consentement d'un utilisateur par rapport
 * aux versions courantes publiées des documents. Fonction **pure** :
 * inputs non mutés.
 *
 * Sélection de l'acceptation pertinente : pour un `kind` donné, si
 * plusieurs acceptations existent dans la liste (cas normal à chaque
 * ré-acceptation post-major), la plus récente par `acceptedAtUtc` est
 * retenue. Les acceptations d'un `kind` absent de `currentVersions` sont
 * ignorées (cohérent avec un retrait progressif d'un document obsolète).
 */
export function evaluateConsentStatus(options: {
  readonly currentVersions: ReadonlyArray<DocumentVersion>;
  readonly acceptances: ReadonlyArray<DocumentAcceptance>;
}): ConsentStatus {
  const { currentVersions, acceptances } = options;

  const latestByKind = new Map<DocumentKind, DocumentAcceptance>();
  for (const acceptance of acceptances) {
    const previous = latestByKind.get(acceptance.kind);
    if (
      previous === undefined ||
      acceptance.acceptedAtUtc.getTime() > previous.acceptedAtUtc.getTime()
    ) {
      latestByKind.set(acceptance.kind, acceptance);
    }
  }

  const missing: DocumentKind[] = [];
  const outdated: DocumentKind[] = [];

  for (const kind of DOCUMENT_KINDS_CANONICAL_ORDER) {
    const current = currentVersions.find((v) => v.kind === kind);
    if (current === undefined) {
      continue;
    }

    const latest = latestByKind.get(kind);
    if (latest === undefined) {
      missing.push(kind);
      continue;
    }

    const currentParsed = tryParseSemver(current.version);
    const acceptedParsed = tryParseSemver(latest.acceptedVersion);

    // Versions invalides côté config : on ne peut pas certifier la validité
    // → on remonte comme jamais accepté, solution conservative.
    if (currentParsed === null || acceptedParsed === null) {
      missing.push(kind);
      continue;
    }

    if (acceptedParsed.major < currentParsed.major) {
      outdated.push(kind);
    }
    // Cas acceptedParsed.major > currentParsed.major : donnée suspecte,
    // mais `evaluateConsentStatus` ne lève pas — on considère l'utilisateur
    // à jour par défaut (pas de blocage UX), tandis que
    // `ensureAcceptanceValid` refuse à l'écriture.
  }

  if (missing.length > 0) {
    return { kind: 'never_accepted', missing };
  }
  if (outdated.length > 0) {
    return { kind: 'major_bump_requires_reacceptance', outdated };
  }
  return { kind: 'all_accepted_current' };
}

/** Options partagées par {@link ensureAcceptanceValid} et {@link isAcceptanceValid}. */
interface AcceptanceValidationOptions {
  readonly acceptance: DocumentAcceptance;
  readonly currentVersion: DocumentVersion;
  readonly nowUtc: Date;
}

/**
 * RM9 — prédicat : l'acceptation est-elle valide vis-à-vis de la version
 * courante du document ? Retourne un boolean, jamais de lève.
 */
export function isAcceptanceValid(options: AcceptanceValidationOptions): boolean {
  try {
    ensureAcceptanceValid(options);
    return true;
  } catch {
    return false;
  }
}

/**
 * RM9 — assertion : refuse une acceptation invalide au moment de
 * l'enregistrement par l'API.
 *
 * Contrats d'erreur :
 * - `RM9_INVALID_VERSION_FORMAT` : `acceptedVersion` (ou `currentVersion`)
 *   n'est pas au format `MAJOR.MINOR.PATCH`.
 * - `RM9_INVALID_ACCEPTANCE_TIMESTAMP` : `acceptedAtUtc > nowUtc` au-delà
 *   de la tolérance NTP {@link CLOCK_SKEW_TOLERANCE_MS} partagée avec RM14
 *   et RM22. Un écart inférieur est accepté silencieusement (bruit NTP).
 * - `RM9_VERSION_MISMATCH` : le `kind` de l'acceptation diffère du `kind`
 *   de la version courante (incohérence de flux), OU le major accepté est
 *   strictement supérieur au major courant (tricherie / mauvaise config),
 *   OU le major accepté est strictement inférieur au major courant (major
 *   bump en cours, l'utilisateur doit ré-accepter la version courante).
 *
 * Le `context` d'erreur ne contient **jamais** `userId`. Il expose
 * uniquement le `kind` et les versions impliquées pour debug côté API.
 *
 * Ce contrat couvre le chemin d'écriture. Pour la décision de blocage
 * globale (« faut-il forcer l'utilisateur à ré-accepter avant toute
 * action ? »), utiliser {@link evaluateConsentStatus}.
 */
export function ensureAcceptanceValid(options: AcceptanceValidationOptions): void {
  const { acceptance, currentVersion, nowUtc } = options;

  // 1. `kind` cohérent — on ne mélange pas TOS et PP à l'enregistrement.
  if (acceptance.kind !== currentVersion.kind) {
    throw new DomainError(
      'RM9_VERSION_MISMATCH',
      `Acceptance kind "${acceptance.kind}" does not match current version kind "${currentVersion.kind}".`,
      {
        acceptedKind: acceptance.kind,
        currentKind: currentVersion.kind,
      },
    );
  }

  // 2. Formats semver stricts des deux côtés.
  const currentParsed = parseSemverOrThrow(currentVersion.version);
  const acceptedParsed = parseSemverOrThrow(acceptance.acceptedVersion);

  // 3. Tricherie d'horloge : acceptance pas dans le futur au-delà de la
  //    tolérance partagée RM14/RM22.
  if (acceptance.acceptedAtUtc.getTime() > nowUtc.getTime() + CLOCK_SKEW_TOLERANCE_MS) {
    throw new DomainError(
      'RM9_INVALID_ACCEPTANCE_TIMESTAMP',
      'acceptedAtUtc is in the future beyond the accepted clock-skew tolerance.',
      {
        kind: acceptance.kind,
        acceptedVersion: acceptance.acceptedVersion,
      },
    );
  }

  // 4. Major strictement supérieur côté acceptance : suspicieux (client
  //    tente d'accepter une version qui n'existe pas encore).
  if (acceptedParsed.major > currentParsed.major) {
    throw new DomainError(
      'RM9_VERSION_MISMATCH',
      `Accepted major ${acceptedParsed.major} is greater than current major ${currentParsed.major} for ${acceptance.kind}.`,
      {
        kind: acceptance.kind,
        acceptedVersion: acceptance.acceptedVersion,
        currentVersion: currentVersion.version,
      },
    );
  }

  // 5. Major strictement inférieur : bump majeur intervenu, il faut
  //    ré-accepter la version courante.
  if (acceptedParsed.major < currentParsed.major) {
    throw new DomainError(
      'RM9_VERSION_MISMATCH',
      `Accepted major ${acceptedParsed.major} is lower than current major ${currentParsed.major} for ${acceptance.kind} — re-acceptance required.`,
      {
        kind: acceptance.kind,
        acceptedVersion: acceptance.acceptedVersion,
        currentVersion: currentVersion.version,
      },
    );
  }
}
