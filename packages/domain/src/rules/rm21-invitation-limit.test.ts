import { describe, expect, it } from 'vitest';
import type { Household } from '../entities/household';
import type { Invitation } from '../entities/invitation';
import { DomainError } from '../errors';
import {
  canCreateInvitation,
  countActiveInvitations,
  ensureCanCreateInvitation,
  MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD,
} from './rm21-invitation-limit';

const NOW = new Date('2026-04-19T12:00:00Z');

function makeHousehold(overrides: Partial<Household> & { id: string }): Household {
  return {
    createdAt: new Date('2026-01-01T00:00:00Z'),
    timezone: 'America/Toronto',
    locale: 'fr',
    caregivers: [],
    ...overrides,
  };
}

function makeInvitation(overrides: Partial<Invitation> & { id: string }): Invitation {
  return {
    householdId: 'h1',
    targetRole: 'contributor',
    status: 'active',
    createdByUserId: 'admin-1',
    createdAtUtc: new Date('2026-04-15T12:00:00Z'),
    expiresAtUtc: new Date('2026-04-22T12:00:00Z'),
    consumedAtUtc: null,
    consumedByUserId: null,
    revokedAtUtc: null,
    maxUses: 1,
    usesCount: 0,
    ...overrides,
  };
}

describe('RM21 — countActiveInvitations', () => {
  it('retourne 0 quand la liste est vide', () => {
    expect(countActiveInvitations([], NOW)).toBe(0);
  });

  it('compte les invitations active non expirées', () => {
    const invitations = [
      makeInvitation({ id: 'i1' }),
      makeInvitation({ id: 'i2' }),
      makeInvitation({ id: 'i3' }),
    ];
    expect(countActiveInvitations(invitations, NOW)).toBe(3);
  });

  it('exclut les invitations consumed / expired / revoked', () => {
    const invitations = [
      makeInvitation({ id: 'i1', status: 'active' }),
      makeInvitation({ id: 'i2', status: 'consumed' }),
      makeInvitation({ id: 'i3', status: 'expired' }),
      makeInvitation({ id: 'i4', status: 'revoked' }),
    ];
    expect(countActiveInvitations(invitations, NOW)).toBe(1);
  });

  it('exclut les invitations active dont expiresAtUtc est déjà passé (défense en profondeur)', () => {
    const invitations = [
      makeInvitation({
        id: 'i1',
        status: 'active',
        expiresAtUtc: new Date('2026-04-18T12:00:00Z'),
      }),
      makeInvitation({
        id: 'i2',
        status: 'active',
        expiresAtUtc: new Date('2026-04-20T12:00:00Z'),
      }),
    ];
    expect(countActiveInvitations(invitations, NOW)).toBe(1);
  });

  it('considère une invitation dont expiresAtUtc = now comme expirée (borne stricte)', () => {
    const invitations = [makeInvitation({ id: 'i1', status: 'active', expiresAtUtc: NOW })];
    expect(countActiveInvitations(invitations, NOW)).toBe(0);
  });

  it('ne mute pas la liste passée en entrée (pureté)', () => {
    const invitations = [
      makeInvitation({ id: 'i1' }),
      makeInvitation({ id: 'i2', status: 'consumed' }),
    ];
    const snapshot = JSON.parse(JSON.stringify(invitations));
    countActiveInvitations(invitations, NOW);
    expect(JSON.parse(JSON.stringify(invitations))).toEqual(snapshot);
  });
});

describe('RM21 — ensureCanCreateInvitation', () => {
  it('accepte un foyer avec 0 invitation', () => {
    const household = makeHousehold({ id: 'h1' });
    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations: [],
        nowUtc: NOW,
      }),
    ).not.toThrow();
  });

  it('accepte un foyer avec 9 invitations active non expirées', () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = Array.from({ length: 9 }, (_, i) =>
      makeInvitation({ id: `i${i}` }),
    );
    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).not.toThrow();
  });

  it('refuse un foyer avec 10 invitations active non expirées (RM21_TOO_MANY_ACTIVE_INVITATIONS)', () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = Array.from({ length: 10 }, (_, i) =>
      makeInvitation({ id: `i${i}` }),
    );

    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).toThrowError(DomainError);

    try {
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM21_TOO_MANY_ACTIVE_INVITATIONS');
      expect((err as DomainError).context).toMatchObject({
        householdId: 'h1',
        activeCount: 10,
        limit: MAX_ACTIVE_INVITATIONS_PER_HOUSEHOLD,
      });
    }
  });

  it('accepte quand 10 invitations dont 3 sont expirées de facto (compte réel 7)', () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = [
      ...Array.from({ length: 7 }, (_, i) => makeInvitation({ id: `i${i}` })),
      ...Array.from({ length: 3 }, (_, i) =>
        makeInvitation({
          id: `stale-${i}`,
          status: 'active',
          expiresAtUtc: new Date('2026-04-10T12:00:00Z'),
        }),
      ),
    ];
    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).not.toThrow();
  });

  it('refuse quand 10 active + 5 consumed (compte = 10)', () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = [
      ...Array.from({ length: 10 }, (_, i) => makeInvitation({ id: `active-${i}` })),
      ...Array.from({ length: 5 }, (_, i) =>
        makeInvitation({
          id: `consumed-${i}`,
          status: 'consumed',
          consumedAtUtc: new Date('2026-04-16T12:00:00Z'),
        }),
      ),
    ];
    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).toThrowError(DomainError);
  });

  it('accepte quand 8 active + 12 revoked (compte = 8)', () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = [
      ...Array.from({ length: 8 }, (_, i) => makeInvitation({ id: `active-${i}` })),
      ...Array.from({ length: 12 }, (_, i) =>
        makeInvitation({
          id: `revoked-${i}`,
          status: 'revoked',
          revokedAtUtc: new Date('2026-04-10T12:00:00Z'),
        }),
      ),
    ];
    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).not.toThrow();
  });

  it("ignore les invitations d'autres foyers (filtre par household.id)", () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = [
      // 5 pour h1 : OK
      ...Array.from({ length: 5 }, (_, i) => makeInvitation({ id: `h1-${i}`, householdId: 'h1' })),
      // 20 pour h2 : ne doit pas influencer la décision
      ...Array.from({ length: 20 }, (_, i) => makeInvitation({ id: `h2-${i}`, householdId: 'h2' })),
    ];
    expect(() =>
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).not.toThrow();
  });

  it("ne fuit pas createdByUserId dans le context d'erreur", () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = Array.from({ length: 10 }, (_, i) =>
      makeInvitation({ id: `i${i}`, createdByUserId: `user-${i}` }),
    );
    try {
      ensureCanCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      });
      expect.fail('should have thrown');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      expect(ctx).not.toHaveProperty('createdByUserId');
      expect(JSON.stringify(ctx)).not.toContain('user-');
    }
  });
});

describe('RM21 — canCreateInvitation', () => {
  it('retourne true quand en dessous de la limite', () => {
    const household = makeHousehold({ id: 'h1' });
    expect(
      canCreateInvitation({
        household,
        existingInvitations: [],
        nowUtc: NOW,
      }),
    ).toBe(true);
  });

  it('retourne false quand la limite est atteinte, sans lever', () => {
    const household = makeHousehold({ id: 'h1' });
    const existingInvitations = Array.from({ length: 10 }, (_, i) =>
      makeInvitation({ id: `i${i}` }),
    );
    expect(
      canCreateInvitation({
        household,
        existingInvitations,
        nowUtc: NOW,
      }),
    ).toBe(false);
  });
});
