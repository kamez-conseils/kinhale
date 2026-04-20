import { describe, expect, it } from 'vitest';
import type { Caregiver } from '../entities/caregiver';
import type { Household } from '../entities/household';
import type { Role } from '../entities/role';
import type { DomainError } from '../errors';
import {
  createRestrictedSession,
  ensureSessionValid,
  evaluateSessionValidity,
  isSessionValid,
  RESTRICTED_SESSION_TTL_HOURS,
  revokeSession,
  type RestrictedSession,
} from './rm12-restricted-session';

const HOUSEHOLD_ID = 'hh-11111111-1111-4111-8111-111111111111';

function makeCaregiver(overrides: Partial<Caregiver> & { id: string; role: Role }): Caregiver {
  return {
    householdId: HOUSEHOLD_ID,
    status: 'active',
    displayName: 'Aidant',
    invitedAt: new Date('2026-01-01T00:00:00Z'),
    activatedAt: new Date('2026-01-02T00:00:00Z'),
    revokedAt: null,
    ...overrides,
  };
}

function makeHousehold(caregivers: Caregiver[]): Household {
  return {
    id: HOUSEHOLD_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    timezone: 'America/Toronto',
    locale: 'fr',
    caregivers,
  };
}

function makeSession(overrides: Partial<RestrictedSession> = {}): RestrictedSession {
  const createdAtUtc = new Date('2026-04-19T08:00:00Z');
  return {
    id: 'sess-1',
    caregiverId: 'cg-restricted-1',
    householdId: HOUSEHOLD_ID,
    createdAtUtc,
    expiresAtUtc: new Date(createdAtUtc.getTime() + 8 * 3_600_000),
    revokedAtUtc: null,
    revokedByCaregiverId: null,
    ...overrides,
  };
}

describe('RM12 — constantes', () => {
  it('TTL exposé = 8 heures', () => {
    expect(RESTRICTED_SESSION_TTL_HOURS).toBe(8);
  });
});

describe('RM12 — createRestrictedSession', () => {
  it('pose expiresAtUtc = createdAtUtc + 8h, exactement', () => {
    const createdAtUtc = new Date('2026-04-19T08:00:00Z');
    const session = createRestrictedSession({
      id: 'sess-new',
      caregiverId: 'cg-r',
      householdId: HOUSEHOLD_ID,
      createdAtUtc,
    });
    expect(session.expiresAtUtc.getTime()).toBe(
      createdAtUtc.getTime() + RESTRICTED_SESSION_TTL_HOURS * 3_600_000,
    );
    expect(session.revokedAtUtc).toBeNull();
    expect(session.revokedByCaregiverId).toBeNull();
  });

  it('préserve les identifiants', () => {
    const session = createRestrictedSession({
      id: 'sess-xyz',
      caregiverId: 'cg-abc',
      householdId: HOUSEHOLD_ID,
      createdAtUtc: new Date('2026-04-19T10:00:00Z'),
    });
    expect(session.id).toBe('sess-xyz');
    expect(session.caregiverId).toBe('cg-abc');
    expect(session.householdId).toBe(HOUSEHOLD_ID);
  });

  it("ne fuit pas d'aliasing : une mutation externe de createdAtUtc ne change pas la session", () => {
    const createdAtUtc = new Date('2026-04-19T08:00:00Z');
    const session = createRestrictedSession({
      id: 'sess-safe',
      caregiverId: 'cg-r',
      householdId: HOUSEHOLD_ID,
      createdAtUtc,
    });
    // Mutation externe impossible car on clone en interne. On vérifie
    // au moins que la session et l'instance source ne partagent pas la
    // même référence.
    expect(session.createdAtUtc).not.toBe(createdAtUtc);
    expect(session.createdAtUtc.getTime()).toBe(createdAtUtc.getTime());
  });
});

describe('RM12 — evaluateSessionValidity', () => {
  it('valid quand nowUtc est strictement avant expiresAtUtc et aucun revokedAtUtc', () => {
    const session = makeSession();
    const now = new Date('2026-04-19T12:00:00Z');
    expect(evaluateSessionValidity({ session, nowUtc: now })).toEqual({ kind: 'valid' });
  });

  it('valid à la borne exacte nowUtc = expiresAtUtc (borne inclusive)', () => {
    const session = makeSession();
    const now = new Date(session.expiresAtUtc.getTime());
    expect(evaluateSessionValidity({ session, nowUtc: now })).toEqual({ kind: 'valid' });
  });

  it('expired dès nowUtc = expiresAtUtc + 1ms', () => {
    const session = makeSession();
    const now = new Date(session.expiresAtUtc.getTime() + 1);
    const decision = evaluateSessionValidity({ session, nowUtc: now });
    expect(decision.kind).toBe('expired');
    if (decision.kind === 'expired') {
      expect(decision.expiredAtUtc.getTime()).toBe(session.expiresAtUtc.getTime());
    }
  });

  it('revoked prioritaire sur expired (session expirée ET révoquée → revoked)', () => {
    const revokedAt = new Date('2026-04-19T09:00:00Z');
    const session = makeSession({ revokedAtUtc: revokedAt, revokedByCaregiverId: 'admin-1' });
    const now = new Date(session.expiresAtUtc.getTime() + 3_600_000); // long après expiration
    const decision = evaluateSessionValidity({ session, nowUtc: now });
    expect(decision.kind).toBe('revoked');
    if (decision.kind === 'revoked') {
      expect(decision.revokedAtUtc.getTime()).toBe(revokedAt.getTime());
    }
  });

  it('revoked quand non expirée mais révoquée', () => {
    const revokedAt = new Date('2026-04-19T09:00:00Z');
    const session = makeSession({ revokedAtUtc: revokedAt, revokedByCaregiverId: 'admin-1' });
    const now = new Date('2026-04-19T10:00:00Z'); // avant expiration à 16h
    const decision = evaluateSessionValidity({ session, nowUtc: now });
    expect(decision.kind).toBe('revoked');
  });
});

describe('RM12 — isSessionValid (prédicat)', () => {
  it('true si valide', () => {
    expect(
      isSessionValid({
        session: makeSession(),
        nowUtc: new Date('2026-04-19T12:00:00Z'),
      }),
    ).toBe(true);
  });

  it('false si expirée', () => {
    expect(
      isSessionValid({
        session: makeSession(),
        nowUtc: new Date('2026-04-19T17:00:00Z'),
      }),
    ).toBe(false);
  });

  it('false si révoquée', () => {
    expect(
      isSessionValid({
        session: makeSession({
          revokedAtUtc: new Date('2026-04-19T09:00:00Z'),
          revokedByCaregiverId: 'admin-1',
        }),
        nowUtc: new Date('2026-04-19T10:00:00Z'),
      }),
    ).toBe(false);
  });
});

describe('RM12 — ensureSessionValid', () => {
  it('ne lève pas si valide', () => {
    expect(() =>
      ensureSessionValid({
        session: makeSession(),
        nowUtc: new Date('2026-04-19T12:00:00Z'),
      }),
    ).not.toThrow();
  });

  it('lève RM12_SESSION_EXPIRED si expirée', () => {
    try {
      ensureSessionValid({
        session: makeSession(),
        nowUtc: new Date('2026-04-19T17:00:00Z'),
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_SESSION_EXPIRED');
    }
  });

  it('lève RM12_SESSION_REVOKED si révoquée (même non expirée)', () => {
    try {
      ensureSessionValid({
        session: makeSession({
          revokedAtUtc: new Date('2026-04-19T09:00:00Z'),
          revokedByCaregiverId: 'admin-1',
        }),
        nowUtc: new Date('2026-04-19T10:00:00Z'),
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_SESSION_REVOKED');
    }
  });
});

describe('RM12 — revokeSession', () => {
  const admin = makeCaregiver({ id: 'admin-1', role: 'admin' });
  const contributor = makeCaregiver({ id: 'contrib-1', role: 'contributor' });
  const restricted = makeCaregiver({
    id: 'cg-restricted-1',
    role: 'restricted_contributor',
  });
  const household = makeHousehold([admin, contributor, restricted]);

  it('Admin du foyer → révocation OK, retourne session avec revokedAtUtc = nowUtc', () => {
    const session = makeSession();
    const now = new Date('2026-04-19T10:00:00Z');
    const revoked = revokeSession({
      session,
      revokerCaregiverId: 'admin-1',
      revokerRole: 'admin',
      nowUtc: now,
      household,
    });
    expect(revoked.revokedAtUtc?.getTime()).toBe(now.getTime());
    expect(revoked.revokedByCaregiverId).toBe('admin-1');
    // Immutabilité : la session source n'est pas mutée.
    expect(session.revokedAtUtc).toBeNull();
  });

  it('contributor non-admin → RM12_NOT_AUTHORIZED_TO_REVOKE', () => {
    const session = makeSession();
    try {
      revokeSession({
        session,
        revokerCaregiverId: 'contrib-1',
        revokerRole: 'contributor',
        nowUtc: new Date('2026-04-19T10:00:00Z'),
        household,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_NOT_AUTHORIZED_TO_REVOKE');
    }
  });

  it('restricted_contributor même sur sa propre session → RM12_NOT_AUTHORIZED_TO_REVOKE', () => {
    const session = makeSession();
    try {
      revokeSession({
        session,
        revokerCaregiverId: 'cg-restricted-1',
        revokerRole: 'restricted_contributor',
        nowUtc: new Date('2026-04-19T10:00:00Z'),
        household,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_NOT_AUTHORIZED_TO_REVOKE');
    }
  });

  it('session déjà révoquée → RM12_ALREADY_REVOKED', () => {
    const session = makeSession({
      revokedAtUtc: new Date('2026-04-19T09:00:00Z'),
      revokedByCaregiverId: 'admin-1',
    });
    try {
      revokeSession({
        session,
        revokerCaregiverId: 'admin-1',
        revokerRole: 'admin',
        nowUtc: new Date('2026-04-19T10:00:00Z'),
        household,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_ALREADY_REVOKED');
    }
  });

  it("refuse la révocation par un Admin d'un autre foyer (session d'un foyer dont il ne fait pas partie)", () => {
    const otherHousehold: Household = {
      id: 'hh-other',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      timezone: 'America/Toronto',
      locale: 'fr',
      caregivers: [makeCaregiver({ id: 'admin-other', role: 'admin', householdId: 'hh-other' })],
    };
    // admin-other tente de révoquer une session du household-11111
    try {
      revokeSession({
        session: makeSession(), // session dans hh-11111
        revokerCaregiverId: 'admin-other',
        revokerRole: 'admin',
        nowUtc: new Date('2026-04-19T10:00:00Z'),
        household: otherHousehold, // household dont admin-other fait partie, mais ce n'est PAS celui de la session
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_NOT_AUTHORIZED_TO_REVOKE');
    }
  });

  it("refuse la révocation par un Admin qui n'appartient pas au household passé", () => {
    // Cas : le revoker prétend être admin mais n'est pas listé dans le household
    const session = makeSession();
    try {
      revokeSession({
        session,
        revokerCaregiverId: 'admin-unknown', // pas dans household
        revokerRole: 'admin',
        nowUtc: new Date('2026-04-19T10:00:00Z'),
        household,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_NOT_AUTHORIZED_TO_REVOKE');
    }
  });

  it("refuse la révocation si l'Admin est `invited` (non actif)", () => {
    const invitedAdmin = makeCaregiver({
      id: 'admin-invited',
      role: 'admin',
      status: 'invited',
    });
    const hh = makeHousehold([admin, invitedAdmin, restricted]);
    try {
      revokeSession({
        session: makeSession(),
        revokerCaregiverId: 'admin-invited',
        revokerRole: 'admin',
        nowUtc: new Date('2026-04-19T10:00:00Z'),
        household: hh,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM12_NOT_AUTHORIZED_TO_REVOKE');
    }
  });
});

describe('RM12 — pureté', () => {
  it('evaluateSessionValidity ne mute pas la session', () => {
    const session = makeSession();
    const frozen = Object.freeze({ ...session });
    expect(() =>
      evaluateSessionValidity({ session: frozen, nowUtc: new Date('2026-04-19T12:00:00Z') }),
    ).not.toThrow();
    expect(frozen.revokedAtUtc).toBeNull();
  });

  it('revokeSession retourne un NOUVEL objet (copie)', () => {
    const admin = makeCaregiver({ id: 'admin-1', role: 'admin' });
    const restricted = makeCaregiver({
      id: 'cg-restricted-1',
      role: 'restricted_contributor',
    });
    const household = makeHousehold([admin, restricted]);
    const session = makeSession();
    const result = revokeSession({
      session,
      revokerCaregiverId: 'admin-1',
      revokerRole: 'admin',
      nowUtc: new Date('2026-04-19T10:00:00Z'),
      household,
    });
    expect(result).not.toBe(session);
    expect(session.revokedAtUtc).toBeNull();
  });
});
