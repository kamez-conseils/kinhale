import { activeAdmins } from '../entities/household';
import type { Household } from '../entities/household';
import { DomainError } from '../errors';

/**
 * RM1 — Un foyer doit avoir **au moins un Admin actif** à tout moment.
 *
 * Cette fonction est appelée avant toute opération susceptible de diminuer
 * le nombre d'Admins actifs : retrait d'un aidant, rétrogradation,
 * révocation, suppression de compte.
 *
 * @param household État du foyer avant l'opération.
 * @param options.removingCaregiverId L'aidant qu'on s'apprête à retirer ou rétrograder.
 *                                    Si non fourni, on vérifie juste qu'il existe déjà
 *                                    au moins un Admin actif.
 * @throws {DomainError} `RM1_NO_ADMIN_IN_HOUSEHOLD` si le foyer n'a aucun Admin actif.
 * @throws {DomainError} `RM1_LAST_ADMIN_REMOVAL` si l'opération laisserait le foyer sans Admin.
 */
export function ensureAtLeastOneAdmin(
  household: Household,
  options: { removingCaregiverId?: string } = {},
): void {
  const admins = activeAdmins(household);

  if (admins.length === 0) {
    throw new DomainError(
      'RM1_NO_ADMIN_IN_HOUSEHOLD',
      `Household ${household.id} has no active admin — invalid state.`,
      { householdId: household.id },
    );
  }

  if (options.removingCaregiverId === undefined) {
    return;
  }

  const remaining = admins.filter((c) => c.id !== options.removingCaregiverId);
  if (remaining.length === 0) {
    throw new DomainError(
      'RM1_LAST_ADMIN_REMOVAL',
      `Cannot remove caregiver ${options.removingCaregiverId}: would leave household ${household.id} without any active admin.`,
      {
        householdId: household.id,
        removingCaregiverId: options.removingCaregiverId,
        activeAdminCount: admins.length,
      },
    );
  }
}
