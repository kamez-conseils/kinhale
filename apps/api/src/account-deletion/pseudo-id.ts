/**
 * Pseudonymisation déterministe des `accountId` pour la table
 * `deleted_accounts` (E9-S03 / RM10).
 *
 * **Pourquoi un pepper côté serveur** :
 * - Un simple `SHA-256(accountId)` serait reversible : un attaquant ayant
 *   un accès en lecture à `deleted_accounts` ET à `accounts` (snapshot
 *   ancien, backup) pourrait précomputer tous les `pseudoId` de la table
 *   `accounts` et corréler.
 * - Avec un pepper secret dédié (`env.PSEUDO_ID_PEPPER`, jamais en DB),
 *   même un dump DB ne permet pas la corrélation. Seul un attaquant
 *   détenant aussi le secret d'env peut ré-identifier — ce qui équivaut
 *   à compromettre l'app entière.
 *
 * **Pourquoi un pepper distinct du `JWT_SECRET`** : la rotation du JWT
 * (procédure normale de sécurité — ex-employé) ne doit pas invalider la
 * corrélation `audit_events ↔ deleted_accounts` (Loi 25 / RGPD art. 30).
 * Le `PSEUDO_ID_PEPPER` est une variable dédiée, **jamais rotée** (ou
 * via migration douce double-pepper). Cf. OWASP ASVS V6.2.1 (key
 * separation), kz-securite AUDIT-TRANSVERSE M2.
 *
 * **Pourquoi pas un HMAC** : SHA-256(secret || accountId) est suffisant ici
 * pour empêcher la dérivation directe. HMAC-SHA-256 serait équivalent en
 * sécurité pour ce cas d'usage (les attaques de length-extension ne
 * s'appliquent pas, le pseudoId n'est pas utilisé pour authentifier un
 * message). On reste sur SHA-256 pour rester dans le périmètre des
 * primitives `@kinhale/crypto`.
 *
 * Refs: ADR-D14, KIN-086, E9-S03, RGPD art. 4(5).
 */

import { sha256HexFromString } from '@kinhale/crypto';

/**
 * Calcule le `pseudoId` (hex 64 chars) d'un compte à des fins de traçabilité
 * post-suppression.
 *
 * @param accountId UUID v4 du compte à pseudonymiser.
 * @param pepper Secret côté serveur — `env.PSEUDO_ID_PEPPER` (distinct
 *   du JWT_SECRET, jamais roté). **Ne doit jamais être journalisé**.
 */
export async function computeDeletedAccountPseudoId(
  accountId: string,
  pepper: string,
): Promise<string> {
  // Format `kinhale-deleted-account-v1:<pepper>:<accountId>` — le préfixe
  // versionné permet une rotation future sans collision avec d'éventuelles
  // autres applications du même pepper.
  return sha256HexFromString(`kinhale-deleted-account-v1:${pepper}:${accountId}`);
}
