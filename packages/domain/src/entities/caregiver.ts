import type { Role } from './role';

/** État d'un aidant au sein d'un foyer. */
export type CaregiverStatus = 'active' | 'invited' | 'revoked';

/**
 * Aidant (parent, grand-parent, garderie, nounou…). Identifie l'utilisateur
 * au sein d'un foyer donné — un même humain peut être aidant dans plusieurs
 * foyers avec des rôles différents.
 */
export interface Caregiver {
  readonly id: string;
  readonly householdId: string;
  readonly role: Role;
  readonly status: CaregiverStatus;
  readonly displayName: string;
  readonly invitedAt: Date;
  readonly activatedAt: Date | null;
  readonly revokedAt: Date | null;
}
