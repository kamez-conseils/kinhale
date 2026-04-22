import { describe, it, expect } from 'vitest';
import { projectChild } from '../../projections/child.js';
import type { KinhaleDoc } from '../../doc/schema.js';
import type { ChildRegisteredPayload } from '../../events/types.js';

const makeChildEvent = (
  payload: ChildRegisteredPayload,
  occurredAtMs = 1_000_000,
  id = 'evt-1',
): KinhaleDoc['events'][number] => ({
  id,
  type: 'ChildRegistered',
  payloadJson: JSON.stringify(payload),
  signerPublicKeyHex: 'a'.repeat(64),
  signatureHex: 'b'.repeat(128),
  deviceId: 'dev-1',
  occurredAtMs,
});

const child = (overrides: Partial<ChildRegisteredPayload> = {}): ChildRegisteredPayload => ({
  childId: 'child-1',
  firstName: 'Emma',
  birthYear: 2020,
  ...overrides,
});

describe('projectChild', () => {
  it('retourne null pour un doc sans événement ChildRegistered', () => {
    expect(projectChild({ householdId: 'hh-1', events: [] })).toBeNull();
  });

  it('ignore les événements non-ChildRegistered', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'DoseAdministered',
          payloadJson: '{}',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectChild(doc)).toBeNull();
  });

  it('projette le payload JSON en objet typé', () => {
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [makeChildEvent(child())] };
    const result = projectChild(doc);
    expect(result).not.toBeNull();
    expect(result?.childId).toBe('child-1');
    expect(result?.firstName).toBe('Emma');
    expect(result?.birthYear).toBe(2020);
    expect(result?.eventId).toBe('evt-1');
    expect(result?.deviceId).toBe('dev-1');
  });

  it('retourne le plus récent en cas de multiples événements ChildRegistered (RM13)', () => {
    const older = makeChildEvent(
      child({ childId: 'old', firstName: 'Ancienne' }),
      1000,
      'e-old',
    );
    const newer = makeChildEvent(
      child({ childId: 'new', firstName: 'Nouvelle' }),
      2000,
      'e-new',
    );
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [older, newer] };
    const result = projectChild(doc);
    expect(result?.childId).toBe('new');
  });

  it('ignore un payload avec JSON invalide', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'ChildRegistered',
          payloadJson: 'bad-json{{{',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectChild(doc)).toBeNull();
  });

  it('ignore un payload structurellement invalide', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'ChildRegistered',
          payloadJson: JSON.stringify({ childId: 42 }),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectChild(doc)).toBeNull();
  });
});
