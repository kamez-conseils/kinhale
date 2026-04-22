import { DomainError } from '../errors';

/**
 * RM11 — Isolation multi-tenant stricte (SPECS §4 RM11).
 *
 * Chaque foyer est un tenant isolé. Une requête backend doit **toujours**
 * filtrer les données par `household_id` **extrait du token** (JWT /
 * session serveur), jamais d'un paramètre client. Cette règle est la
 * défense anti-IDOR (Insecure Direct Object Reference) : un attaquant
 * authentifié ne doit pas pouvoir lire ou muter les données d'un autre
 * foyer en remplaçant un `householdId` dans l'URL ou le body.
 *
 * ## Rôle côté domaine vs côté API
 *
 * La **vraie** défense vit côté middleware `apps/api` qui extrait
 * `householdId` et `caregiverId` depuis le token signé serveur et ne doit
 * JAMAIS accepter ces valeurs depuis `req.body` ou `req.params`. Toute
 * requête construit un `TenantContext` à partir du token, unique source
 * de vérité.
 *
 * Ce module offre un **garde-fou domaine réutilisable** (belt-and-
 * suspenders) pour les handlers qui, par erreur, lisent un
 * `householdId` depuis le body. Appelé en tête de chaque use-case, il
 * transforme une faille silencieuse en erreur bruyante.
 *
 * ## Anti-fuite d'information
 *
 * Les erreurs levées par {@link ensureSameTenant} ne contiennent
 * **jamais** les valeurs réelles (tokenHouseholdId, tokenCaregiverId,
 * targetHouseholdId, clientClaimedCaregiverId). Le contexte est un
 * simple marqueur d'incohérence — sinon un attaquant pourrait sonder
 * l'existence d'un foyer ou corréler un caregiverId.
 */

/** Contexte tenant extrait du token serveur. Source unique de vérité. */
export interface TenantContext {
  /** householdId extrait du token JWT/session — JAMAIS d'un paramètre client. */
  readonly tokenHouseholdId: string;
  /** caregiverId extrait du token — JAMAIS d'un paramètre client. */
  readonly tokenCaregiverId: string;
}

/**
 * Cible d'une requête telle que déclarée par le client. Ces valeurs
 * proviennent du body / params et sont considérées **potentiellement
 * hostiles** : elles doivent être croisées avec le token.
 */
export interface TenantTargetRequest {
  /** householdId cité par le client (body / params). */
  readonly targetHouseholdId: string;
  /** caregiverId optionnellement cité par le client. Non toujours requis. */
  readonly clientClaimedCaregiverId?: string;
}

/** Options partagées entre les fonctions publiques. */
interface RM11Options {
  readonly context: TenantContext;
  readonly request: TenantTargetRequest;
}

type TenantErrorCode = 'RM11_TENANT_MISMATCH' | 'RM11_CAREGIVER_MISMATCH';

type TenantDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: TenantErrorCode; readonly detail: string };

/**
 * RM11 — prédicat : la requête est-elle alignée avec le tenant du token ?
 * Retourne un boolean, jamais de lève. Utile en lecture (filtre UI,
 * capability check).
 */
export function isSameTenant(options: RM11Options): boolean {
  return evaluate(options).ok;
}

/**
 * RM11 — assertion : lève `RM11_TENANT_MISMATCH` ou
 * `RM11_CAREGIVER_MISMATCH` en cas d'incohérence.
 *
 * Priorité : tenant vérifié **avant** caregiver — une fuite de foyer est
 * strictement plus grave qu'une usurpation de caregiver intra-foyer.
 *
 * Comparaison **strictement case-sensitive** : un UUID en majuscules ne
 * match pas un UUID en minuscules. On ne normalise pas — la normalisation
 * est la responsabilité de la couche qui émet les tokens et la base. Le
 * pire serait d'introduire une normalisation qui diverge entre les
 * couches et ouvrirait un contournement subtil.
 *
 * @throws {DomainError} `RM11_TENANT_MISMATCH` ou `RM11_CAREGIVER_MISMATCH`.
 *   Le `context` de l'erreur ne contient **aucune** valeur réelle
 *   (anti-fuite). Seul le code d'erreur porte de l'information.
 */
export function ensureSameTenant(options: RM11Options): void {
  const decision = evaluate(options);
  if (decision.ok) {
    return;
  }
  // context volontairement vide : anti-fuite. Le code d'erreur suffit au
  // client légitime pour afficher un message i18n ; l'audit trail côté
  // API logge ses propres contextes (déjà connus du serveur).
  throw new DomainError(decision.code, decision.detail, {});
}

function evaluate(options: RM11Options): TenantDecision {
  const { context, request } = options;

  if (request.targetHouseholdId !== context.tokenHouseholdId) {
    return {
      ok: false,
      code: 'RM11_TENANT_MISMATCH',
      detail: 'Target householdId does not match the token householdId.',
    };
  }

  if (
    request.clientClaimedCaregiverId !== undefined &&
    request.clientClaimedCaregiverId !== context.tokenCaregiverId
  ) {
    return {
      ok: false,
      code: 'RM11_CAREGIVER_MISMATCH',
      detail: 'Client-claimed caregiverId does not match the token caregiverId.',
    };
  }

  return { ok: true };
}
