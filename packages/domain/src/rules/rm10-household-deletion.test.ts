import { describe, expect, it } from 'vitest';
import type { Caregiver } from '../entities/caregiver';
import type { Household } from '../entities/household';
import type { Role } from '../entities/role';
import type { DomainError } from '../errors';
import {
  cancelHouseholdDeletion,
  DELETION_GRACE_PERIOD_DAYS,
  DELETION_PORTABILITY_COVERAGE_DAYS,
  DELETION_PURGE_MAX_DAYS,
  evaluateDeletionState,
  type HouseholdDeletionState,
  pseudonymizeHouseholdForAudit,
  purgeDeadlineUtc,
  requestHouseholdDeletion,
} from './rm10-household-deletion';

const HOUSEHOLD_ID = 'hh-11111111-1111-4111-8111-111111111111';
const DAY_MS = 86_400_000;

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

const ADMIN = makeCaregiver({ id: 'admin-1', role: 'admin' });
const ADMIN_2 = makeCaregiver({ id: 'admin-2', role: 'admin' });
const CONTRIB = makeCaregiver({ id: 'contrib-1', role: 'contributor' });

describe('RM10 — constantes', () => {
  it('grace = 7 jours', () => {
    expect(DELETION_GRACE_PERIOD_DAYS).toBe(7);
  });

  it('purge max backups = 30 jours', () => {
    expect(DELETION_PURGE_MAX_DAYS).toBe(30);
  });

  it('couverture portabilité = 365 jours', () => {
    expect(DELETION_PORTABILITY_COVERAGE_DAYS).toBe(365);
  });
});

describe('RM10 — requestHouseholdDeletion', () => {
  const NOW = new Date('2026-04-19T12:00:00Z');

  it("foyer actif avec 1 admin → état 'pending_deletion', grace = now + 7j, archive manifest cohérent", () => {
    const household = makeHousehold([ADMIN, CONTRIB]);
    const result = requestHouseholdDeletion({
      household,
      requesterCaregiverId: 'admin-1',
      nowUtc: NOW,
    });

    expect(result.nextState.status).toBe('pending_deletion');
    expect(result.nextState.requestedAtUtc?.toISOString()).toBe(NOW.toISOString());
    expect(result.nextState.requestedByCaregiverId).toBe('admin-1');
    expect(result.nextState.graceExpiresAtUtc?.getTime()).toBe(
      NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS,
    );
    expect(result.nextState.deletedAtUtc).toBeNull();

    expect(result.archiveManifest.householdId).toBe(HOUSEHOLD_ID);
    expect(result.archiveManifest.requestedAtUtc.getTime()).toBe(NOW.getTime());
    expect(result.archiveManifest.requestedByCaregiverId).toBe('admin-1');
    expect(result.archiveManifest.coveragePeriodFromUtc.getTime()).toBe(
      NOW.getTime() - DELETION_PORTABILITY_COVERAGE_DAYS * DAY_MS,
    );
    expect(result.archiveManifest.coveragePeriodToUtc.getTime()).toBe(NOW.getTime());
    expect(result.archiveManifest.formats).toEqual(['csv', 'pdf']);
  });

  it('refuse avec >1 admin actif (doit passer par W11 transfert admin)', () => {
    const household = makeHousehold([ADMIN, ADMIN_2, CONTRIB]);
    try {
      requestHouseholdDeletion({
        household,
        requesterCaregiverId: 'admin-1',
        nowUtc: NOW,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_MULTIPLE_ADMINS_PRESENT');
    }
  });

  it('refuse si demandeur est contributor (non admin)', () => {
    const household = makeHousehold([ADMIN, CONTRIB]);
    try {
      requestHouseholdDeletion({
        household,
        requesterCaregiverId: 'contrib-1',
        nowUtc: NOW,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_NOT_AUTHORIZED');
    }
  });

  it("refuse si demandeur n'est pas dans le foyer", () => {
    const household = makeHousehold([ADMIN, CONTRIB]);
    try {
      requestHouseholdDeletion({
        household,
        requesterCaregiverId: 'cg-external',
        nowUtc: NOW,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_NOT_AUTHORIZED');
    }
  });

  it("refuse si l'admin n'est pas en statut 'active' (ex: 'invited')", () => {
    const invitedAdmin = makeCaregiver({
      id: 'admin-invited',
      role: 'admin',
      status: 'invited',
    });
    const household = makeHousehold([invitedAdmin, CONTRIB]);
    try {
      requestHouseholdDeletion({
        household,
        requesterCaregiverId: 'admin-invited',
        nowUtc: NOW,
      });
      throw new Error('expected throw');
    } catch (err) {
      // Le foyer a 0 admin actif → vu que le requester n'est pas un admin actif,
      // c'est NOT_AUTHORIZED qui l'emporte.
      expect((err as DomainError).code).toBe('RM10_NOT_AUTHORIZED');
    }
  });

  it('refuse si admin révoqué', () => {
    const revokedAdmin = makeCaregiver({
      id: 'admin-rev',
      role: 'admin',
      status: 'revoked',
      revokedAt: new Date('2026-03-01T00:00:00Z'),
    });
    const household = makeHousehold([revokedAdmin, CONTRIB]);
    try {
      requestHouseholdDeletion({
        household,
        requesterCaregiverId: 'admin-rev',
        nowUtc: NOW,
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_NOT_AUTHORIZED');
    }
  });

  it('admin2 seul actif (admin1 révoqué) → OK car 1 seul admin actif', () => {
    const revokedAdmin = makeCaregiver({
      id: 'admin-1',
      role: 'admin',
      status: 'revoked',
      revokedAt: new Date('2026-03-01T00:00:00Z'),
    });
    const household = makeHousehold([revokedAdmin, ADMIN_2, CONTRIB]);
    const result = requestHouseholdDeletion({
      household,
      requesterCaregiverId: 'admin-2',
      nowUtc: NOW,
    });
    expect(result.nextState.status).toBe('pending_deletion');
  });
});

describe('RM10 — cancelHouseholdDeletion', () => {
  const NOW = new Date('2026-04-19T12:00:00Z');

  function pendingState(overrides: Partial<HouseholdDeletionState> = {}): HouseholdDeletionState {
    return {
      status: 'pending_deletion',
      requestedAtUtc: NOW,
      graceExpiresAtUtc: new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS),
      deletedAtUtc: null,
      requestedByCaregiverId: 'admin-1',
      ...overrides,
    };
  }

  it('annulation dans les 7j → status redevient active', () => {
    const current = pendingState();
    const later = new Date(NOW.getTime() + 3 * DAY_MS);
    const result = cancelHouseholdDeletion({
      currentState: current,
      nowUtc: later,
      requesterCaregiverId: 'admin-1',
    });
    expect(result.status).toBe('active');
    expect(result.requestedAtUtc).toBeNull();
    expect(result.graceExpiresAtUtc).toBeNull();
    expect(result.deletedAtUtc).toBeNull();
    expect(result.requestedByCaregiverId).toBeNull();
  });

  it('annulation à J+7 pile (borne inclusive) → OK', () => {
    const current = pendingState();
    const exactLimit = new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS);
    const result = cancelHouseholdDeletion({
      currentState: current,
      nowUtc: exactLimit,
      requesterCaregiverId: 'admin-1',
    });
    expect(result.status).toBe('active');
  });

  it('annulation à J+7 + 1ms → refuse RM10_GRACE_PERIOD_EXPIRED', () => {
    const current = pendingState();
    const tooLate = new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS + 1);
    try {
      cancelHouseholdDeletion({
        currentState: current,
        nowUtc: tooLate,
        requesterCaregiverId: 'admin-1',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_GRACE_PERIOD_EXPIRED');
    }
  });

  it('annulation sur état active → RM10_CANNOT_CANCEL', () => {
    const current: HouseholdDeletionState = {
      status: 'active',
      requestedAtUtc: null,
      graceExpiresAtUtc: null,
      deletedAtUtc: null,
      requestedByCaregiverId: null,
    };
    try {
      cancelHouseholdDeletion({
        currentState: current,
        nowUtc: NOW,
        requesterCaregiverId: 'admin-1',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_CANNOT_CANCEL');
    }
  });

  it('annulation sur état deleted → RM10_CANNOT_CANCEL', () => {
    const current: HouseholdDeletionState = {
      status: 'deleted',
      requestedAtUtc: NOW,
      graceExpiresAtUtc: new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS),
      deletedAtUtc: new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS),
      requestedByCaregiverId: 'admin-1',
    };
    try {
      cancelHouseholdDeletion({
        currentState: current,
        nowUtc: new Date(NOW.getTime() + 10 * DAY_MS),
        requesterCaregiverId: 'admin-1',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM10_CANNOT_CANCEL');
    }
  });
});

describe('RM10 — evaluateDeletionState', () => {
  const REQUESTED = new Date('2026-04-19T12:00:00Z');
  const GRACE_END = new Date(REQUESTED.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS);

  const pendingState: HouseholdDeletionState = {
    status: 'pending_deletion',
    requestedAtUtc: REQUESTED,
    graceExpiresAtUtc: GRACE_END,
    deletedAtUtc: null,
    requestedByCaregiverId: 'admin-1',
  };

  it('pending_deletion grace non expirée → inchangé', () => {
    const beforeExpiry = new Date(GRACE_END.getTime() - 1);
    const result = evaluateDeletionState({ currentState: pendingState, nowUtc: beforeExpiry });
    expect(result).toEqual(pendingState);
  });

  it('pending_deletion grace à la borne inclusive → inchangé', () => {
    const result = evaluateDeletionState({ currentState: pendingState, nowUtc: GRACE_END });
    expect(result.status).toBe('pending_deletion');
  });

  it('pending_deletion grace expirée (nowUtc > graceExpiresAtUtc) → transition deleted', () => {
    const afterExpiry = new Date(GRACE_END.getTime() + 1);
    const result = evaluateDeletionState({ currentState: pendingState, nowUtc: afterExpiry });
    expect(result.status).toBe('deleted');
    expect(result.deletedAtUtc?.getTime()).toBe(afterExpiry.getTime());
    // Champs conservés
    expect(result.requestedAtUtc?.getTime()).toBe(REQUESTED.getTime());
    expect(result.graceExpiresAtUtc?.getTime()).toBe(GRACE_END.getTime());
    expect(result.requestedByCaregiverId).toBe('admin-1');
  });

  it('deleted → inchangé même très loin dans le futur', () => {
    const deletedState: HouseholdDeletionState = {
      ...pendingState,
      status: 'deleted',
      deletedAtUtc: GRACE_END,
    };
    const result = evaluateDeletionState({
      currentState: deletedState,
      nowUtc: new Date('2030-01-01T00:00:00Z'),
    });
    expect(result).toEqual(deletedState);
  });

  it('active → inchangé', () => {
    const active: HouseholdDeletionState = {
      status: 'active',
      requestedAtUtc: null,
      graceExpiresAtUtc: null,
      deletedAtUtc: null,
      requestedByCaregiverId: null,
    };
    const result = evaluateDeletionState({
      currentState: active,
      nowUtc: new Date('2027-01-01T00:00:00Z'),
    });
    expect(result).toEqual(active);
  });
});

describe('RM10 — purgeDeadlineUtc', () => {
  it('foyer deleted → deadline = deletedAtUtc + 30j', () => {
    const deletedAtUtc = new Date('2026-04-26T12:00:00Z');
    const state: HouseholdDeletionState = {
      status: 'deleted',
      requestedAtUtc: new Date('2026-04-19T12:00:00Z'),
      graceExpiresAtUtc: deletedAtUtc,
      deletedAtUtc,
      requestedByCaregiverId: 'admin-1',
    };
    const deadline = purgeDeadlineUtc(state);
    expect(deadline).not.toBeNull();
    expect(deadline?.getTime()).toBe(deletedAtUtc.getTime() + DELETION_PURGE_MAX_DAYS * DAY_MS);
  });

  it('foyer active → null', () => {
    const active: HouseholdDeletionState = {
      status: 'active',
      requestedAtUtc: null,
      graceExpiresAtUtc: null,
      deletedAtUtc: null,
      requestedByCaregiverId: null,
    };
    expect(purgeDeadlineUtc(active)).toBeNull();
  });

  it('foyer pending_deletion → null', () => {
    const pending: HouseholdDeletionState = {
      status: 'pending_deletion',
      requestedAtUtc: new Date('2026-04-19T12:00:00Z'),
      graceExpiresAtUtc: new Date('2026-04-26T12:00:00Z'),
      deletedAtUtc: null,
      requestedByCaregiverId: 'admin-1',
    };
    expect(purgeDeadlineUtc(pending)).toBeNull();
  });
});

describe('RM10 — pseudonymizeHouseholdForAudit', () => {
  const SALT = 'kinhale-audit-salt-kv1';

  it('retourne un hex minuscule 64 caractères', async () => {
    const pseudo = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: SALT,
    });
    expect(pseudo).toMatch(/^[0-9a-f]{64}$/);
    expect(pseudo).toHaveLength(64);
  });

  it('est déterministe (même input → même sortie)', async () => {
    const a = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: SALT,
    });
    const b = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: SALT,
    });
    expect(a).toBe(b);
  });

  it('produit une sortie différente pour un autre householdId', async () => {
    const a = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: SALT,
    });
    const b = await pseudonymizeHouseholdForAudit({
      householdId: 'hh-99999999-9999-4999-8999-999999999999',
      auditSalt: SALT,
    });
    expect(a).not.toBe(b);
  });

  it('produit une sortie différente pour un autre salt', async () => {
    const a = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: SALT,
    });
    const b = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: 'kinhale-audit-salt-kv2',
    });
    expect(a).not.toBe(b);
  });

  it('ne contient pas le householdId en clair (irréversibilité sur sortie)', async () => {
    const pseudo = await pseudonymizeHouseholdForAudit({
      householdId: HOUSEHOLD_ID,
      auditSalt: SALT,
    });
    expect(pseudo.includes(HOUSEHOLD_ID)).toBe(false);
  });
});

describe('RM10 — pureté', () => {
  const NOW = new Date('2026-04-19T12:00:00Z');

  it('requestHouseholdDeletion ne mute pas le household', () => {
    const household = makeHousehold([ADMIN, CONTRIB]);
    const snapshot = JSON.stringify(household);
    requestHouseholdDeletion({
      household,
      requesterCaregiverId: 'admin-1',
      nowUtc: NOW,
    });
    expect(JSON.stringify(household)).toBe(snapshot);
  });

  it('cancelHouseholdDeletion ne mute pas currentState', () => {
    const current: HouseholdDeletionState = {
      status: 'pending_deletion',
      requestedAtUtc: NOW,
      graceExpiresAtUtc: new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS),
      deletedAtUtc: null,
      requestedByCaregiverId: 'admin-1',
    };
    const snapshot = JSON.stringify(current);
    cancelHouseholdDeletion({
      currentState: current,
      nowUtc: new Date(NOW.getTime() + DAY_MS),
      requesterCaregiverId: 'admin-1',
    });
    expect(JSON.stringify(current)).toBe(snapshot);
  });

  it('evaluateDeletionState ne mute pas currentState', () => {
    const state: HouseholdDeletionState = {
      status: 'pending_deletion',
      requestedAtUtc: NOW,
      graceExpiresAtUtc: new Date(NOW.getTime() + DELETION_GRACE_PERIOD_DAYS * DAY_MS),
      deletedAtUtc: null,
      requestedByCaregiverId: 'admin-1',
    };
    const snapshot = JSON.stringify(state);
    evaluateDeletionState({
      currentState: state,
      nowUtc: new Date(NOW.getTime() + 30 * DAY_MS),
    });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
