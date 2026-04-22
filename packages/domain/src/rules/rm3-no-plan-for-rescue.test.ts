import { describe, expect, it } from 'vitest';
import type { Pump } from '../entities/pump';
import { DomainError } from '../errors';
import { ensureCanAttachPlanToPump } from './rm3-no-plan-for-rescue';

function makePump(overrides: Partial<Pump> & { id: string; type: Pump['type'] }): Pump {
  return {
    householdId: 'h1',
    status: 'active',
    label: 'Flovent',
    dosesRemaining: 120,
    expiresAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('RM3 — ensureCanAttachPlanToPump', () => {
  it('accepte une pompe de fond (maintenance)', () => {
    const pump = makePump({ id: 'p1', type: 'maintenance' });
    expect(() => ensureCanAttachPlanToPump(pump)).not.toThrow();
  });

  it('rejette une pompe de secours (rescue) avec code RM3_PLAN_ON_RESCUE_PUMP', () => {
    const pump = makePump({ id: 'p2', type: 'rescue' });
    expect(() => ensureCanAttachPlanToPump(pump)).toThrowError(DomainError);
    try {
      ensureCanAttachPlanToPump(pump);
    } catch (err) {
      expect((err as DomainError).code).toBe('RM3_PLAN_ON_RESCUE_PUMP');
      expect((err as DomainError).context).toMatchObject({
        pumpId: 'p2',
        pumpType: 'rescue',
      });
    }
  });
});
