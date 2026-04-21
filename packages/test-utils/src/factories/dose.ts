import type { Dose } from '@kinhale/domain';

let _counter = 0;

export function createTestDose(overrides: Partial<Dose> = {}): Dose {
  const id = `dose-test-${++_counter}`;
  return {
    id,
    householdId: 'household-test-1',
    childId: 'child-test-1',
    pumpId: 'pump-test-1',
    caregiverId: 'caregiver-test-1',
    type: 'maintenance',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: new Date('2026-01-01T08:00:00Z'),
    recordedAtUtc: new Date('2026-01-01T08:00:05Z'),
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
    ...overrides,
  };
}
