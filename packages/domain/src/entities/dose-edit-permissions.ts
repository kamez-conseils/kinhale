import type { Role } from './role';

/**
 * Fenêtre de grâce pour l'édition libre d'une prise par son auteur (E4-S06,
 * RM18 — alignée sur la fenêtre de void). Au-delà, seul un Admin peut
 * éditer, **avec raison obligatoire**.
 *
 * Borne **inclusive** : un edit à 30 min 00 s pile reste autorisé sans
 * raison. Cohérent avec `VOID_FREE_WINDOW_MINUTES`.
 */
export const EDIT_FREE_WINDOW_MINUTES = 30;

const EDIT_FREE_WINDOW_MS = EDIT_FREE_WINDOW_MINUTES * 60_000;

/**
 * Sous-ensemble minimal d'une dose nécessaire à `canEditDose`. On ne dépend
 * pas du type complet `Dose` ni de `ProjectedDose` pour rester réutilisable
 * indépendamment de la couche projection / sync.
 */
export interface DoseEditTarget {
  /** Device qui a saisi initialement la prise. */
  readonly recordedByDeviceId: string;
  /** Instant déclaré de la prise (UTC ms). */
  readonly administeredAtMs: number;
  /** Statut courant. */
  readonly status: 'recorded' | 'pending_review' | 'voided';
}

export interface CanEditDoseInput {
  readonly dose: DoseEditTarget;
  /** Identifiant du device en cours de session. */
  readonly currentDeviceId: string;
  /** Rôle effectif de l'aidant connecté. */
  readonly currentRole: Role;
  /** Horloge — UTC ms. Toujours injectée pour la testabilité. */
  readonly nowMs: number;
}

/**
 * Verdict d'autorisation. Quand `allowed: true`, `requiresReason` indique
 * si l'UI doit forcer la saisie d'une raison (cas Admin > 30 min).
 */
export type CanEditDoseResult =
  | { readonly allowed: true; readonly requiresReason: boolean }
  | { readonly allowed: false; readonly reason: CanEditDoseRefusal };

export type CanEditDoseRefusal =
  | 'voided'
  | 'pending_review'
  | 'restricted_role'
  | 'not_author_and_too_old';

/**
 * Décide si une prise est éditable dans l'instant courant (E4-S06).
 *
 * Règles dérivées de RM18 et des AC E4-S06 :
 * - Une prise déjà voidée n'est plus jamais éditable (immutable).
 * - Une prise en `pending_review` doit d'abord passer par la résolution de
 *   conflit (E4-S05) — pas d'édition libre tant que le statut n'est pas
 *   tranché.
 * - Un `restricted_contributor` ne peut jamais éditer (cohérent avec RM18
 *   — saisie uniquement, pas de gestion).
 * - Auteur **et** dans la fenêtre de 30 min → autorisé sans raison.
 * - Admin **hors** fenêtre → autorisé **avec** raison obligatoire.
 * - Sinon → refus `not_author_and_too_old`.
 *
 * **Pureté** : aucune I/O, aucune horloge cachée. `nowMs` est toujours
 * injectée. Le résultat est strictement déterministe pour des inputs donnés.
 */
export function canEditDose(input: CanEditDoseInput): CanEditDoseResult {
  const { dose, currentDeviceId, currentRole, nowMs } = input;

  if (dose.status === 'voided') {
    return { allowed: false, reason: 'voided' };
  }
  if (dose.status === 'pending_review') {
    return { allowed: false, reason: 'pending_review' };
  }
  if (currentRole === 'restricted_contributor') {
    return { allowed: false, reason: 'restricted_role' };
  }

  const isAuthor = dose.recordedByDeviceId === currentDeviceId;
  const isAdmin = currentRole === 'admin';
  const elapsedMs = nowMs - dose.administeredAtMs;
  const insideFreeWindow = elapsedMs <= EDIT_FREE_WINDOW_MS;

  if (insideFreeWindow && isAuthor) {
    return { allowed: true, requiresReason: false };
  }
  if (!insideFreeWindow && isAdmin) {
    return { allowed: true, requiresReason: true };
  }
  if (insideFreeWindow && isAdmin) {
    // Admin dans la fenêtre, mais pas auteur : on autorise sans raison
    // (cohérent avec RM18 sur le void). L'audit trail enregistre l'éditeur
    // via `editedByDeviceId`.
    return { allowed: true, requiresReason: false };
  }
  return { allowed: false, reason: 'not_author_and_too_old' };
}
