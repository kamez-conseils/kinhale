/**
 * Statut d'une invitation aidant. Cycle de vie nominal :
 * `active` -> `consumed` (acceptée) OU `expired` (non utilisée à temps)
 * OU `revoked` (l'Admin l'annule manuellement).
 *
 * Les transitions sont appliquées par l'infra (`apps/api`). Côté domaine, on
 * n'exécute jamais d'I/O : on raisonne sur l'état courant pour appliquer
 * RM21 (anti-spam) et RM28 (purge).
 */
export type InvitationStatus = 'active' | 'consumed' | 'expired' | 'revoked';

/**
 * Rôle cible d'une invitation. On ne permet pas d'inviter directement un
 * `admin` : la promotion admin passe par un autre workflow (RM1), pas par
 * le mécanisme d'invitation.
 */
export type InvitationTargetRole = 'contributor' | 'restricted_contributor';

/**
 * Invitation aidant (SPECS §3.9). Entité purement domaine : ne contient
 * **jamais** les secrets d'invitation (`invite_code`, `qr_payload`, `pin`).
 * Ces champs sont infra-only, détenus par `apps/api` et jamais partagés
 * avec le client ni le domaine pur.
 *
 * Conséquence : le domaine ne peut pas valider un `invite_code` ou un
 * `pin` — il raisonne uniquement sur les champs non-sensibles (status,
 * timestamps, compteurs).
 */
export interface Invitation {
  readonly id: string;
  readonly householdId: string;
  readonly targetRole: InvitationTargetRole;
  readonly status: InvitationStatus;
  readonly createdByUserId: string;
  readonly createdAtUtc: Date;
  readonly expiresAtUtc: Date;
  readonly consumedAtUtc: Date | null;
  readonly consumedByUserId: string | null;
  readonly revokedAtUtc: Date | null;
  readonly maxUses: number;
  readonly usesCount: number;
}
