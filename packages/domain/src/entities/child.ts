/**
 * Enfant suivi par le foyer. Un seul enfant autorisé par foyer en v1.0
 * (RM13). Aucune donnée santé ici — ces données vivent dans le document
 * Automerge local, jamais dans les entités du relais.
 */
export interface Child {
  readonly id: string;
  readonly householdId: string;
  readonly firstName: string;
  readonly birthYear: number;
  readonly createdAt: Date;
}
