import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  ensureSameTenant,
  isSameTenant,
  type TenantContext,
  type TenantTargetRequest,
} from './rm11-multitenant-isolation';

const CTX: TenantContext = {
  tokenHouseholdId: 'hh-11111111-1111-4111-8111-111111111111',
  tokenCaregiverId: 'cg-22222222-2222-4222-8222-222222222222',
};

describe('RM11 — ensureSameTenant : alignement tenant token/requête', () => {
  it('accepte une requête ciblant le foyer du token', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId,
    };
    expect(() => ensureSameTenant({ context: CTX, request })).not.toThrow();
  });

  it('refuse une requête ciblant un autre foyer avec RM11_TENANT_MISMATCH', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: 'hh-99999999-9999-4999-8999-999999999999',
    };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM11_TENANT_MISMATCH');
    }
  });

  it('accepte un caregiverId client identique à celui du token', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId,
      clientClaimedCaregiverId: CTX.tokenCaregiverId,
    };
    expect(() => ensureSameTenant({ context: CTX, request })).not.toThrow();
  });

  it('refuse un caregiverId client différent du token avec RM11_CAREGIVER_MISMATCH', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId,
      clientClaimedCaregiverId: 'cg-00000000-0000-4000-8000-000000000000',
    };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM11_CAREGIVER_MISMATCH');
    }
  });

  it('accepte une requête sans clientClaimedCaregiverId (pas de cross-check exigé)', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId,
    };
    expect(() => ensureSameTenant({ context: CTX, request })).not.toThrow();
  });

  it('compare strictement — majuscules considérées comme différentes (anti-bypass)', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId.toUpperCase(),
    };
    expect(() => ensureSameTenant({ context: CTX, request })).toThrowError(DomainError);
  });

  it('refuse aussi quand le tenant match mais le caregiver en majuscules diffère', () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId,
      clientClaimedCaregiverId: CTX.tokenCaregiverId.toUpperCase(),
    };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM11_CAREGIVER_MISMATCH');
    }
  });

  it('vérifie le tenant avant le caregiver (priorité tenant)', () => {
    // Si tenant ET caregiver divergent : l'erreur prioritaire est le tenant.
    const request: TenantTargetRequest = {
      targetHouseholdId: 'hh-ffffffff-ffff-4fff-8fff-ffffffffffff',
      clientClaimedCaregiverId: 'cg-ffffffff-ffff-4fff-8fff-ffffffffffff',
    };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM11_TENANT_MISMATCH');
    }
  });

  it("n'expose PAS les valeurs réelles tokenHouseholdId / tokenCaregiverId dans le context d'erreur", () => {
    const request: TenantTargetRequest = {
      targetHouseholdId: 'hh-99999999-9999-4999-8999-999999999999',
    };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      const serialized = JSON.stringify(ctx);
      expect(serialized).not.toContain(CTX.tokenHouseholdId);
      expect(serialized).not.toContain(CTX.tokenCaregiverId);
    }
  });

  it("n'expose PAS targetHouseholdId dans le context d'erreur (anti-fuite symétrique)", () => {
    const targetHouseholdId = 'hh-99999999-9999-4999-8999-999999999999';
    const request: TenantTargetRequest = { targetHouseholdId };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      const serialized = JSON.stringify(ctx);
      expect(serialized).not.toContain(targetHouseholdId);
    }
  });

  it("n'expose PAS le clientClaimedCaregiverId en clair en cas de mismatch caregiver", () => {
    const clientClaimedCaregiverId = 'cg-00000000-0000-4000-8000-000000000000';
    const request: TenantTargetRequest = {
      targetHouseholdId: CTX.tokenHouseholdId,
      clientClaimedCaregiverId,
    };
    try {
      ensureSameTenant({ context: CTX, request });
      throw new Error('expected throw');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      const serialized = JSON.stringify(ctx);
      expect(serialized).not.toContain(clientClaimedCaregiverId);
      expect(serialized).not.toContain(CTX.tokenCaregiverId);
    }
  });

  it('est pure : ne mute ni context ni request', () => {
    const ctx: TenantContext = { ...CTX };
    const frozenCtx = Object.freeze({ ...ctx });
    const request: TenantTargetRequest = {
      targetHouseholdId: ctx.tokenHouseholdId,
      clientClaimedCaregiverId: ctx.tokenCaregiverId,
    };
    const frozenRequest = Object.freeze({ ...request });
    expect(() => ensureSameTenant({ context: frozenCtx, request: frozenRequest })).not.toThrow();
    // Les frozens n'ont pas été modifiés (shape preservée).
    expect(frozenCtx).toEqual(ctx);
    expect(frozenRequest.targetHouseholdId).toBe(ctx.tokenHouseholdId);
  });
});

describe('RM11 — isSameTenant : prédicat non-levant', () => {
  it('retourne true quand tout concorde', () => {
    expect(
      isSameTenant({
        context: CTX,
        request: { targetHouseholdId: CTX.tokenHouseholdId },
      }),
    ).toBe(true);
  });

  it('retourne false sur tenant mismatch', () => {
    expect(
      isSameTenant({
        context: CTX,
        request: { targetHouseholdId: 'hh-99999999-9999-4999-8999-999999999999' },
      }),
    ).toBe(false);
  });

  it('retourne false sur caregiver mismatch', () => {
    expect(
      isSameTenant({
        context: CTX,
        request: {
          targetHouseholdId: CTX.tokenHouseholdId,
          clientClaimedCaregiverId: 'cg-00000000-0000-4000-8000-000000000000',
        },
      }),
    ).toBe(false);
  });

  it('retourne true quand clientClaimedCaregiverId est undefined', () => {
    expect(
      isSameTenant({
        context: CTX,
        request: { targetHouseholdId: CTX.tokenHouseholdId },
      }),
    ).toBe(true);
  });
});
