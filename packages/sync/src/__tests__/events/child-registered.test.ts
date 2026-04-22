import { describe, it, expect } from 'vitest';
import type { ChildRegisteredPayload } from '../../events/types.js';

describe('ChildRegisteredPayload', () => {
  it('accepte un payload enfant valide', () => {
    const payload: ChildRegisteredPayload = {
      childId: 'child-abc',
      firstName: 'Emma',
      birthYear: 2020,
    };
    expect(payload.childId).toBe('child-abc');
    expect(payload.firstName).toBe('Emma');
    expect(payload.birthYear).toBe(2020);
  });
});
