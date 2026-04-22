import type { Caregiver } from './caregiver';

/**
 * Foyer — unité de partage. Contient un enfant (v1.0 : un seul, cf. RM13),
 * des aidants, des pompes et des plans de traitement. Côté domaine, on
 * raisonne sur les listes d'aidants actifs uniquement : les invitations non
 * consommées ou révoquées n'entrent pas dans le comptage RM1.
 */
export interface Household {
  readonly id: string;
  readonly createdAt: Date;
  readonly timezone: string;
  readonly locale: 'fr' | 'en';
  readonly caregivers: ReadonlyArray<Caregiver>;
}

/** Raccourci pour filtrer les aidants actifs d'un foyer. */
export function activeCaregivers(household: Household): ReadonlyArray<Caregiver> {
  return household.caregivers.filter((c) => c.status === 'active');
}

/** Raccourci pour filtrer les admins actifs d'un foyer. */
export function activeAdmins(household: Household): ReadonlyArray<Caregiver> {
  return activeCaregivers(household).filter((c) => c.role === 'admin');
}
