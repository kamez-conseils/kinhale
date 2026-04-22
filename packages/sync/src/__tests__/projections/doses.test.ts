import { describe, it, expect } from 'vitest';
import { projectDoses } from '../../projections/doses.js';
import type { KinhaleDoc } from '../../doc/schema.js';
import type { DoseAdministeredPayload } from '../../events/types.js';

const makeDoc = (
  entries: Array<{ payload: DoseAdministeredPayload; occurredAtMs?: number }>,
): KinhaleDoc => ({
  householdId: 'hh-1',
  events: entries.map((e, i) => ({
    id: `evt-${String(i)}`,
    type: 'DoseAdministered',
    payloadJson: JSON.stringify(e.payload),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs: e.occurredAtMs ?? e.payload.administeredAtMs,
  })),
});

const dose = (overrides: Partial<DoseAdministeredPayload> = {}): DoseAdministeredPayload => ({
  doseId: 'dose-1',
  pumpId: 'pump-1',
  childId: 'child-1',
  caregiverId: 'dev-1',
  administeredAtMs: 1_000_000,
  doseType: 'maintenance',
  dosesAdministered: 1,
  symptoms: [],
  circumstances: [],
  freeFormTag: null,
  ...overrides,
});

describe('projectDoses', () => {
  it('retourne une liste vide pour un document sans événements', () => {
    expect(projectDoses({ householdId: 'hh-1', events: [] })).toEqual([]);
  });

  it('ignore les événements non-DoseAdministered', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'PumpReplaced',
          payloadJson: '{}',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectDoses(doc)).toEqual([]);
  });

  it('projette le payload JSON en objet typé', () => {
    const d = dose({ doseType: 'rescue', symptoms: ['cough'] });
    const result = projectDoses(makeDoc([{ payload: d }]));
    expect(result).toHaveLength(1);
    expect(result[0]?.doseType).toBe('rescue');
    expect(result[0]?.symptoms).toEqual(['cough']);
    expect(result[0]?.eventId).toBe('evt-0');
    expect(result[0]?.deviceId).toBe('dev-1');
  });

  it('trie par administeredAtMs décroissant', () => {
    const older = dose({ doseId: 'old', administeredAtMs: 1_000 });
    const newer = dose({ doseId: 'new', administeredAtMs: 2_000 });
    const result = projectDoses(makeDoc([{ payload: older }, { payload: newer }]));
    expect(result[0]?.doseId).toBe('new');
    expect(result[1]?.doseId).toBe('old');
  });

  it("préserve occurredAtMs depuis l'événement signé", () => {
    const d = dose({ administeredAtMs: 5_000 });
    const result = projectDoses(makeDoc([{ payload: d, occurredAtMs: 9_000 }]));
    expect(result[0]?.occurredAtMs).toBe(9_000);
  });

  it('ignore les événements avec payload structurellement invalide', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'DoseAdministered',
          payloadJson: JSON.stringify({ doseType: 'garbage', symptoms: null }),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectDoses(doc)).toEqual([]);
  });

  it('ignore les événements avec JSON invalide', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'DoseAdministered',
          payloadJson: 'not-json{{{',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectDoses(doc)).toEqual([]);
  });
});
