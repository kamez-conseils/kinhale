import type { Household } from '../entities/household';
import type { Invitation } from '../entities/invitation';
import { DomainError } from '../errors';

/**
 * Nombre maximal d'invitations **actives** (status `active` et non encore
 * expirées de facto) qu'un foyer peut avoir simultanément. Au-delà, toute
 * tentative de créer une nouvelle invitation est refusée (SPECS §4 RM21).
 *
 * La borne est stricte : 10 invitations est l'état plafond autorisé ; une
 * 11e création déclenche `RM21_TOO_MANY_ACTIVE_INVITATIONS`.
 */
export const MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD = 10;

/**
 * RM21 — Compte les invitations réellement actives d'une liste.
 *
 * Une invitation est **active** si et seulement si :
 * 1. son `status` est `active` (les transitions `consumed` / `expired` /
 *    `revoked` retirent définitivement l'invitation du quota) ;
 * 2. `expiresAtUtc` est **strictement** postérieur à `nowUtc` (défense en
 *    profondeur : si la tâche de transition n'a pas encore tourné et que
 *    l'invitation est en retard d'un état, on la comptabilise déjà comme
 *    expirée). Une invitation avec `expiresAtUtc === nowUtc` est considérée
 *    expirée.
 *
 * Fonction **pure** : ne mute pas le tableau et ne filtre pas par
 * `householdId` — si l'appelant fournit un lot multi-foyer, le comptage
 * portera sur l'ensemble. Pour un comptage par foyer, utiliser
 * {@link ensureCanCreateInvitation} qui filtre en amont.
 */
export function countActiveInvitations(invitations: readonly Invitation[], nowUtc: Date): number {
  const nowMs = nowUtc.getTime();
  let count = 0;
  for (const inv of invitations) {
    if (inv.status !== 'active') {
      continue;
    }
    if (inv.expiresAtUtc.getTime() <= nowMs) {
      continue;
    }
    count += 1;
  }
  return count;
}

/** Options partagées par {@link ensureCanCreateInvitation} et {@link canCreateInvitation}. */
interface CreateInvitationOptions {
  readonly household: Household;
  readonly existingInvitations: readonly Invitation[];
  readonly nowUtc: Date;
}

/**
 * RM21 — assertion : l'Admin peut-il créer une nouvelle invitation ? Lève
 * `RM21_TOO_MANY_ACTIVE_INVITATIONS` sinon.
 *
 * Les invitations fournies sont **filtrées** par `household.id` avant
 * comptage, pour tolérer un appelant qui passerait une liste multi-foyer.
 *
 * @throws {DomainError} `RM21_TOO_MANY_ACTIVE_INVITATIONS` si le compte
 *   réel atteint {@link MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD}.
 */
export function ensureCanCreateInvitation(options: CreateInvitationOptions): void {
  const { household, existingInvitations, nowUtc } = options;
  const scoped = existingInvitations.filter((i) => i.householdId === household.id);
  const activeCount = countActiveInvitations(scoped, nowUtc);

  if (activeCount >= MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD) {
    throw new DomainError(
      'RM21_TOO_MANY_ACTIVE_INVITATIONS',
      `Household ${household.id} already has ${activeCount} active invitations (limit: ${MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD}).`,
      {
        householdId: household.id,
        activeCount,
        limit: MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD,
      },
    );
  }
}

/**
 * RM21 — prédicat : la création est-elle autorisée ? Retourne un boolean,
 * jamais de lève. Utile pour piloter l'affichage d'un CTA côté UI sans
 * avoir à capturer l'exception.
 */
export function canCreateInvitation(options: CreateInvitationOptions): boolean {
  try {
    ensureCanCreateInvitation(options);
    return true;
  } catch {
    return false;
  }
}
