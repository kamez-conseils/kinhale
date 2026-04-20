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
  'ventoline',
  'salbutamol',
  'salbu',
  'médicament',
  'medicament',
  'antibio',
  // Symptômes / crise / contexte médical
  'asthme',
  'symptôme',
  'symptome',
  'crise',
  'oppression',
  'respiration',
  'toux',
  'sifflement',
  'essoufflement',
  'allergène',
  'allergene',
  // Contexte soignant
  'médecin',
  'medecin',
  'hôpital',
  'hopital',
  'urgences',
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
  'administer',
  'ventolin',
  'albuterol',
  'salbutamol',
  'medication',
  'medicine',
  // Symptômes / crise / contexte médical
  'asthma',
  'symptom',
  'attack',
  'tightness',
  'breathing',
  'cough',
  'wheezing',
  'shortness',
  'allergen',
  // Contexte soignant
  'doctor',
  'physician',
  'hospital',
  'emergency',
];

/** Kinds de violations détectables par {@link validatePushPayload}. */
export type PushPayloadViolationKind =
  | 'forbidden_keyword'
  | 'suspected_pii'
  | 'title_not_generic'
  | 'body_length_exceeded'
  | 'invalid_household_id'
  | 'invalid_notification_id';

/**
 * Violation détectée sur un payload push. Le champ `detail` est
 * **délibérément non révélateur** : il ne contient jamais la valeur
 * offensante (keyword, PII, title/body) pour éviter qu'un logger qui
 * sérialiserait ce contexte en JSON structuré fuite la donnée même que
 * RM16 protège. Le `kind` + `field` suffisent au dev pour reproduire
 * l'erreur localement avec des fixtures synthétiques.
 */
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
 * entrée que des identifiants opaques — il est impossible d'y injecter
 * une donnée santé par construction. Le title et le body sont toujours
 * les constantes génériques `PUSH_TITLE_GENERIC` / `PUSH_BODY_GENERIC`
 * (pas d'override en v1.0 : un override strict serait un no-op, un
 * override libre ouvrirait une porte à l'injection). Si une localisation
 * du body est nécessaire en v1.1+, ajouter une API dédiée validée en
 * conformité.
 *
 * @throws {DomainError} `RM16_FORBIDDEN_CONTENT` si `householdId` ou
 *   `notificationId` ne sont pas des UUID v4.
 */
export function buildSafePushPayload(options: {
  readonly householdId: string;
  readonly notificationId: string;
}): SafePushPayload {
  const payload: SafePushPayload = {
    title: PUSH_TITLE_GENERIC,
    body: PUSH_BODY_GENERIC,
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
  // Les `detail` ci-dessous ne contiennent JAMAIS la valeur offensante
  // (title, body, keyword, PII, ID) pour éviter qu'un logger structuré
  // ne fuite, via context d'erreur, la donnée même que RM16 protège.
  if (payload.title !== PUSH_TITLE_GENERIC) {
    violations.push({
      field: 'title',
      kind: 'title_not_generic',
      detail: 'title differs from the generic title',
    });
  }

  // --- Body : longueur (garde-fou anti-payload structuré, pas limite APNs) ---
  if (payload.body.length > PUSH_BODY_MAX_LENGTH) {
    violations.push({
      field: 'body',
      kind: 'body_length_exceeded',
      detail: `body exceeds max length ${PUSH_BODY_MAX_LENGTH}`,
    });
  }

  // --- Body : mots-clés interdits (FR + EN) ---
  const lowerBody = payload.body.normalize('NFC').toLowerCase();
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
        detail: 'body contains a forbidden medical keyword',
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
      if (lowerBody.includes(normalized.normalize('NFC').toLowerCase())) {
        violations.push({
          field: 'body',
          kind: 'suspected_pii',
          detail: 'body contains a known sensitive string',
        });
      }
    }
  }

  // --- IDs : format UUID v4 ---
  if (!UUID_V4_REGEX.test(payload.householdId)) {
    violations.push({
      field: 'householdId',
      kind: 'invalid_household_id',
      detail: 'householdId is not a UUID v4',
    });
  }
  if (!UUID_V4_REGEX.test(payload.notificationId)) {
    violations.push({
      field: 'notificationId',
      kind: 'invalid_notification_id',
      detail: 'notificationId is not a UUID v4',
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
    // Le message et le context ne contiennent QUE des kinds/fields
    // génériques — jamais la valeur offensante. Un reviewer peut
    // reproduire l'erreur localement avec des fixtures synthétiques.
    throw new DomainError(
      'RM16_FORBIDDEN_CONTENT',
      `push payload has ${violations.length} safety violation(s)`,
      { violations },
    );
  }
}
