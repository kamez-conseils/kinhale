/**
 * Rôle d'un aidant dans un foyer. Strictement hiérarchique :
 * - `admin` : créateur du foyer, seul habilité à gérer les aidants et les
 *   paramètres critiques (cf. RM1, RM12).
 * - `contributor` : aidant complet — saisie, consultation, pas de gestion.
 * - `restricted_contributor` : session éphémère (garderie, nounou) — saisie
 *   uniquement, avec PIN + durée 8 h (RM12).
 */
export const ROLES = ['admin', 'contributor', 'restricted_contributor'] as const;

export type Role = (typeof ROLES)[number];

export function isAdmin(role: Role): boolean {
  return role === 'admin';
}
