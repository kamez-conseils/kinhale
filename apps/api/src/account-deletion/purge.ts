/**
 * Service de purge effective des comptes en `pending_deletion` arrivés à
 * expiration (E9-S03 / RM10).
 *
 * **Idempotence** : le service tolère les exécutions concurrentes du
 * worker (ex: deux instances API en parallèle). La logique repose sur :
 * - La transaction SQL : tout ou rien sur les DELETE en cascade.
 * - Le `pseudoId` est PRIMARY KEY de `deleted_accounts` →
 *   `INSERT ... ON CONFLICT DO NOTHING` rend l'écriture idempotente
 *   au cas où la première exécution aurait crashé après le DELETE
 *   accounts mais avant l'INSERT deleted_accounts (peu probable, mais
 *   défense en profondeur).
 * - Le worker scanne uniquement les comptes encore présents en DB —
 *   après une purge réussie le compte est physiquement absent, donc
 *   non re-sélectionné.
 *
 * **Périmètre purge** :
 * - DELETE accounts → cascade naturelle sur :
 *     - devices (FK cascade)
 *       - push_tokens (FK cascade via devices)
 *     - user_notification_preferences (FK cascade)
 *     - user_quiet_hours (FK cascade)
 *     - account_deletion_step_up_tokens (FK cascade)
 *     - audit_events (FK SET NULL — **conservé**, c'est le but)
 * - DELETE mailbox_messages WHERE household_id = (UUID) — pas de FK
 *   directe mais lié logiquement au foyer.
 *
 * **Pas de purge** :
 * - audit_events restent (account_id devient NULL, eventData inchangé)
 * - magic_links / step-up tokens : déjà cascadés via accountId, ou
 *   indépendants (magic_links est lié par emailHash, mais expire seul).
 *
 * Refs: KIN-086, E9-S03, RM10, ADR-D14.
 */

import { eq, and, lte } from 'drizzle-orm';
import { accounts, deletedAccounts, mailboxMessages, auditEvents } from '../db/schema.js';
import type { DrizzleDb } from '../plugins/db.js';
import { computeDeletedAccountPseudoId } from './pseudo-id.js';

/**
 * Représente un compte en attente de purge tel que sélectionné par
 * `findAccountsDueForPurge`. On ne récupère que les colonnes strictement
 * nécessaires (id + householdId hérité de devices, jamais email_hash).
 */
export interface AccountPendingPurge {
  readonly accountId: string;
  readonly householdId: string;
}

/**
 * Sélectionne les comptes dont la purge est arrivée à échéance.
 *
 * Filtre :
 * - `deletion_status = 'pending_deletion'`
 * - `deletion_scheduled_at_ms <= now`
 *
 * Le `householdId` est dérivé de la convention v1.0 (`householdId ==
 * accountId`). Si la convention évolue (multi-foyers par compte), il
 * faudra aller le chercher via une requête sur `devices` ou ajouter
 * une colonne `accounts.household_id` dédiée.
 */
export async function findAccountsDueForPurge(
  db: DrizzleDb,
  nowMs: number,
): Promise<readonly AccountPendingPurge[]> {
  const rows = await db
    .select({
      id: accounts.id,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.deletionStatus, 'pending_deletion'),
        lte(accounts.deletionScheduledAtMs, nowMs),
      ),
    );

  return rows.map((r) => ({
    accountId: r.id,
    // v1.0 : householdId === accountId (cf. auth.ts L105). Si l'archi évolue,
    // adapter ici (FK ou jointure).
    householdId: r.id,
  }));
}

/**
 * Purge un compte unique de manière transactionnelle et idempotente.
 *
 * **Étapes** (dans une transaction SQL) :
 * 1. Calcule `pseudoId = SHA-256(accountId || pepper)`.
 * 2. INSERT `deleted_accounts` (idempotent via ON CONFLICT DO NOTHING).
 * 3. INSERT audit_events `account_deleted` avec `accountId = NULL` et
 *    `event_data = {pseudoId, deletedAtMs}` — l'événement survit à la
 *    suppression du compte (FK SET NULL).
 * 4. DELETE mailbox_messages WHERE household_id = householdId.
 * 5. DELETE accounts WHERE id = accountId → cascade automatique.
 *
 * Note : on insère l'audit `account_deleted` AVANT le DELETE accounts
 * pour éviter le piège de la cascade SET NULL qui s'appliquerait à des
 * lignes déjà détachées. Le résultat final est identique (account_id
 * = NULL après la cascade), mais l'ordre est plus déterministe.
 */
export async function purgeAccount(
  db: DrizzleDb,
  account: AccountPendingPurge,
  nowMs: number,
  pepper: string,
): Promise<void> {
  const pseudoId = await computeDeletedAccountPseudoId(account.accountId, pepper);

  await db.transaction(async (tx) => {
    // 1. Trace pseudonymisée — idempotent.
    await tx
      .insert(deletedAccounts)
      .values({
        pseudoId,
        deletedAtMs: nowMs,
        householdId: account.householdId,
      })
      .onConflictDoNothing();

    // 2. Audit `account_deleted` — conservé après cascade SET NULL.
    //    On stocke le pseudoId (pas l'accountId clair) pour permettre
    //    une corrélation avec `deleted_accounts` sans réintroduire
    //    l'identité du compte effacé.
    await tx.insert(auditEvents).values({
      accountId: account.accountId,
      eventType: 'account_deleted',
      eventData: { pseudoId, deletedAtMs: nowMs },
    });

    // 3. Mailbox du foyer (pas de FK cascade — la table est indexée
    //    par householdId, pas par accountId).
    await tx.delete(mailboxMessages).where(eq(mailboxMessages.householdId, account.householdId));

    // 4. Purge le compte. Cascade DB sur devices / push_tokens / prefs /
    //    quiet_hours / step_up_tokens. SET NULL sur audit_events.
    await tx.delete(accounts).where(eq(accounts.id, account.accountId));
  });
}

/**
 * Boucle de purge — exécute `purgeAccount` pour chaque compte échu et
 * remonte un compteur. Ne propage **pas** les erreurs unitaires : un
 * compte qui échoue ne doit pas bloquer les autres (le worker repassera
 * au prochain tick).
 *
 * @returns Le nombre de comptes effectivement purgés (succès uniquement).
 */
export async function runPurge(
  db: DrizzleDb,
  nowMs: number,
  pepper: string,
  logger: { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void },
): Promise<number> {
  const due = await findAccountsDueForPurge(db, nowMs);
  let purged = 0;
  for (const acc of due) {
    try {
      await purgeAccount(db, acc, nowMs, pepper);
      purged += 1;
      // Log structurel — pas d'accountId en clair (RM16).
      const pseudoId = await computeDeletedAccountPseudoId(acc.accountId, pepper);
      logger.info({ event: 'account_purge.ok', pseudoId }, 'Compte purgé');
    } catch (err) {
      logger.error(
        {
          event: 'account_purge.error',
          // pas d'accountId en clair — on log seulement l'erreur
          err: err instanceof Error ? err.message : String(err),
        },
        'Échec purge compte (continuera au prochain tick)',
      );
    }
  }
  return purged;
}
