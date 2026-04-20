import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  type ConsentStatus,
  type DocumentAcceptance,
  type DocumentVersion,
  ensureAcceptanceValid,
  evaluateConsentStatus,
  isAcceptanceValid,
  parseMajorVersion,
} from './rm9-consent-acceptance';

const NOW = new Date('2026-04-19T12:00:00Z');

function makeTosVersion(version: string): DocumentVersion {
  return {
    kind: 'terms_of_service',
    version,
    publishedAtUtc: new Date('2026-01-01T00:00:00Z'),
  };
}

function makePpVersion(version: string): DocumentVersion {
  return {
    kind: 'privacy_policy',
    version,
    publishedAtUtc: new Date('2026-01-01T00:00:00Z'),
  };
}

function makeTosAcceptance(acceptedVersion: string): DocumentAcceptance {
  return {
    kind: 'terms_of_service',
    acceptedVersion,
    acceptedAtUtc: new Date('2026-03-01T12:00:00Z'),
    userId: 'user-1',
  };
}

function makePpAcceptance(acceptedVersion: string): DocumentAcceptance {
  return {
    kind: 'privacy_policy',
    acceptedVersion,
    acceptedAtUtc: new Date('2026-03-01T12:00:00Z'),
    userId: 'user-1',
  };
}

describe('RM9 — parseMajorVersion', () => {
  it('extrait le major de `1.2.3`', () => {
    expect(parseMajorVersion('1.2.3')).toBe(1);
  });

  it('extrait le major de `2.0.0`', () => {
    expect(parseMajorVersion('2.0.0')).toBe(2);
  });

  it('extrait le major de `10.5.7` (plusieurs chiffres)', () => {
    expect(parseMajorVersion('10.5.7')).toBe(10);
  });

  it('extrait le major de `0.0.1`', () => {
    expect(parseMajorVersion('0.0.1')).toBe(0);
  });

  it('lève RM9_INVALID_VERSION_FORMAT si format invalide (2.0)', () => {
    try {
      parseMajorVersion('2.0');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM9_INVALID_VERSION_FORMAT');
    }
  });

  it('lève RM9_INVALID_VERSION_FORMAT si préfixe v (v1.2.3)', () => {
    expect(() => parseMajorVersion('v1.2.3')).toThrow(DomainError);
  });

  it('lève RM9_INVALID_VERSION_FORMAT pour chaîne vide', () => {
    expect(() => parseMajorVersion('')).toThrow(DomainError);
  });

  it('lève RM9_INVALID_VERSION_FORMAT pour non-numérique (1.a.0)', () => {
    expect(() => parseMajorVersion('1.a.0')).toThrow(DomainError);
  });

  it('lève RM9_INVALID_VERSION_FORMAT pour composant négatif (-1.0.0)', () => {
    expect(() => parseMajorVersion('-1.0.0')).toThrow(DomainError);
  });

  it('lève RM9_INVALID_VERSION_FORMAT si segments additionnels (1.2.3.4)', () => {
    expect(() => parseMajorVersion('1.2.3.4')).toThrow(DomainError);
  });
});

describe('RM9 — evaluateConsentStatus (never_accepted)', () => {
  it('signale les deux documents manquants si aucune acceptation', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.0.0'), makePpVersion('1.0.0')],
      acceptances: [],
    });
    expect(status.kind).toBe('never_accepted');
    expect(status).toEqual<ConsentStatus>({
      kind: 'never_accepted',
      missing: ['terms_of_service', 'privacy_policy'],
    });
  });

  it('signale uniquement PP manquante si seul TOS est accepté', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.0.0'), makePpVersion('1.0.0')],
      acceptances: [makeTosAcceptance('1.0.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'never_accepted',
      missing: ['privacy_policy'],
    });
  });

  it('signale uniquement TOS manquante si seule PP est acceptée', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.0.0'), makePpVersion('1.0.0')],
      acceptances: [makePpAcceptance('1.0.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'never_accepted',
      missing: ['terms_of_service'],
    });
  });
});

describe('RM9 — evaluateConsentStatus (all_accepted_current)', () => {
  it('accepte les deux à la version courante exacte', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.2.0'), makePpVersion('1.1.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.1.0')],
    });
    expect(status.kind).toBe('all_accepted_current');
  });

  it('accepte quand un minor bump est intervenu (1.2.0 accepté, 1.3.0 publié)', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.3.0'), makePpVersion('1.1.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.1.0')],
    });
    expect(status.kind).toBe('all_accepted_current');
  });

  it('accepte quand un patch bump est intervenu (1.2.0 accepté, 1.2.1 publié)', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.2.1'), makePpVersion('1.1.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.1.0')],
    });
    expect(status.kind).toBe('all_accepted_current');
  });

  it('accepte même si versions majors identiques mais minor antérieur', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.9.9'), makePpVersion('1.0.0')],
      acceptances: [makeTosAcceptance('1.0.0'), makePpAcceptance('1.0.0')],
    });
    expect(status.kind).toBe('all_accepted_current');
  });
});

describe('RM9 — evaluateConsentStatus (major_bump_requires_reacceptance)', () => {
  it('bloque si TOS major bumpé (1.2.0 → 2.0.0), PP inchangé', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('2.0.0'), makePpVersion('1.0.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.0.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'major_bump_requires_reacceptance',
      outdated: ['terms_of_service'],
    });
  });

  it('bloque si PP major bumpé, TOS inchangé', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.2.0'), makePpVersion('2.0.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.0.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'major_bump_requires_reacceptance',
      outdated: ['privacy_policy'],
    });
  });

  it('bloque les deux si les deux majors ont bumpé', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('2.0.0'), makePpVersion('2.0.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.0.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'major_bump_requires_reacceptance',
      outdated: ['terms_of_service', 'privacy_policy'],
    });
  });

  it('bloque saut de plusieurs majors (1.x → 3.x)', () => {
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('3.0.0'), makePpVersion('1.0.0')],
      acceptances: [makeTosAcceptance('1.2.0'), makePpAcceptance('1.0.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'major_bump_requires_reacceptance',
      outdated: ['terms_of_service'],
    });
  });
});

describe('RM9 — evaluateConsentStatus (priorité never_accepted sur major_bump)', () => {
  it('signale never_accepted si un document n’a jamais été accepté (priorité absolue)', () => {
    // TOS major bumpé ET PP jamais acceptée → `never_accepted` l'emporte
    // (un blocage est suffisant, mais on remonte l'état le plus grave).
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('2.0.0'), makePpVersion('1.0.0')],
      acceptances: [makeTosAcceptance('1.2.0')],
    });
    expect(status).toEqual<ConsentStatus>({
      kind: 'never_accepted',
      missing: ['privacy_policy'],
    });
  });
});

describe('RM9 — evaluateConsentStatus (ignore acceptations obsolètes et autres users)', () => {
  it("ignore les acceptations d'un autre kind que demandé", () => {
    // Seulement TOS dans currentVersions, acceptances contient PP → PP ignorée
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('1.0.0')],
      acceptances: [makeTosAcceptance('1.0.0'), makePpAcceptance('1.0.0')],
    });
    expect(status.kind).toBe('all_accepted_current');
  });

  it('ne conserve que la dernière acceptation par kind (la plus récente)', () => {
    // Deux acceptations TOS : 1.0.0 (vieille) + 2.0.0 (récente). La règle
    // prend la plus récente par `acceptedAtUtc`.
    const status = evaluateConsentStatus({
      currentVersions: [makeTosVersion('2.0.0')],
      acceptances: [
        {
          kind: 'terms_of_service',
          acceptedVersion: '1.0.0',
          acceptedAtUtc: new Date('2025-01-01T00:00:00Z'),
          userId: 'user-1',
        },
        {
          kind: 'terms_of_service',
          acceptedVersion: '2.0.0',
          acceptedAtUtc: new Date('2026-03-01T00:00:00Z'),
          userId: 'user-1',
        },
      ],
    });
    expect(status.kind).toBe('all_accepted_current');
  });
});

describe('RM9 — evaluateConsentStatus (pureté)', () => {
  it('ne mute ni currentVersions ni acceptances', () => {
    const currentVersions = [makeTosVersion('1.2.0'), makePpVersion('1.1.0')];
    const acceptances = [makeTosAcceptance('1.2.0'), makePpAcceptance('1.1.0')];
    const versionsSnap = JSON.stringify(currentVersions);
    const acceptancesSnap = JSON.stringify(acceptances);

    evaluateConsentStatus({ currentVersions, acceptances });

    expect(JSON.stringify(currentVersions)).toBe(versionsSnap);
    expect(JSON.stringify(acceptances)).toBe(acceptancesSnap);
  });
});

describe('RM9 — ensureAcceptanceValid (chemin nominal)', () => {
  it('accepte une acceptation à la version courante exacte', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance = makeTosAcceptance('1.2.0');

    expect(() => ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).not.toThrow();
  });
});

describe('RM9 — ensureAcceptanceValid (cas de refus)', () => {
  it('refuse si version acceptée dans un format invalide', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance: DocumentAcceptance = {
      kind: 'terms_of_service',
      acceptedVersion: 'v1.2.0',
      acceptedAtUtc: new Date('2026-03-01T00:00:00Z'),
      userId: 'user-1',
    };

    try {
      ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM9_INVALID_VERSION_FORMAT');
    }
  });

  it('refuse si acceptedAtUtc > nowUtc + tolérance NTP (RM9_INVALID_ACCEPTANCE_TIMESTAMP)', () => {
    const currentVersion = makeTosVersion('1.2.0');
    // Tolérance 1 s (CLOCK_SKEW_TOLERANCE_MS partagé avec RM14/RM22).
    const acceptance: DocumentAcceptance = {
      kind: 'terms_of_service',
      acceptedVersion: '1.2.0',
      acceptedAtUtc: new Date('2026-04-19T12:00:02Z'),
      userId: 'user-1',
    };

    try {
      ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM9_INVALID_ACCEPTANCE_TIMESTAMP');
    }
  });

  it('accepte acceptedAtUtc légèrement futur (< 1 s, bruit NTP)', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance: DocumentAcceptance = {
      kind: 'terms_of_service',
      acceptedVersion: '1.2.0',
      acceptedAtUtc: new Date('2026-04-19T12:00:00.500Z'),
      userId: 'user-1',
    };

    expect(() => ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).not.toThrow();
  });

  it('accepte acceptedAtUtc pile à la borne de tolérance (nowUtc + 1000 ms)', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance: DocumentAcceptance = {
      kind: 'terms_of_service',
      acceptedVersion: '1.2.0',
      acceptedAtUtc: new Date('2026-04-19T12:00:01.000Z'),
      userId: 'user-1',
    };

    expect(() => ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).not.toThrow();
  });

  it('refuse si kind acceptance ≠ kind currentVersion (incohérence de flux)', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance: DocumentAcceptance = {
      kind: 'privacy_policy',
      acceptedVersion: '1.2.0',
      acceptedAtUtc: new Date('2026-03-01T00:00:00Z'),
      userId: 'user-1',
    };

    try {
      ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM9_VERSION_MISMATCH');
    }
  });

  it('refuse si major accepté > major courant (tricherie/regression)', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance = makeTosAcceptance('2.0.0');

    try {
      ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM9_VERSION_MISMATCH');
    }
  });

  it('accepte si major accepté < major courant (rétrocompatibilité minor)', () => {
    // accepted=1.2.0, current=1.5.3 → même major, ok (minor/patch bumps)
    const currentVersion = makeTosVersion('1.5.3');
    const acceptance = makeTosAcceptance('1.2.0');

    expect(() => ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).not.toThrow();
  });

  it('refuse si major accepté < major courant (major bump détecté)', () => {
    // accepted=1.2.0, current=2.0.0 → major bump → requiert ré-acceptation
    const currentVersion = makeTosVersion('2.0.0');
    const acceptance = makeTosAcceptance('1.2.0');

    try {
      ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM9_VERSION_MISMATCH');
    }
  });
});

describe('RM9 — ensureAcceptanceValid (context erreur confidentiel)', () => {
  it("ne fuit pas userId dans le context d'erreur", () => {
    const currentVersion = makeTosVersion('2.0.0');
    const acceptance: DocumentAcceptance = {
      kind: 'terms_of_service',
      acceptedVersion: '1.2.0',
      acceptedAtUtc: new Date('2026-03-01T00:00:00Z'),
      userId: 'super-secret-user',
    };

    try {
      ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });
      expect.fail('should have thrown');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      expect(JSON.stringify(ctx)).not.toContain('super-secret-user');
      expect(ctx).not.toHaveProperty('userId');
    }
  });
});

describe('RM9 — ensureAcceptanceValid (pureté)', () => {
  it('ne mute ni acceptance ni currentVersion', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance = makeTosAcceptance('1.2.0');
    const versionSnap = JSON.stringify(currentVersion);
    const acceptanceSnap = JSON.stringify(acceptance);

    ensureAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW });

    expect(JSON.stringify(currentVersion)).toBe(versionSnap);
    expect(JSON.stringify(acceptance)).toBe(acceptanceSnap);
  });
});

describe('RM9 — isAcceptanceValid', () => {
  it('retourne true quand l’acceptation est valide', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance = makeTosAcceptance('1.2.0');
    expect(isAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).toBe(true);
  });

  it('retourne false quand major bump', () => {
    const currentVersion = makeTosVersion('2.0.0');
    const acceptance = makeTosAcceptance('1.2.0');
    expect(isAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).toBe(false);
  });

  it('retourne false pour un format de version invalide (jamais de lève)', () => {
    const currentVersion = makeTosVersion('1.2.0');
    const acceptance: DocumentAcceptance = {
      kind: 'terms_of_service',
      acceptedVersion: 'not.a.semver',
      acceptedAtUtc: new Date('2026-03-01T00:00:00Z'),
      userId: 'user-1',
    };
    expect(isAcceptanceValid({ acceptance, currentVersion, nowUtc: NOW })).toBe(false);
  });
});
