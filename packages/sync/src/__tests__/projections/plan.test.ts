import { describe, it, expect } from 'vitest';
import { projectPlan } from '../../projections/plan.js';
import type { KinhaleDoc } from '../../doc/schema.js';
import type { PlanUpdatedPayload } from '../../events/types.js';

const makePlanEvent = (
  payload: PlanUpdatedPayload,
  occurredAtMs = 1_000_000,
  id = 'plan-evt-1',
): KinhaleDoc['events'][number] => ({
  id,
  type: 'PlanUpdated',
  payloadJson: JSON.stringify(payload),
  signerPublicKeyHex: 'a'.repeat(64),
  signatureHex: 'b'.repeat(128),
  deviceId: 'dev-1',
  occurredAtMs,
});

const plan = (overrides: Partial<PlanUpdatedPayload> = {}): PlanUpdatedPayload => ({
  planId: 'plan-1',
  pumpId: 'pump-1',
  scheduledHoursUtc: [8, 20],
  startAtMs: 1_000_000,
  endAtMs: null,
  ...overrides,
});

describe('projectPlan', () => {
  it('retourne null pour un doc sans événement PlanUpdated', () => {
    expect(projectPlan({ householdId: 'hh-1', events: [] })).toBeNull();
  });

  it('projette le payload JSON en objet typé', () => {
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [makePlanEvent(plan())] };
    const result = projectPlan(doc);
    expect(result).not.toBeNull();
    expect(result?.planId).toBe('plan-1');
    expect(result?.pumpId).toBe('pump-1');
    expect(result?.scheduledHoursUtc).toEqual([8, 20]);
    expect(result?.eventId).toBe('plan-evt-1');
  });

  it('retourne le plan le plus récent en cas de multiples PlanUpdated', () => {
    const older = makePlanEvent(plan({ planId: 'old', scheduledHoursUtc: [8] }), 1000, 'e-old');
    const newer = makePlanEvent(plan({ planId: 'new', scheduledHoursUtc: [8, 20] }), 2000, 'e-new');
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [older, newer] };
    expect(projectPlan(doc)?.planId).toBe('new');
  });

  it('ignore les payload JSON invalides', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'PlanUpdated',
          payloadJson: 'bad{{{',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectPlan(doc)).toBeNull();
  });
});
