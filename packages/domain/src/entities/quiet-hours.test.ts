import { describe, it, expect } from 'vitest';
import {
  isWithinQuietHours,
  isQuietHoursOverrideType,
  parseLocalTime,
  type QuietHours,
} from './quiet-hours';

/**
 * Helper — construit une QuietHours active avec les paramètres donnés.
 */
function qh(start: string, end: string, timezone = 'America/Toronto', enabled = true): QuietHours {
  return { enabled, startLocalTime: start, endLocalTime: end, timezone };
}

describe('parseLocalTime', () => {
  it('accepte un format HH:mm valide', () => {
    expect(parseLocalTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseLocalTime('22:00')).toEqual({ hour: 22, minute: 0 });
    expect(parseLocalTime('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseLocalTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('rejette un format invalide', () => {
    expect(() => parseLocalTime('24:00')).toThrow();
    expect(() => parseLocalTime('22:60')).toThrow();
    expect(() => parseLocalTime('7:30')).toThrow(); // pas de zéro padding
    expect(() => parseLocalTime('22h00')).toThrow();
    expect(() => parseLocalTime('22')).toThrow();
    expect(() => parseLocalTime('')).toThrow();
    expect(() => parseLocalTime('not-a-time')).toThrow();
  });
});

describe('isWithinQuietHours — plage simple (ne traverse pas minuit)', () => {
  const quiet = qh('13:00', '17:00');

  it("retourne true à l'intérieur de la plage", () => {
    // 15:00 heure locale Toronto = 19:00 UTC en hiver (EST = UTC-5)
    const now = new Date('2026-01-15T20:00:00Z'); // 15:00 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it('retourne true à la borne inférieure (13:00 inclus)', () => {
    const now = new Date('2026-01-15T18:00:00Z'); // 13:00 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it('retourne false à la borne supérieure (17:00 exclus)', () => {
    const now = new Date('2026-01-15T22:00:00Z'); // 17:00 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });

  it('retourne false avant la plage', () => {
    const now = new Date('2026-01-15T17:59:00Z'); // 12:59 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });

  it('retourne false après la plage', () => {
    const now = new Date('2026-01-15T22:30:00Z'); // 17:30 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });
});

describe('isWithinQuietHours — plage traversant minuit', () => {
  const quiet = qh('22:00', '07:00');

  it('retourne true juste après 22:00 local', () => {
    // 22:30 Toronto (hiver EST = UTC-5) = 03:30 UTC lendemain
    const now = new Date('2026-01-16T03:30:00Z'); // 22:30 Toronto le 15
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it('retourne true à 02:00 local (milieu de nuit)', () => {
    const now = new Date('2026-01-16T07:00:00Z'); // 02:00 Toronto le 16
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it('retourne true à 06:59 local', () => {
    const now = new Date('2026-01-16T11:59:00Z'); // 06:59 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it('retourne false à 07:00 local (fin exclue)', () => {
    const now = new Date('2026-01-16T12:00:00Z'); // 07:00 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });

  it('retourne false à 21:59 local (avant le début)', () => {
    const now = new Date('2026-01-16T02:59:00Z'); // 21:59 Toronto le 15
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });

  it('retourne false en plein milieu de journée', () => {
    const now = new Date('2026-01-15T17:00:00Z'); // 12:00 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });
});

describe('isWithinQuietHours — enabled=false', () => {
  it('retourne toujours false quand désactivé', () => {
    const disabled = qh('22:00', '07:00', 'America/Toronto', false);
    // Même à 02:00 local, un quiet hours désactivé n'empêche rien.
    const now = new Date('2026-01-16T07:00:00Z');
    expect(isWithinQuietHours(now, disabled)).toBe(false);
  });
});

describe('isWithinQuietHours — plage vide (start === end)', () => {
  it('retourne false quand start === end (plage nulle)', () => {
    const quiet = qh('08:00', '08:00');
    const now = new Date('2026-01-15T13:00:00Z'); // 08:00 Toronto
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });
});

describe("isWithinQuietHours — cas DST (changement d'heure)", () => {
  // Au Canada en 2026, le passage à l'heure d'été (EDT, UTC-4) est le 8 mars
  // à 02:00 → 03:00 ; le passage à l'heure d'hiver est le 1er novembre à 02:00 → 01:00.
  const quiet = qh('22:00', '07:00', 'America/Toronto');

  it("respecte la plage en heure d'été (EDT = UTC-4)", () => {
    // 23:00 Toronto en été = 03:00 UTC lendemain
    const now = new Date('2026-06-15T03:00:00Z');
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it("respecte la plage pendant la nuit du passage à l'heure d'été (2026-03-08)", () => {
    // 01:30 Toronto la nuit du passage à l'heure d'été = 06:30 UTC
    const now = new Date('2026-03-08T06:30:00Z');
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });

  it("respecte la plage pendant la nuit du passage à l'heure d'hiver (2026-11-01)", () => {
    // 01:30 Toronto la nuit du passage à l'heure d'hiver
    // Avant 2h locale : EDT (UTC-4) → 01:30 local = 05:30 UTC
    const beforeFallBack = new Date('2026-11-01T05:30:00Z');
    expect(isWithinQuietHours(beforeFallBack, quiet)).toBe(true);
  });
});

describe('isWithinQuietHours — timezones variés', () => {
  it('fonctionne pour Europe/Paris', () => {
    // Paris en hiver (CET, UTC+1). Quiet hours 22:00-07:00.
    const quiet = qh('22:00', '07:00', 'Europe/Paris');
    // 03:00 Paris = 02:00 UTC
    const now = new Date('2026-01-15T02:00:00Z');
    expect(isWithinQuietHours(now, quiet)).toBe(true);
    // 12:00 Paris = 11:00 UTC → hors plage
    const midday = new Date('2026-01-15T11:00:00Z');
    expect(isWithinQuietHours(midday, quiet)).toBe(false);
  });

  it('fonctionne pour Asia/Tokyo (pas de DST)', () => {
    // Tokyo = UTC+9, pas de DST. Quiet hours 22:00-07:00.
    const quiet = qh('22:00', '07:00', 'Asia/Tokyo');
    // 02:00 Tokyo = 17:00 UTC le jour précédent
    const now = new Date('2026-01-14T17:00:00Z');
    expect(isWithinQuietHours(now, quiet)).toBe(true);
  });
});

describe('isWithinQuietHours — timezone invalide', () => {
  it('retourne false (fail-safe : ne pas filtrer si incalculable)', () => {
    const quiet = qh('22:00', '07:00', 'Not/A_Real_Timezone');
    const now = new Date('2026-01-16T06:00:00Z');
    // On préfère ne pas filtrer (défaut conservateur : la notif passe) plutôt
    // que de lever une exception qui casserait le dispatcher.
    expect(isWithinQuietHours(now, quiet)).toBe(false);
  });
});

describe('isQuietHoursOverrideType', () => {
  it('retourne true pour missed_dose (exception sécurité RM25)', () => {
    expect(isQuietHoursOverrideType('missed_dose')).toBe(true);
  });

  it('retourne true pour security_alert (exception sécurité)', () => {
    expect(isQuietHoursOverrideType('security_alert')).toBe(true);
  });

  it('retourne false pour tous les autres types', () => {
    expect(isQuietHoursOverrideType('reminder')).toBe(false);
    expect(isQuietHoursOverrideType('peer_dose_recorded')).toBe(false);
    expect(isQuietHoursOverrideType('pump_low')).toBe(false);
    expect(isQuietHoursOverrideType('pump_expiring')).toBe(false);
    expect(isQuietHoursOverrideType('dispute_detected')).toBe(false);
    expect(isQuietHoursOverrideType('admin_handover')).toBe(false);
    expect(isQuietHoursOverrideType('consent_update_required')).toBe(false);
    expect(isQuietHoursOverrideType('caregiver_revoked')).toBe(false);
  });
});
