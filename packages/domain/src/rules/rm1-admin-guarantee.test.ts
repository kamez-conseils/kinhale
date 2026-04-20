import { describe, expect, it } from 'vitest';
import type { Caregiver } from '../entities/caregiver';
import type { Household } from '../entities/household';
import type { Role } from '../entities/role';
import { DomainError } from '../errors';
import { ensureAtLeastOneAdmin } from './rm1-admin-guarantee';

function makeCaregiver(overrides: Partial<Caregiver> & { id: string; role: Role }): Caregiver {
  return {
    householdId: 'h1',
    status: 'active',
    displayName: 'Alice',
    invitedAt: new Date('2026-01-01T00:00:00Z'),
    activatedAt: new Date('2026-01-02T00:00:00Z'),
    revokedAt: null,
    ...overrides,
  };
}

function makeHousehold(caregivers: Caregiver[]): Household {
  return {
    id: 'h1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    timezone: 'America/Toronto',
    locale: 'fr',
    caregivers,
  };
}

describe('RM1 — ensureAtLeastOneAdmin', () => {
  it('accepte un foyer avec un seul Admin quand on ne retire personne', () => {
    const household = makeHousehold([makeCaregiver({ id: 'c1', role: 'admin' })]);
    expect(() => ensureAtLeastOneAdmin(household)).not.toThrow();
  });

  it('accepte un foyer avec plusieurs Admins', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'c1', role: 'admin' }),
      makeCaregiver({ id: 'c2', role: 'admin' }),
      makeCaregiver({ id: 'c3', role: 'contributor' }),
    ]);
    expect(() => ensureAtLeastOneAdmin(household)).not.toThrow();
  });

  it('rejette un foyer sans aucun Admin actif avec code RM1_NO_ADMIN_IN_HOUSEHOLD', () => {
    const household = makeHousehold([makeCaregiver({ id: 'c1', role: 'contributor' })]);
    expect(() => ensureAtLeastOneAdmin(household)).toThrowError(DomainError);
    try {
      ensureAtLeastOneAdmin(household);
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM1_NO_ADMIN_IN_HOUSEHOLD');
    }
  });

  it('ignore les Admins dont le statut est invited ou revoked', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'c1', role: 'admin', status: 'revoked' }),
      makeCaregiver({ id: 'c2', role: 'admin', status: 'invited' }),
    ]);
    expect(() => ensureAtLeastOneAdmin(household)).toThrowError(/no active admin/);
  });

  it('rejette le retrait du dernier Admin avec code RM1_LAST_ADMIN_REMOVAL', () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin1', role: 'admin' }),
      makeCaregiver({ id: 'contrib1', role: 'contributor' }),
    ]);
    expect(() => ensureAtLeastOneAdmin(household, { removingCaregiverId: 'admin1' })).toThrowError(
      DomainError,
    );
    try {
      ensureAtLeastOneAdmin(household, { removingCaregiverId: 'admin1' });
    } catch (err) {
      expect((err as DomainError).code).toBe('RM1_LAST_ADMIN_REMOVAL');
      expect((err as DomainError).context).toMatchObject({
        householdId: 'h1',
        removingCaregiverId: 'admin1',
        activeAdminCount: 1,
      });
    }
  });

  it("accepte le retrait d'un Admin s'il en reste un autre actif", () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin1', role: 'admin' }),
      makeCaregiver({ id: 'admin2', role: 'admin' }),
    ]);
    expect(() => ensureAtLeastOneAdmin(household, { removingCaregiverId: 'admin1' })).not.toThrow();
  });

  it("accepte le retrait d'un contributeur (non-Admin) sans impact", () => {
    const household = makeHousehold([
      makeCaregiver({ id: 'admin1', role: 'admin' }),
      makeCaregiver({ id: 'contrib1', role: 'contributor' }),
    ]);
    expect(() =>
      ensureAtLeastOneAdmin(household, { removingCaregiverId: 'contrib1' }),
    ).not.toThrow();
  });
});
