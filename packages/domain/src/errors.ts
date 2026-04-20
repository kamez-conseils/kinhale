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
  | 'RM6_DUPLICATE_DETECTED';
