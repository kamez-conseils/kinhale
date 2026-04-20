import type { Invitation } from '../entities/invitation';

/**
 * Rétention (en jours) d'une invitation `expired` avant purge par la tâche
 * nocturne système (SPECS §4 RM28, ligne 352).
 */
export const PURGE_EXPIRED_AFTER_DAYS = 30;

/**
 * Rétention (en jours) d'une invitation `consumed` avant purge (RM28).
 * Conservée 3 fois plus longtemps que les `expired` pour laisser une trace
 * minimale de l'acceptation si un litige survient (corrélation audit log).
 */
export const PURGE_CONSUMED_AFTER_DAYS = 90;

/**
 * Rétention (en jours) d'une invitation `revoked` avant purge.
 *
 * **Extension domaine** : la spec RM28 ne mentionne pas explicitement les
 * invitations révoquées. Pour éviter l'accumulation de lignes fantômes côté
 * relais, on applique la même politique que pour `expired` (30 jours à
 * partir de `revokedAtUtc`). Ce choix est documenté et testé ci-bas ; il
 * est modifiable sans surprise si la spec évolue.
 */
export const PURGE_REVOKED_AFTER_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Raison pour laquelle une invitation devient éligible à la purge. Utilisé
 * par l'infra pour émettre des métriques ventilées (SLO de rétention) et
 * trace d'audit.
 */
export type PurgeReason =
  | 'expired_retention_exceeded'
  | 'consumed_retention_exceeded'
  | 'revoked_retention_exceeded';

/**
 * Résultat d'un examen de purge pour une invitation donnée.
 *
 * - `invitationId` : identifiant de l'invitation à purger.
 * - `reason` : motif métier de la purge (mappe vers un compteur de métrique).
 * - `retentionThresholdUtc` : frontière temporelle au-delà de laquelle une
 *   invitation est éligible (`nowUtc - rétention`). Exposée pour faciliter
 *   l'observabilité et les tests d'intégration.
 * - `referenceAtUtc` : horodatage métier utilisé pour la comparaison :
 *   `expiresAtUtc`, `consumedAtUtc` ou `revokedAtUtc` selon le cas.
 */
export interface PurgeEligibility {
  readonly invitationId: string;
  readonly reason: PurgeReason;
  readonly retentionThresholdUtc: Date;
  readonly referenceAtUtc: Date;
}

/**
 * RM28 — calcule la liste des invitations éligibles à la purge nocturne.
 *
 * Le domaine **ne supprime rien** : il se contente de décrire ce qui doit
 * l'être. L'exécution (DELETE SQL, émission événement d'audit) est pilotée
 * par `apps/api` côté infra.
 *
 * Règles (bornes inclusives pour cohérence avec RM2/RM18/RM26) :
 * - `expired` avec `expiresAtUtc <= now - 30 j` → purge.
 * - `consumed` avec `consumedAtUtc <= now - 90 j` → purge.
 * - `revoked` avec `revokedAtUtc <= now - 30 j` → purge (extension domaine).
 * - `active` → jamais purgée (transit par `expired` au préalable).
 *
 * Garde défensive : si une invitation `consumed`/`revoked` a un horodatage
 * de référence `null` (état incohérent produit par un bug amont), elle
 * est **ignorée** plutôt que remontée — une purge silencieuse sur un état
 * invalide pourrait masquer un incident. Le bug doit être investigué
 * séparément, pas corrigé au détour de la purge.
 *
 * Fonction **pure** : ne mute pas le tableau d'entrée, renvoie une nouvelle
 * liste en lecture seule. Aucun code d'erreur associé (calcul pur).
 */
export function findInvitationsToPurge(
  invitations: readonly Invitation[],
  nowUtc: Date,
): readonly PurgeEligibility[] {
  const nowMs = nowUtc.getTime();
  const expiredThreshold = new Date(nowMs - PURGE_EXPIRED_AFTER_DAYS * MS_PER_DAY);
  const consumedThreshold = new Date(nowMs - PURGE_CONSUMED_AFTER_DAYS * MS_PER_DAY);
  const revokedThreshold = new Date(nowMs - PURGE_REVOKED_AFTER_DAYS * MS_PER_DAY);

  const result: PurgeEligibility[] = [];

  for (const inv of invitations) {
    switch (inv.status) {
      case 'expired': {
        if (inv.expiresAtUtc.getTime() <= expiredThreshold.getTime()) {
          result.push({
            invitationId: inv.id,
            reason: 'expired_retention_exceeded',
            retentionThresholdUtc: expiredThreshold,
            referenceAtUtc: inv.expiresAtUtc,
          });
        }
        break;
      }
      case 'consumed': {
        if (
          inv.consumedAtUtc !== null &&
          inv.consumedAtUtc.getTime() <= consumedThreshold.getTime()
        ) {
          result.push({
            invitationId: inv.id,
            reason: 'consumed_retention_exceeded',
            retentionThresholdUtc: consumedThreshold,
            referenceAtUtc: inv.consumedAtUtc,
          });
        }
        break;
      }
      case 'revoked': {
        if (inv.revokedAtUtc !== null && inv.revokedAtUtc.getTime() <= revokedThreshold.getTime()) {
          result.push({
            invitationId: inv.id,
            reason: 'revoked_retention_exceeded',
            retentionThresholdUtc: revokedThreshold,
            referenceAtUtc: inv.revokedAtUtc,
          });
        }
        break;
      }
      case 'active':
        // Jamais purgée : transite d'abord par `expired`.
        break;
    }
  }

  return result;
}
