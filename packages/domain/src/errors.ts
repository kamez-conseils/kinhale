/**
 * Erreur métier — déclenchée par une règle RMx. Le `code` est stable et
 * consommé par `apps/api` pour mapper vers un statut HTTP et une clé i18n.
 */
export class DomainError extends Error {
  public override readonly name = 'DomainError';

  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export type DomainErrorCode =
  /** RM1 — le dernier Admin tente de partir ou d'être rétrogradé. */
  | 'RM1_LAST_ADMIN_REMOVAL'
  /** RM1 — le foyer ne contient aucun Admin actif (état invalide). */
  | 'RM1_NO_ADMIN_IN_HOUSEHOLD'
  /** RM2 — dose saisie avant la fenêtre de confirmation (refusée). */
  | 'RM2_TOO_EARLY'
  /** RM2 — dose saisie après la fenêtre de rattrapage (> 24 h, refusée). */
  | 'RM2_TOO_LATE'
  /** RM2 — `confirmationWindowMinutes` hors bornes autorisées (10-120). */
  | 'RM2_INVALID_WINDOW'
  /** RM3 — tentative d'attacher un plan à une pompe de type `rescue`. */
  | 'RM3_PLAN_ON_RESCUE_PUMP'
  /** RM4 — prise `rescue` sans symptôme, circonstance ou tag libre. */
  | 'RM4_RESCUE_NOT_DOCUMENTED'
  /** RM6 — double saisie détectée : deux prises mêmes type + pompe à < 2 min. */
  | 'RM6_DUPLICATE_DETECTED'
  /** RM7 — `dosesAdministered` nul ou négatif (décrément absurde). */
  | 'RM7_INVALID_DOSES_AMOUNT'
  /** RM7 — seuil d'alerte non strictement positif. */
  | 'RM7_INVALID_THRESHOLD'
  /** RM7 — tentative de décrémenter une pompe déjà `empty`. */
  | 'RM7_PUMP_ALREADY_EMPTY'
  /** RM7 — tentative de décrémenter une pompe inutilisable (expired / archived). */
  | 'RM7_PUMP_NOT_USABLE'
  /** RM15 — `clientEventId` absent, vide ou non conforme au format UUID v4. */
  | 'RM15_INVALID_CLIENT_EVENT_ID'
  /** RM17 — prise datée dans le futur (strictement après `recordedAtUtc`). */
  | 'RM17_FUTURE_ADMINISTRATION_REFUSED'
  /** RM17 — prise au-delà de 24 h dans le passé, exige une confirmation explicite. */
  | 'RM17_TOO_OLD_REQUIRES_CONFIRMATION'
  /** RM18 — prise déjà en statut `voided` ; annulation idempotente refusée. */
  | 'RM18_ALREADY_VOIDED'
  /** RM18 — le demandeur n'est ni l'auteur dans la fenêtre libre, ni admin. */
  | 'RM18_NOT_AUTHORIZED'
  /** RM18 — hors fenêtre libre : `voidedReason` non vide obligatoire. */
  | 'RM18_VOIDED_REASON_REQUIRED'
  /** RM19 — tentative d'usage d'une pompe expirée sans justification Admin. */
  | 'RM19_PUMP_EXPIRED'
  /** RM25 — `alreadySentSteps` contient une valeur hors {1, 2}. */
  | 'RM25_INVALID_STEP'
  /** RM21 — le foyer a déjà atteint la limite d'invitations actives simultanées. */
  | 'RM21_TOO_MANY_ACTIVE_INVITATIONS'
  /** RM22 — l'aidant invité n'a pas consenti au traitement de ses propres données. */
  | 'RM22_MISSING_INVITEE_CONSENT'
  /** RM22 — tentative de consentir au nom de l'enfant : refus conceptuel (mandat du parent). */
  | 'RM22_INVITEE_CANNOT_CONSENT_FOR_CHILD'
  /** RM22 — l'invitation n'est plus `active` (consumed / expired / revoked). */
  | 'RM22_INVITATION_NOT_ACTIVE'
  /** RM22 — l'invitation est encore `active` mais `expiresAtUtc` est déjà passé. */
  | 'RM22_INVITATION_EXPIRED'
  /** RM22 — le consentement référence une autre invitation (incohérence de flux). */
  | 'RM22_CONSENT_INVITATION_MISMATCH'
  /** RM22 — `consentedAtUtc` est strictement postérieur à `nowUtc` (tricherie d'horloge). */
  | 'RM22_INVALID_CONSENT_TIMESTAMP'
  /** RM23 — géoloc fournie alors que l'aidant n'a pas opt-in. */
  | 'RM23_OPT_IN_MISSING'
  /**
   * RM23 — géoloc fournie par un `restricted_contributor` : refus strict du
   * domaine, quelle que soit la préférence prétendue (règle souveraine).
   */
  | 'RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE'
  /** RM23 — coordonnées hors bornes (`lat ∉ [-90,90]` ou `lon ∉ [-180,180]`, ou non finies). */
  | 'RM23_INVALID_COORDINATES'
  /**
   * RM23 — la préférence fournie ne concerne pas l'auteur de la prise
   * (`authorPreference.caregiverId !== dose.caregiverId`). Vérification
   * défensive contre un bug d'intégration API.
   */
  | 'RM23_PREFERENCE_MISMATCH'
  /** RM24 — `generator` fourni vide ou whitespace-only lors du calcul du pied d'intégrité. */
  | 'RM24_INVALID_GENERATOR'
  /** RM8 — période invalide (ex: `fromUtc` strictement postérieur à `toUtc`). */
  | 'RM8_INVALID_PERIOD'
  /** RM8 — enfant invalide (prénom vide ou année de naissance aberrante). */
  | 'RM8_INVALID_CHILD'
  /** RM16 — payload push contient du contenu interdit (mot-clé santé / PII / titre non générique). */
  | 'RM16_FORBIDDEN_CONTENT'
  /** RM9 — version semver invalide (format `MAJOR.MINOR.PATCH` requis, sans préfixe). */
  | 'RM9_INVALID_VERSION_FORMAT'
  /** RM9 — `acceptedAtUtc` strictement postérieur à `nowUtc` au-delà de la tolérance NTP. */
  | 'RM9_INVALID_ACCEPTANCE_TIMESTAMP'
  /**
   * RM9 — incohérence de flux entre acceptance et version courante :
   * mismatch de `kind` (TOS vs PP), major accepté supérieur à major
   * courant (suspicieux), ou major accepté inférieur (ré-acceptation
   * requise avant de ré-écrire une acceptance du même major).
   */
  | 'RM9_VERSION_MISMATCH'
  /** RM13 — tentative d'ajouter un enfant à un foyer qui a déjà atteint la limite v1.0 (1). */
  | 'RM13_CHILD_LIMIT_REACHED'
  /** RM10 — demande de suppression sur un foyer déjà en `pending_deletion` ou `deleted`. */
  | 'RM10_HOUSEHOLD_NOT_ACTIVE'
  /** RM10 — suppression bloquée : plus d'un Admin actif (passer par W11 transfert d'admin d'abord). */
  | 'RM10_MULTIPLE_ADMINS_PRESENT'
  /** RM10 — le demandeur n'est pas Admin actif du foyer. */
  | 'RM10_NOT_AUTHORIZED'
  /** RM10 — annulation impossible : l'état courant n'est pas `pending_deletion`. */
  | 'RM10_CANNOT_CANCEL'
  /** RM10 — annulation refusée : la période de grâce de 7 jours est expirée. */
  | 'RM10_GRACE_PERIOD_EXPIRED'
  /**
   * RM10 — `auditSalt` invalide (vide, whitespace pur, ou inférieur au seuil
   * minimum `RM10_MIN_AUDIT_SALT_LENGTH`). Protège contre un appel de
   * pseudonymisation sans secret serveur effectif.
   */
  | 'RM10_INVALID_AUDIT_SALT'
  /** RM11 — la requête cible un foyer différent de celui du token (anti-IDOR). */
  | 'RM11_TENANT_MISMATCH'
  /** RM11 — le caregiverId client diffère de celui du token (anti-usurpation). */
  | 'RM11_CAREGIVER_MISMATCH'
  /** RM12 — la session restreinte est expirée (au-delà du TTL 8h). */
  | 'RM12_SESSION_EXPIRED'
  /** RM12 — la session restreinte a été révoquée explicitement par un Admin. */
  | 'RM12_SESSION_REVOKED'
  /** RM12 — seuls les Admins du même foyer peuvent révoquer une session restreinte. */
  | 'RM12_NOT_AUTHORIZED_TO_REVOKE'
  /** RM12 — session déjà révoquée ; la révocation est idempotente mais refuse un double appel. */
  | 'RM12_ALREADY_REVOKED';
