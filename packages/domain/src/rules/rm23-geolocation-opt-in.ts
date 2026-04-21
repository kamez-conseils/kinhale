import type { Role } from '../entities/role';
import { DomainError } from '../errors';

/**
 * Coordonnées géographiques attachées à une prise (opt-in strict, RM23).
 *
 * Ces coordonnées sont déclarées côté client et stockées **chiffrées
 * E2EE** : le relais Kamez ne les voit jamais en clair. Le domaine se
 * limite à valider la structure et les contraintes métier (bornes
 * standard du géoïde). La précision (arrondi, bucketing pour réduire la
 * fingerprintabilité) est une décision d'UI/API, hors scope du domaine.
 */
export interface Geolocation {
  /** Latitude en degrés décimaux, plage inclusive `[-90, 90]`. */
  readonly lat: number;
  /** Longitude en degrés décimaux, plage inclusive `[-180, 180]`. */
  readonly lon: number;
}

/**
 * Vue minimale d'une prise pour l'évaluation RM23. Le domaine ne
 * s'intéresse ici qu'au `caregiverId` auteur et à la présence
 * éventuelle d'une géolocalisation. Les autres champs de la prise
 * restent gérés par les règles dédiées (RM2, RM4, RM6…).
 */
export interface DoseWithOptionalGeolocation {
  readonly caregiverId: string;
  readonly geolocation?: Geolocation | null;
}

/**
 * Préférence opt-in géoloc d'un aidant. Par défaut `geolocationOptIn =
 * false`. Stockée côté profil aidant (infra), lue par le domaine lors
 * de la validation d'une saisie.
 *
 * Invariant souverain domaine : quand `role === 'restricted_contributor'`,
 * le domaine refuse la géoloc **quel que soit** `geolocationOptIn` —
 * une session restreinte ne peut jamais opt-in légalement (garderie,
 * nounou, session 8 h). Voir {@link ensureGeolocationAllowed}.
 */
export interface CaregiverGeolocationPreference {
  readonly caregiverId: string;
  readonly role: Role;
  readonly geolocationOptIn: boolean;
}

/** Options partagées par {@link ensureGeolocationAllowed} et {@link isGeolocationAllowed}. */
interface GeolocationOptions {
  readonly dose: DoseWithOptionalGeolocation;
  readonly authorPreference: CaregiverGeolocationPreference;
}

type GeolocationErrorCode =
  | 'RM23_OPT_IN_MISSING'
  | 'RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE'
  | 'RM23_INVALID_COORDINATES'
  | 'RM23_PREFERENCE_MISMATCH';

type GeolocationDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: GeolocationErrorCode; readonly detail: string };

/**
 * RM23 — valide que les coordonnées respectent les bornes standard du
 * géoïde : `lat ∈ [-90, 90]` et `lon ∈ [-180, 180]`, bornes inclusives,
 * valeurs finies (rejette NaN / Infinity).
 *
 * `null` et `undefined` sont considérés valides car l'absence de
 * géolocalisation est toujours un état safe (RM23 refuse l'ajout, pas
 * l'absence).
 */
export function isValidGeolocation(geo: Geolocation | null | undefined): boolean {
  if (geo === null || geo === undefined) {
    return true;
  }
  const { lat, lon } = geo;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

/**
 * RM23 — prédicat : la dose peut-elle porter cette géolocalisation ?
 * Retourne `true` si la règle accepte (dont : absence de géoloc),
 * `false` sinon. Ne lève jamais.
 */
export function isGeolocationAllowed(options: GeolocationOptions): boolean {
  return evaluateGeolocation(options).ok;
}

/**
 * RM23 — assertion : la dose respecte la politique d'opt-in
 * géolocalisation. Refuse dans l'ordre de priorité suivant :
 *
 * 1. `RM23_PREFERENCE_MISMATCH` — `authorPreference.caregiverId` ne
 *    correspond pas à `dose.caregiverId`. Vérification défensive :
 *    l'API est responsable de passer la bonne préférence, mais le
 *    domaine ferme la porte plutôt que d'appliquer une préférence
 *    étrangère à l'auteur.
 * 2. `RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE` — l'auteur est un
 *    `restricted_contributor`. **Règle souveraine** : le domaine
 *    refuse même si `geolocationOptIn === true` (une préférence qui
 *    prétendrait l'opt-in sur ce rôle est un bug amont à clore ici).
 * 3. `RM23_OPT_IN_MISSING` — l'auteur n'a pas opt-in.
 * 4. `RM23_INVALID_COORDINATES` — coordonnées hors bornes ou non
 *    finies.
 *
 * L'absence de géolocalisation (`geolocation` null/undefined) est
 * toujours acceptée, quel que soit le rôle ou l'opt-in. Le
 * `context` d'erreur ne contient **jamais** les coordonnées elles-mêmes
 * (pas plus que `lat`/`lon` comme clés), uniquement `caregiverId` et
 * `role` — métadonnées déjà connues de l'appelant légitime.
 *
 * @throws {DomainError} avec l'un des codes ci-dessus.
 */
export function ensureGeolocationAllowed(options: GeolocationOptions): void {
  const decision = evaluateGeolocation(options);
  if (decision.ok) {
    return;
  }

  throw new DomainError(decision.code, decision.detail, {
    caregiverId: options.dose.caregiverId,
    role: options.authorPreference.role,
  });
}

/**
 * RM23 — sanitize une prise candidate : retourne une nouvelle dose
 * avec `geolocation: null` si la règle ne permet pas d'attacher la
 * géolocalisation, sinon retourne la dose inchangée.
 *
 * Utile côté ingestion pour forcer l'invariant « jamais de géoloc non
 * autorisée » plutôt que rejeter l'ensemble de la prise — si un client
 * buggé joint une géoloc sans opt-in, le domaine préfère strip
 * silencieusement que perdre la prise (qui, elle, est précieuse pour
 * le suivi santé).
 *
 * Fonction **pure** : ne mute ni `dose` ni `authorPreference`.
 */
export function sanitizeDoseGeolocation<D extends DoseWithOptionalGeolocation>(options: {
  readonly dose: D;
  readonly authorPreference: CaregiverGeolocationPreference;
}): D {
  const { dose, authorPreference } = options;
  if (isGeolocationAllowed({ dose, authorPreference })) {
    return dose;
  }
  return { ...dose, geolocation: null };
}

function evaluateGeolocation(options: GeolocationOptions): GeolocationDecision {
  const { dose, authorPreference } = options;

  // Absence de géoloc : toujours safe, court-circuit toutes les vérifications
  // (pas de mismatch à valider tant qu'on n'attache rien).
  if (dose.geolocation === null || dose.geolocation === undefined) {
    return { ok: true };
  }

  // 1. Check défensif : la préférence doit concerner l'auteur de la prise.
  if (authorPreference.caregiverId !== dose.caregiverId) {
    return {
      ok: false,
      code: 'RM23_PREFERENCE_MISMATCH',
      detail: 'authorPreference.caregiverId does not match dose.caregiverId.',
    };
  }

  // 2. Règle souveraine : un restricted_contributor ne peut jamais géolocaliser,
  //    même si la préférence prétend l'opt-in (bug amont ignoré).
  if (authorPreference.role === 'restricted_contributor') {
    return {
      ok: false,
      code: 'RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE',
      detail: 'Restricted contributors cannot attach geolocation to a dose.',
    };
  }

  // 3. Opt-in explicite requis, absent par défaut.
  if (!authorPreference.geolocationOptIn) {
    return {
      ok: false,
      code: 'RM23_OPT_IN_MISSING',
      detail: 'Caregiver has not opted in to attach geolocation to doses.',
    };
  }

  // 4. Bornes du géoïde — dernière ligne de défense.
  if (!isValidGeolocation(dose.geolocation)) {
    return {
      ok: false,
      code: 'RM23_INVALID_COORDINATES',
      detail: 'Geolocation coordinates are out of bounds or not finite.',
    };
  }

  return { ok: true };
}
