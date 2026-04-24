import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_TYPES,
  ALWAYS_ENABLED_NOTIFICATION_TYPES,
  TOGGLEABLE_NOTIFICATION_TYPES,
  isNotificationType,
  isAlwaysEnabled,
  type NotificationType,
} from './notification-type';

describe('NotificationType', () => {
  it('expose les 10 types documentés dans SPECS §9', () => {
    expect(NOTIFICATION_TYPES).toHaveLength(10);
    expect(NOTIFICATION_TYPES).toContain('reminder');
    expect(NOTIFICATION_TYPES).toContain('missed_dose');
    expect(NOTIFICATION_TYPES).toContain('peer_dose_recorded');
    expect(NOTIFICATION_TYPES).toContain('pump_low');
    expect(NOTIFICATION_TYPES).toContain('pump_expiring');
    expect(NOTIFICATION_TYPES).toContain('dispute_detected');
    expect(NOTIFICATION_TYPES).toContain('admin_handover');
    expect(NOTIFICATION_TYPES).toContain('consent_update_required');
    expect(NOTIFICATION_TYPES).toContain('security_alert');
    expect(NOTIFICATION_TYPES).toContain('caregiver_revoked');
  });

  it('marque missed_dose et security_alert comme toujours actifs', () => {
    expect(ALWAYS_ENABLED_NOTIFICATION_TYPES).toEqual(
      expect.arrayContaining(['missed_dose', 'security_alert']),
    );
    expect(ALWAYS_ENABLED_NOTIFICATION_TYPES).toHaveLength(2);
  });

  it('expose un ensemble togglable qui exclut les types sanctuarisés', () => {
    expect(TOGGLEABLE_NOTIFICATION_TYPES).not.toContain('missed_dose');
    expect(TOGGLEABLE_NOTIFICATION_TYPES).not.toContain('security_alert');
    // Union toggleable + always_enabled = ensemble complet.
    const union = new Set<NotificationType>([
      ...TOGGLEABLE_NOTIFICATION_TYPES,
      ...ALWAYS_ENABLED_NOTIFICATION_TYPES,
    ]);
    expect(union.size).toBe(NOTIFICATION_TYPES.length);
  });

  it('isNotificationType accepte les types valides', () => {
    expect(isNotificationType('reminder')).toBe(true);
    expect(isNotificationType('missed_dose')).toBe(true);
    expect(isNotificationType('caregiver_revoked')).toBe(true);
  });

  it('isNotificationType rejette les types inconnus', () => {
    expect(isNotificationType('unknown_type')).toBe(false);
    expect(isNotificationType('')).toBe(false);
    expect(isNotificationType(null)).toBe(false);
    expect(isNotificationType(undefined)).toBe(false);
    expect(isNotificationType(42)).toBe(false);
  });

  it('isAlwaysEnabled retourne true uniquement pour missed_dose et security_alert', () => {
    expect(isAlwaysEnabled('missed_dose')).toBe(true);
    expect(isAlwaysEnabled('security_alert')).toBe(true);
    expect(isAlwaysEnabled('reminder')).toBe(false);
    expect(isAlwaysEnabled('peer_dose_recorded')).toBe(false);
    expect(isAlwaysEnabled('pump_low')).toBe(false);
    expect(isAlwaysEnabled('caregiver_revoked')).toBe(false);
  });
});
