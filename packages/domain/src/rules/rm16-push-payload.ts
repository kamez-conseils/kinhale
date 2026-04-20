import { DomainError } from '../errors';

/**
 * RM16 — Jamais de donnée santé dans les push (SPECS §4 RM16 + CA18).
 *
 * Kinhale respecte une promesse zero-knowledge : le payload transmis aux
 * services OS (APNs / FCM) **ne doit contenir aucune donnée santé en clair**.
 * Il n'embarque qu'un identifiant opaque (`notificationId`) qui déclenche,
 * à l'ouverture, un fetch authentifié côté client pour récupérer le
 * contenu chiffré réel.
 *
 * Ce module fournit deux responsabilités :
 *
 * 1. **Constructeur sûr par construction** : {@link buildSafePushPayload}
 *    ne prend en entrée que des identifiants opaques et un texte générique
 *    (title = "Kinhale", body = "Nouvelle activité"). Impossible d'y
 *    injecter une donnée santé sans passer par un `Override` dont la valeur
 *    est ensuite validée.
 *
 * 2. **Validateur défensif** : {@link validatePushPayload} et
 *    {@link ensurePushPayloadSafe} parcourent un payload déjà formé pour y
 *    détecter des violations (mots-clés médicaux, PII connue, titre non
 *    générique, longueur suspecte, IDs non-UUID). C'est la porte de sortie
 *    qu'un test CI CA18 peut activer sur n'importe quel chemin qui produit
 *    un payload, pour détecter une régression.
 *
 * ## Sémantique de détection
 *
 * La détection est **grossière mais utile** : elle vise les erreurs
 * manifestes (quelqu'un qui injecte `dose` ou `secours` par étourderie),
 * pas à prouver l'absence de fuite — la preuve est structurelle (zéro
 * donnée santé transite jamais par la fonction de construction).
 *
 * - **Matching par inclusion** (substring insensible à la casse) plutôt
 *   que par word boundaries : les `\b` de JavaScript sont ASCII-only et
 *   ne gèrent pas `é`, `à`, apostrophes courbes, ponctuation Unicode.
 *   L'inclusion est plus large (faux positifs possibles, ex: `dose`
 *   comme partie d'un nom de famille), mais en pratique les corpus de
 *   push ne sont pas des œuvres littéraires — les faux positifs sont
 *   acceptables quand la règle vise à bloquer un mot-clé santé.
 *
 * - **Racines plutôt que mots** : on détecte `administr` (couvre
 *   "administré", "administrée", "administer", "administered",
 *   "administration") plutôt que de maintenir N variantes morphologiques.
 *
 * - **Pas de normalisation NFC/NFD** : la chaîne est prise telle quelle.
 *   La liste `FORBIDDEN_PUSH_KEYWORDS_*` est écrite en NFC — si un payload
 *   arrive en NFD (rare en JS qui sérialise en NFC par défaut) la détection
 *   peut rater. Documenté pour le reviewer.
 *
 * ## Ligne rouge dispositif médical
 *
 * Le titre doit rester **strictement générique** (`Kinhale`). Toute
 * variante (ex: `Alerte médicale`, `Kinhale - Crise`) est flaggée
 * `title_not_generic`. Raison : un titre de notification apparaît sur
 * l'écran verrouillé de l'appareil et devient lisible par tout tiers
 * — même un "Kinhale - Nouvelle prise" fuiterait que l'utilisateur
 * utilise une app d'asthme, ce qui reste une donnée santé.
 */

/** Titre générique imposé pour tout payload push v1.0. */
export const PUSH_TITLE_GENERIC = 'Kinhale';

/** Corps générique par défaut — peut être remplacé par une variante i18n. */
export const PUSH_BODY_GENERIC = 'Nouvelle activité';

/**
 * Longueur maximale du `body` (défense en profondeur contre un payload qui
 * embarquerait beaucoup de données structurées). Les textes génériques FR/EN
 * font < 30 caractères ; 200 laisse une marge pour les locales verbeuses.
 */
export const PUSH_BODY_MAX_LENGTH = 200;

/**
 * Regex UUID v4. Miroir de {@link UUID_V4_REGEX} défini dans RM15 — dupliqué
 * ici plutôt qu'importé pour éviter un couplage inutile entre règles.
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Mots-clés / racines interdits en FR dans le corps d'une notification push.
 * Ordonnés par thématique (santé respiratoire puis pharmacologie). Liste
 * non exhaustive — son but est de flagger les erreurs manifestes. Toute
 * extension doit être revue par `kz-conformite` (ligne rouge DM).
 */
export const FORBIDDEN_PUSH_KEYWORDS_FR: ReadonlyArray<string> = [
  // Pharmacologie / dispositif
  'dose',
  'pompe',
  'inhalateur',
  'secours',
  'prescription',
  'posologie',
  'administr', // administré, administrée, administration
  // Symptômes / crise
  'symptôme',
  'symptome', // tolérance variante sans accent
  'crise',
  'respiration',
  'toux',
  'sifflement',
  'essoufflement',
  'allergène',
  'allergene',
];

/**
 * Mots-clés / racines interdits en EN. Même principe que la liste FR.
 */
export const FORBIDDEN_PUSH_KEYWORDS_EN: ReadonlyArray<string> = [
  // Pharmacologie / dispositif
  'dose',
  'pump',
  'inhaler',
  'rescue',
  'prescription',
  'administer', // administered, administration
  // Symptômes / crise
  'symptom',
  'attack',
  'breathing',
  'cough',
  'wheezing',
  'shortness',
  'allergen',
];

/** Kinds de violations détectables par {@link validatePushPayload}. */
export type PushPayloadViolationKind =
  | 'forbidden_keyword'
  | 'suspected_pii'
  | 'title_not_generic'
  | 'non_ascii_length_exceeded'
  | 'invalid_household_id'
  | 'invalid_notification_id';

export interface PushPayloadViolation {
  readonly field: 'title' | 'body' | 'householdId' | 'notificationId';
  readonly kind: PushPayloadViolationKind;
  readonly detail: string;
}

/**
 * Payload push minimal transmis aux services OS (APNs / FCM). Aucune
 * donnée santé : uniquement un titre générique, un corps générique, et
 * deux identifiants opaques permettant au client de récupérer le
 * contenu chiffré réel via un appel authentifié à l'ouverture.
 */
export interface SafePushPayload {
  readonly title: string;
  readonly body: string;
  readonly householdId: string;
  readonly notificationId: string;
}

/**
 * Construit un payload push sûr pour un événement donné. Ne prend en
 * entrée que des identifiants opaques + un contexte générique — il est
 * impossible d'y injecter une donnée santé par construction. Valide les
 * IDs en UUID v4 et lève `RM16_FORBIDDEN_CONTENT` si les overrides
 * fournis contiennent déjà une violation (défense en profondeur contre
 * un appelant qui passerait un `bodyOverride` avec une donnée santé).
 *
 * @throws {DomainError} `RM16_FORBIDDEN_CONTENT` si `householdId` /
 *   `notificationId` ne sont pas des UUID v4, ou si les overrides
 *   produisent un payload non safe.
 */
export function buildSafePushPayload(options: {
  readonly householdId: string;
  readonly notificationId: string;
  readonly titleOverride?: string;
  readonly bodyOverride?: string;
}): SafePushPayload {
  const payload: SafePushPayload = {
    title: options.titleOverride ?? PUSH_TITLE_GENERIC,
    body: options.bodyOverride ?? PUSH_BODY_GENERIC,
    householdId: options.householdId,
    notificationId: options.notificationId,
  };

  ensurePushPayloadSafe(payload);
  return payload;
}

/**
 * Valide qu'un payload push ne contient aucune donnée santé ni mot-clé
 * médical suspect (prénom enfant, nom pompe, lexique secours, dose, etc.).
 * Retourne les violations trouvées sans lever.
 *
 * @param payload payload à inspecter (non muté).
 * @param knownForbiddenStrings chaînes dynamiques supplémentaires à
 *   détecter (typiquement : prénom enfant, nom de pompe en clair). Les
 *   entrées vides ou whitespace-only sont ignorées silencieusement.
 */
export function validatePushPayload(
  payload: SafePushPayload,
  knownForbiddenStrings?: ReadonlyArray<string>,
): ReadonlyArray<PushPayloadViolation> {
  const violations: PushPayloadViolation[] = [];

  // --- Title : doit être strictement générique ---
  if (payload.title !== PUSH_TITLE_GENERIC) {
    violations.push({
      field: 'title',
      kind: 'title_not_generic',
      detail: `title must be exactly "${PUSH_TITLE_GENERIC}", got "${payload.title}"`,
    });
  }

  // --- Body : longueur ---
  if (payload.body.length > PUSH_BODY_MAX_LENGTH) {
    violations.push({
      field: 'body',
      kind: 'non_ascii_length_exceeded',
      detail: `body length ${payload.body.length} exceeds max ${PUSH_BODY_MAX_LENGTH}`,
    });
  }

  // --- Body : mots-clés interdits (FR + EN) ---
  const lowerBody = payload.body.toLowerCase();
  const allKeywords = [...FORBIDDEN_PUSH_KEYWORDS_FR, ...FORBIDDEN_PUSH_KEYWORDS_EN];
  const seenKeywords = new Set<string>();
  for (const keyword of allKeywords) {
    const lowerKeyword = keyword.toLowerCase();
    if (seenKeywords.has(lowerKeyword)) {
      continue;
    }
    if (lowerBody.includes(lowerKeyword)) {
      seenKeywords.add(lowerKeyword);
      violations.push({
        field: 'body',
        kind: 'forbidden_keyword',
        detail: `body contains forbidden keyword "${keyword}"`,
      });
    }
  }

  // --- Body : PII dynamique (ex: prénom enfant, nom de pompe) ---
  if (knownForbiddenStrings) {
    for (const raw of knownForbiddenStrings) {
      const normalized = raw.trim();
      if (normalized.length === 0) {
        continue;
      }
      if (lowerBody.includes(normalized.toLowerCase())) {
        violations.push({
          field: 'body',
          kind: 'suspected_pii',
          detail: `body contains suspected PII "${normalized}"`,
        });
      }
    }
  }

  // --- IDs : format UUID v4 ---
  if (!UUID_V4_REGEX.test(payload.householdId)) {
    violations.push({
      field: 'householdId',
      kind: 'invalid_household_id',
      detail: `householdId is not a UUID v4: "${payload.householdId}"`,
    });
  }
  if (!UUID_V4_REGEX.test(payload.notificationId)) {
    violations.push({
      field: 'notificationId',
      kind: 'invalid_notification_id',
      detail: `notificationId is not a UUID v4: "${payload.notificationId}"`,
    });
  }

  return violations;
}

/**
 * Variante assertive de {@link validatePushPayload}. Lève
 * `RM16_FORBIDDEN_CONTENT` si des violations sont détectées. Le `context`
 * de l'erreur contient le tableau des violations pour inspection.
 *
 * @throws {DomainError} `RM16_FORBIDDEN_CONTENT`
 */
export function ensurePushPayloadSafe(
  payload: SafePushPayload,
  knownForbiddenStrings?: ReadonlyArray<string>,
): void {
  const violations = validatePushPayload(payload, knownForbiddenStrings);
  if (violations.length > 0) {
    throw new DomainError(
      'RM16_FORBIDDEN_CONTENT',
      `push payload contains ${violations.length} violation(s): ${violations
        .map((v) => `${v.field}/${v.kind}`)
        .join(', ')}`,
      { violations },
    );
  }
}
