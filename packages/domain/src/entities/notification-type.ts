/**
 * Types de notifications exposés par Kinhale (SPECS §9).
 *
 * L'ensemble fermé est partagé entre :
 * - le relais Fastify (filtre `dispatchPush` selon les préférences utilisateur),
 * - le backend REST (`GET/PUT /me/notification-preferences`),
 * - les écrans « Paramètres / Notifications » web + mobile (E5-S07).
 *
 * Deux types sont **sanctuarisés** (toujours actifs, non désactivables) :
 * - `missed_dose` : règle sanitaire RM25 (dose manquée, cf. §9).
 * - `security_alert` : intégrité de compte (login suspect, clé rotatée).
 *
 * Refs: SPECS §9 (types de notifications + paramétrage), RM25 (rappels bornés).
 */
export type NotificationType =
  | 'reminder'
  | 'missed_dose'
  | 'peer_dose_recorded'
  | 'pump_low'
  | 'pump_expiring'
  | 'dispute_detected'
  | 'admin_handover'
  | 'consent_update_required'
  | 'security_alert'
  | 'caregiver_revoked';

/** Ensemble fermé des types valides — utile pour valider un input externe. */
export const NOTIFICATION_TYPES: ReadonlyArray<NotificationType> = [
  'reminder',
  'missed_dose',
  'peer_dose_recorded',
  'pump_low',
  'pump_expiring',
  'dispute_detected',
  'admin_handover',
  'consent_update_required',
  'security_alert',
  'caregiver_revoked',
] as const;

/**
 * Types que l'utilisateur ne peut **jamais** désactiver (SPECS §9).
 *
 * - `missed_dose` : tout désactivation est rejetée (400) par le backend et
 *   toute prise enregistrée côté device continue de générer la notification
 *   locale + e-mail fallback. Règle RM25 — protection sanitaire.
 * - `security_alert` : intégrité du compte. Un attaquant ne doit jamais
 *   pouvoir « silencier » ce canal en prenant le contrôle d'une session.
 */
export const ALWAYS_ENABLED_NOTIFICATION_TYPES: ReadonlyArray<NotificationType> = [
  'missed_dose',
  'security_alert',
] as const;

/**
 * Types que l'utilisateur **peut** toggler depuis le paramétrage granulaire.
 * Complément de {@link ALWAYS_ENABLED_NOTIFICATION_TYPES} — pratique pour
 * itérer dans l'UI sans recalculer le diff à chaque rendu.
 */
export const TOGGLEABLE_NOTIFICATION_TYPES: ReadonlyArray<NotificationType> =
  NOTIFICATION_TYPES.filter((t) => !ALWAYS_ENABLED_NOTIFICATION_TYPES.includes(t));

/** Type guard — vérifie qu'un string inconnu est un {@link NotificationType} valide. */
export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && NOTIFICATION_TYPES.includes(value as NotificationType);
}

/**
 * Vérifie si un type donné est protégé (non désactivable). Retourne `true`
 * pour `missed_dose` et `security_alert`, `false` pour tous les autres.
 */
export function isAlwaysEnabled(type: NotificationType): boolean {
  return ALWAYS_ENABLED_NOTIFICATION_TYPES.includes(type);
}
