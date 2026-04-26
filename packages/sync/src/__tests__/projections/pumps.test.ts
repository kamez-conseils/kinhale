import { describe, it, expect } from 'vitest';
import { projectPumps } from '../../projections/pumps.js';
import type { KinhaleDoc } from '../../doc/schema.js';
import type { PumpReplacedPayload, DoseAdministeredPayload } from '../../events/types.js';

const makePumpEvent = (
  payload: PumpReplacedPayload,
  occurredAtMs = 1_000_000,
  id = 'pump-evt-1',
): KinhaleDoc['events'][number] => ({
  id,
  type: 'PumpReplaced',
  payloadJson: JSON.stringify(payload),
  signerPublicKeyHex: 'a'.repeat(64),
  signatureHex: 'b'.repeat(128),
  deviceId: 'dev-1',
  occurredAtMs,
});

const makeDoseEvent = (
  payload: Partial<DoseAdministeredPayload> & { pumpId: string },
  id = 'dose-1',
): KinhaleDoc['events'][number] => ({
  id,
  type: 'DoseAdministered',
  payloadJson: JSON.stringify({
    doseId: id,
    pumpId: payload.pumpId,
    childId: 'child-1',
    caregiverId: 'dev-1',
    administeredAtMs: 2_000_000,
    doseType: 'maintenance',
    dosesAdministered: 1,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    ...payload,
  }),
  signerPublicKeyHex: 'a'.repeat(64),
  signatureHex: 'b'.repeat(128),
  deviceId: 'dev-1',
  occurredAtMs: 2_000_000,
});

const pump = (overrides: Partial<PumpReplacedPayload> = {}): PumpReplacedPayload => ({
  pumpId: 'pump-1',
  name: 'Ventolin',
  pumpType: 'maintenance',
  totalDoses: 200,
  expiresAtMs: null,
  ...overrides,
});

describe('projectPumps', () => {
  it('retourne une liste vide pour un doc sans événements PumpReplaced', () => {
    expect(projectPumps({ householdId: 'hh-1', events: [] })).toEqual([]);
  });

  it('projette une pompe avec dosesRemaining = totalDoses si aucune prise', () => {
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [makePumpEvent(pump())] };
    const result = projectPumps(doc);
    expect(result).toHaveLength(1);
    expect(result[0]?.pumpId).toBe('pump-1');
    expect(result[0]?.dosesRemaining).toBe(200);
    expect(result[0]?.isExpired).toBe(false);
  });

  it('décrémente dosesRemaining pour chaque DoseAdministered liée', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makePumpEvent(pump({ totalDoses: 200 })),
        makeDoseEvent({ pumpId: 'pump-1' }, 'dose-1'),
        makeDoseEvent({ pumpId: 'pump-1' }, 'dose-2'),
      ],
    };
    const result = projectPumps(doc);
    expect(result[0]?.dosesRemaining).toBe(198);
  });

  it("ne compte pas les doses d'une autre pompe", () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makePumpEvent(pump({ pumpId: 'pump-A', totalDoses: 200 }), 1000, 'e-A'),
        makePumpEvent(pump({ pumpId: 'pump-B', totalDoses: 200 }), 1001, 'e-B'),
        makeDoseEvent({ pumpId: 'pump-A' }, 'dose-1'),
      ],
    };
    const result = projectPumps(doc);
    const pumpA = result.find((p) => p.pumpId === 'pump-A');
    const pumpB = result.find((p) => p.pumpId === 'pump-B');
    expect(pumpA?.dosesRemaining).toBe(199);
    expect(pumpB?.dosesRemaining).toBe(200);
  });

  it('marque la pompe comme expirée si expiresAtMs est dans le passé', () => {
    const expired = pump({ expiresAtMs: 1_000 }); // très ancien
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [makePumpEvent(expired)] };
    const result = projectPumps(doc);
    expect(result[0]?.isExpired).toBe(true);
  });

  it('ne marque pas la pompe comme expirée si expiresAtMs est dans le futur', () => {
    const future = pump({ expiresAtMs: Date.now() + 1_000_000_000 });
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [makePumpEvent(future)] };
    const result = projectPumps(doc);
    expect(result[0]?.isExpired).toBe(false);
  });

  it('ignore les payload JSON invalides silencieusement', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'e1',
          type: 'PumpReplaced',
          payloadJson: 'bad{{{',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1000,
        },
      ],
    };
    expect(projectPumps(doc)).toEqual([]);
  });

  it('ré-incrémente dosesRemaining quand une dose est voidée (RM18 / E4-S07)', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makePumpEvent(pump({ totalDoses: 200 })),
        makeDoseEvent({ pumpId: 'pump-1' }, 'dose-1'),
        makeDoseEvent({ pumpId: 'pump-1' }, 'dose-2'),
        {
          id: 'void-dose-1',
          type: 'DoseVoided',
          payloadJson: JSON.stringify({
            doseId: 'dose-1',
            voidedByDeviceId: 'dev-1',
            voidedAtMs: 3_000_000,
            voidedReason: 'mauvaise pompe',
          }),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 3_000_000,
        },
      ],
    };
    const result = projectPumps(doc);
    // 1 seule dose comptée (la voidée est exclue) → 199 restantes.
    expect(result[0]?.dosesRemaining).toBe(199);
  });
});
