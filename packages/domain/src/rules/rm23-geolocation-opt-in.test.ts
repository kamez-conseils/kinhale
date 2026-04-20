import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import type { Role } from '../entities/role';
import {
  type CaregiverGeolocationPreference,
  type DoseWithOptionalGeolocation,
  type Geolocation,
  ensureGeolocationAllowed,
  isGeolocationAllowed,
  isValidGeolocation,
  sanitizeDoseGeolocation,
} from './rm23-geolocation-opt-in';

function makeDose(
  overrides: Partial<DoseWithOptionalGeolocation> & { caregiverId: string },
): DoseWithOptionalGeolocation {
  return {
    geolocation: null,
    ...overrides,
  };
}

function makePreference(
  overrides: Partial<CaregiverGeolocationPreference> & { caregiverId: string; role: Role },
): CaregiverGeolocationPreference {
  return {
    geolocationOptIn: false,
    ...overrides,
  };
}

describe('RM23 — isValidGeolocation', () => {
  it('accepte les bornes inclusives {lat: 90, lon: 180}', () => {
    expect(isValidGeolocation({ lat: 90, lon: 180 })).toBe(true);
  });

  it('accepte les bornes inclusives {lat: -90, lon: -180}', () => {
    expect(isValidGeolocation({ lat: -90, lon: -180 })).toBe(true);
  });

  it('accepte les coordonnées usuelles', () => {
    expect(isValidGeolocation({ lat: 45.5, lon: -73.5 })).toBe(true);
    expect(isValidGeolocation({ lat: 0, lon: 0 })).toBe(true);
  });

  it('rejette lat > 90', () => {
    expect(isValidGeolocation({ lat: 91, lon: 0 })).toBe(false);
  });

  it('rejette lat < -90', () => {
    expect(isValidGeolocation({ lat: -91, lon: 0 })).toBe(false);
  });

  it('rejette lon > 180', () => {
    expect(isValidGeolocation({ lat: 0, lon: 181 })).toBe(false);
  });

  it('rejette lon < -180', () => {
    expect(isValidGeolocation({ lat: 0, lon: -181 })).toBe(false);
  });

  it('rejette NaN sur lat', () => {
    expect(isValidGeolocation({ lat: Number.NaN, lon: 0 })).toBe(false);
  });

  it('rejette NaN sur lon', () => {
    expect(isValidGeolocation({ lat: 0, lon: Number.NaN })).toBe(false);
  });

  it('rejette Infinity', () => {
    expect(isValidGeolocation({ lat: Number.POSITIVE_INFINITY, lon: 0 })).toBe(false);
    expect(isValidGeolocation({ lat: 0, lon: Number.NEGATIVE_INFINITY })).toBe(false);
  });

  it('considère `null` et `undefined` comme valides (absence = safe)', () => {
    expect(isValidGeolocation(null)).toBe(true);
    expect(isValidGeolocation(undefined)).toBe(true);
  });
});

describe('RM23 — isGeolocationAllowed', () => {
  it('OK : pas de géoloc + opt-in true + contributor', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: null });
    const pref = makePreference({ caregiverId: 'c1', role: 'contributor', geolocationOptIn: true });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(true);
  });

  it('OK : pas de géoloc + opt-in false', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: null });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'contributor',
      geolocationOptIn: false,
    });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(true);
  });

  it('OK : pas de géoloc + restricted_contributor', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: null });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: false,
    });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(true);
  });

  it('OK : géoloc + opt-in true + admin', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(true);
  });

  it('OK : géoloc + opt-in true + contributor', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'contributor', geolocationOptIn: true });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(true);
  });

  it('KO : géoloc + opt-in false + contributor', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'contributor',
      geolocationOptIn: false,
    });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(false);
  });

  it('KO : géoloc + opt-in true + restricted_contributor', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(false);
  });

  it('KO : géoloc + coords hors bornes', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 91, lon: 0 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(false);
  });

  it('KO : préférence rattachée à un autre caregiver (mismatch défensif)', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c2', role: 'admin', geolocationOptIn: true });
    expect(isGeolocationAllowed({ dose, authorPreference: pref })).toBe(false);
  });
});

describe('RM23 — ensureGeolocationAllowed', () => {
  it('ne lève pas pour une dose sans géoloc, quel que soit le rôle/opt-in', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: null });

    expect(() =>
      ensureGeolocationAllowed({
        dose,
        authorPreference: makePreference({
          caregiverId: 'c1',
          role: 'admin',
          geolocationOptIn: true,
        }),
      }),
    ).not.toThrow();

    expect(() =>
      ensureGeolocationAllowed({
        dose,
        authorPreference: makePreference({
          caregiverId: 'c1',
          role: 'restricted_contributor',
          geolocationOptIn: false,
        }),
      }),
    ).not.toThrow();
  });

  it('ne lève pas pour une dose avec géoloc valide + opt-in + rôle non restreint', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });

    for (const role of ['admin', 'contributor'] as const) {
      expect(() =>
        ensureGeolocationAllowed({
          dose,
          authorPreference: makePreference({
            caregiverId: 'c1',
            role,
            geolocationOptIn: true,
          }),
        }),
      ).not.toThrow();
    }
  });

  it('lève RM23_OPT_IN_MISSING quand géoloc fournie sans opt-in (contributor)', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'contributor',
      geolocationOptIn: false,
    });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM23_OPT_IN_MISSING');
      expect((err as DomainError).context).toMatchObject({
        caregiverId: 'c1',
        role: 'contributor',
      });
    }
  });

  it('lève RM23_OPT_IN_MISSING quand géoloc fournie sans opt-in (admin)', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: false });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_OPT_IN_MISSING');
    }
  });

  it('lève RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE même si opt-in=true (règle souveraine)', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE');
      expect((err as DomainError).context).toMatchObject({
        caregiverId: 'c1',
        role: 'restricted_contributor',
      });
    }
  });

  it('lève RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE en priorité sur OPT_IN_MISSING', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: false,
    });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      // Priorité : role restreint > opt-in manquant (rôle plus spécifique)
      expect((err as DomainError).code).toBe('RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE');
    }
  });

  it('lève RM23_INVALID_COORDINATES pour lat > 90', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 91, lon: 0 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_INVALID_COORDINATES');
    }
  });

  it('lève RM23_INVALID_COORDINATES pour lat < -90', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: -91, lon: 0 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_INVALID_COORDINATES');
    }
  });

  it('lève RM23_INVALID_COORDINATES pour lon > 180 ou lon < -180', () => {
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });

    expect(() =>
      ensureGeolocationAllowed({
        dose: makeDose({ caregiverId: 'c1', geolocation: { lat: 0, lon: 181 } }),
        authorPreference: pref,
      }),
    ).toThrowError(DomainError);

    expect(() =>
      ensureGeolocationAllowed({
        dose: makeDose({ caregiverId: 'c1', geolocation: { lat: 0, lon: -181 } }),
        authorPreference: pref,
      }),
    ).toThrowError(DomainError);
  });

  it('lève RM23_INVALID_COORDINATES pour NaN ou Infinity', () => {
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });

    const cases: Geolocation[] = [
      { lat: Number.NaN, lon: 0 },
      { lat: 0, lon: Number.NaN },
      { lat: Number.POSITIVE_INFINITY, lon: 0 },
      { lat: 0, lon: Number.NEGATIVE_INFINITY },
    ];

    for (const geolocation of cases) {
      try {
        ensureGeolocationAllowed({
          dose: makeDose({ caregiverId: 'c1', geolocation }),
          authorPreference: pref,
        });
        expect.fail(`should have thrown for ${JSON.stringify(geolocation)}`);
      } catch (err) {
        expect((err as DomainError).code).toBe('RM23_INVALID_COORDINATES');
      }
    }
  });

  it('priorité des refus : role restreint > opt-in manquant > coords invalides', () => {
    // role restreint > coords invalides : même avec coords KO, c'est le rôle qui tranche
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 999, lon: 999 } });
    const prefRestricted = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });
    try {
      ensureGeolocationAllowed({ dose, authorPreference: prefRestricted });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_RESTRICTED_CAREGIVER_CANNOT_GEOLOCATE');
    }

    // opt-in manquant > coords invalides
    const prefNoOptIn = makePreference({
      caregiverId: 'c1',
      role: 'contributor',
      geolocationOptIn: false,
    });
    try {
      ensureGeolocationAllowed({ dose, authorPreference: prefNoOptIn });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_OPT_IN_MISSING');
    }
  });

  it('lève RM23_PREFERENCE_MISMATCH si la préférence ne correspond pas au caregiver auteur', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c2', role: 'admin', geolocationOptIn: true });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_PREFERENCE_MISMATCH');
    }
  });

  it('PREFERENCE_MISMATCH prime sur RESTRICTED_CAREGIVER (ordre des refus formalisé)', () => {
    // Si la préférence ne correspond pas au caregiver auteur ET que le
    // rôle fourni est restricted_contributor, on remonte MISMATCH d'abord
    // (la cohérence du flux est le premier invariant — si l'input est
    // incohérent, les autres checks n'ont pas de base fiable pour se
    // prononcer).
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c2',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM23_PREFERENCE_MISMATCH');
    }
  });

  it('ne fuite pas de coordonnées dans le context des erreurs', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5012, lon: -73.5678 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'contributor',
      geolocationOptIn: false,
    });

    try {
      ensureGeolocationAllowed({ dose, authorPreference: pref });
      expect.fail('should have thrown');
    } catch (err) {
      const raw = JSON.stringify((err as DomainError).context ?? {});
      expect(raw).not.toContain('45.5012');
      expect(raw).not.toContain('-73.5678');
      expect(raw).not.toContain('lat');
      expect(raw).not.toContain('lon');
    }
  });
});

describe('RM23 — sanitizeDoseGeolocation', () => {
  it('retourne la dose inchangée si géoloc autorisée', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toEqual({ lat: 45.5, lon: -73.5 });
  });

  it('retourne la dose inchangée si absence de géoloc', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: null });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: false,
    });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toBeNull();
  });

  it('strip la géoloc si opt-in manquant', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'contributor',
      geolocationOptIn: false,
    });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toBeNull();
  });

  it('strip la géoloc si restricted_contributor (même avec opt-in)', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toBeNull();
  });

  it('strip la géoloc si coords hors bornes', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 91, lon: 0 } });
    const pref = makePreference({ caregiverId: 'c1', role: 'admin', geolocationOptIn: true });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toBeNull();
  });

  it('strip la géoloc si mismatch de caregiver', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({ caregiverId: 'c2', role: 'admin', geolocationOptIn: true });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toBeNull();
  });

  it('est pur : ne mute pas `dose` ni `authorPreference`', () => {
    const dose = makeDose({ caregiverId: 'c1', geolocation: { lat: 45.5, lon: -73.5 } });
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });
    const doseSnapshot = JSON.stringify(dose);
    const prefSnapshot = JSON.stringify(pref);

    sanitizeDoseGeolocation({ dose, authorPreference: pref });

    expect(JSON.stringify(dose)).toBe(doseSnapshot);
    expect(JSON.stringify(pref)).toBe(prefSnapshot);
  });

  it('préserve les autres champs de la dose', () => {
    const dose: DoseWithOptionalGeolocation & { readonly extra: string } = {
      caregiverId: 'c1',
      geolocation: { lat: 45.5, lon: -73.5 },
      extra: 'should-survive',
    };
    const pref = makePreference({
      caregiverId: 'c1',
      role: 'restricted_contributor',
      geolocationOptIn: true,
    });

    const result = sanitizeDoseGeolocation({ dose, authorPreference: pref });
    expect(result.geolocation).toBeNull();
    expect((result as { extra?: string }).extra).toBe('should-survive');
  });
});
