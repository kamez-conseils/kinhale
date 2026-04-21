import type { Caregiver } from '@kinhale/domain'

let _counter = 0

export function createTestCaregiver(overrides: Partial<Caregiver> = {}): Caregiver {
  const id = `caregiver-test-${++_counter}`
  return {
    id,
    householdId: 'household-test-1',
    role: 'admin',
    status: 'active',
    displayName: `Aidant Test ${_counter}`,
    invitedAt: new Date('2026-01-01T00:00:00Z'),
    activatedAt: new Date('2026-01-01T00:01:00Z'),
    revokedAt: null,
    ...overrides,
  }
}
