import type { Child } from '../entities/child';
import { DomainError } from '../errors';

/**
 * Nombre maximal d'enfants autorisés par foyer en v1.0 (SPECS §4 RM13,
 * ligne 337). La valeur est une constante domaine : toute tentative d'ajout
 * d'un second enfant est refusée tant que v1.0 est en vigueur. En v1.1
 * (voir spec ligne 904), la contrainte 1:1 deviendra 1:N et cette règle
 * sera désactivée en amont (le domaine sera mis à jour à ce moment-là, pas
 * piloté par feature flag).
 */
export const CHILDREN_PER_HOUSEHOLD_LIMIT_V1 = 1;

/**
 * RM13 — Compte les enfants d'un foyer donné dans une liste potentiellement
 * multi-foyer. Fonction **pure** : ne mute pas le tableau.
 *
 * Le filtrage par `householdId` est strict : un enfant dont le
 * `householdId` diffère de l'argument n'est jamais comptabilisé. Cela rend
 * l'appel sûr quel que soit le bruit d'amont (liste paginée, fuite
 * multi-foyer, doublon).
 */
export function countChildrenInHousehold(children: readonly Child[], householdId: string): number {
  let count = 0;
  for (const child of children) {
    if (child.householdId === householdId) {
      count += 1;
    }
  }
  return count;
}

/** Options partagées par {@link canAddChild} et {@link ensureCanAddChild}. */
interface AddChildOptions {
  readonly existingChildren: readonly Child[];
  readonly householdId: string;
}

/**
 * RM13 — prédicat : peut-on ajouter un enfant au foyer ? Retourne un
 * boolean, jamais de lève. Utile pour piloter l'UI (masquer le CTA
 * « Ajouter un enfant » en v1.0 dès qu'un enfant existe, afficher le
 * teasing v1.1 — voir spec ligne 598 / E9).
 */
export function canAddChild(options: AddChildOptions): boolean {
  const { existingChildren, householdId } = options;
  return countChildrenInHousehold(existingChildren, householdId) < CHILDREN_PER_HOUSEHOLD_LIMIT_V1;
}

/**
 * RM13 — assertion : refuse la création si le foyer atteint déjà la limite
 * v1.0. Lève `RM13_CHILD_LIMIT_REACHED` sinon.
 *
 * Le `context` d'erreur ne contient **jamais** ni prénom ni identifiant
 * d'enfant — uniquement `householdId`, `currentCount`, `limit`. Mapper
 * côté API : HTTP 409 `feature_not_yet_available`, body i18n pointant vers
 * le roadmap v1.1 (SPECS §4 RM13, ligne 337).
 *
 * @throws {DomainError} `RM13_CHILD_LIMIT_REACHED` si le foyer héberge
 *   déjà `CHILDREN_PER_HOUSEHOLD_LIMIT_V1` enfants ou plus (état
 *   incohérent inclus — on bloque la création dans les deux cas).
 */
export function ensureCanAddChild(options: AddChildOptions): void {
  const { existingChildren, householdId } = options;
  const currentCount = countChildrenInHousehold(existingChildren, householdId);

  if (currentCount >= CHILDREN_PER_HOUSEHOLD_LIMIT_V1) {
    throw new DomainError(
      'RM13_CHILD_LIMIT_REACHED',
      `Household ${householdId} has already reached the v1.0 child limit (${CHILDREN_PER_HOUSEHOLD_LIMIT_V1}).`,
      {
        householdId,
        currentCount,
        limit: CHILDREN_PER_HOUSEHOLD_LIMIT_V1,
      },
    );
  }
}
