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
  | 'RM1_NO_ADMIN_IN_HOUSEHOLD';
