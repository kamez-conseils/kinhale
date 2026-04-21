import type { Household } from '@kinhale/domain';

let _counter = 0;

export function createTestHousehold(overrides: Partial<Household> = {}): Household {
  const id = `household-test-${++_counter}`;
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    timezone: 'America/Montreal',
    locale: 'fr',
    caregivers: [],
    ...overrides,
  };
}
