import { describe, expect, it } from 'vitest';
import type { KinhaleDoc, SignedEventRecord } from '@kinhale/sync';
import { canonicalJsonStringify, serializeDocForExport } from './serialize-doc.js';

/**
 * Fabrique d'événement signé en clair pour les tests. Les champs
 * signature/publicKey sont fictifs — les projections ne les vérifient pas.
 */
function makeEvent(args: {
  id: string;
  type: SignedEventRecord['type'];
  payload: unknown;
  occurredAtMs: number;
  deviceId?: string;
}): SignedEventRecord {
  return {
    id: args.id,
    type: args.type,
    payloadJson: JSON.stringify(args.payload),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: args.deviceId ?? 'device-1',
    occurredAtMs: args.occurredAtMs,
  };
}

const BASE_MS = Date.UTC(2026, 3, 24, 12, 0, 0);

describe('serializeDocForExport', () => {
  it('retourne une structure squelette sur doc vide', () => {
    const doc: KinhaleDoc = { householdId: 'hh-1', events: [] };
    const out = serializeDocForExport(doc, BASE_MS);

    expect(out.householdId).toBe('hh-1');
    expect(out.exportedAtMs).toBe(BASE_MS);
    expect(out.schemaVersion).toBe(1);
    expect(out.child).toBeNull();
    expect(out.caregivers).toEqual([]);
    expect(out.pumps).toEqual([]);
    expect(out.plans).toEqual([]);
    expect(out.doses).toEqual([]);
  });

  it('projette tous les domaines avec les champs attendus', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'e-child',
          type: 'ChildRegistered',
          payload: { childId: 'child-1', firstName: 'Léa', birthYear: 2020 },
          occurredAtMs: BASE_MS - 1000,
          deviceId: 'device-A',
        }),
        makeEvent({
          id: 'e-pump',
          type: 'PumpReplaced',
          payload: {
            pumpId: 'pump-1',
            name: 'Bleue',
            pumpType: 'rescue',
            totalDoses: 200,
            expiresAtMs: BASE_MS + 60 * 86_400_000,
          },
          occurredAtMs: BASE_MS - 800,
        }),
        makeEvent({
          id: 'e-plan',
          type: 'PlanUpdated',
          payload: {
            planId: 'plan-1',
            pumpId: 'pump-1',
            scheduledHoursUtc: [8, 20],
            startAtMs: BASE_MS - 30 * 86_400_000,
            endAtMs: null,
          },
          occurredAtMs: BASE_MS - 700,
        }),
        makeEvent({
          id: 'e-cg-inv',
          type: 'CaregiverInvited',
          payload: { caregiverId: 'cg-1', role: 'admin', displayName: 'Sophie' },
          occurredAtMs: BASE_MS - 600,
        }),
        makeEvent({
          id: 'e-dose',
          type: 'DoseAdministered',
          payload: {
            doseId: 'dose-1',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE_MS - 100,
            doseType: 'rescue',
            dosesAdministered: 2,
            symptoms: ['cough'],
            circumstances: ['exercise'],
            freeFormTag: 'Note libre privée',
          },
          occurredAtMs: BASE_MS - 100,
          deviceId: 'device-A',
        }),
      ],
    };

    const out = serializeDocForExport(doc, BASE_MS);

    expect(out.child).toEqual({
      childId: 'child-1',
      firstName: 'Léa',
      birthYear: 2020,
      recordedByDeviceId: 'device-A',
      recordedAtMs: BASE_MS - 1000,
    });
    expect(out.pumps).toHaveLength(1);
    expect(out.pumps[0]?.name).toBe('Bleue');
    expect(out.plans).toHaveLength(1);
    expect(out.plans[0]?.scheduledHoursUtc).toEqual([8, 20]);
    expect(out.caregivers).toHaveLength(1);
    expect(out.caregivers[0]?.displayName).toBe('Sophie');
    expect(out.doses).toHaveLength(1);
    expect(out.doses[0]?.freeFormTag).toBe('Note libre privée');
  });

  it('inclut explicitement freeFormTag (contraste avec rapport médecin RM8)', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'e-dose',
          type: 'DoseAdministered',
          payload: {
            doseId: 'dose-1',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE_MS,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: "Note de l'aidant : reste à l'école aujourd'hui",
          },
          occurredAtMs: BASE_MS,
        }),
      ],
    };

    const out = serializeDocForExport(doc, BASE_MS);
    expect(out.doses[0]?.freeFormTag).toBe("Note de l'aidant : reste à l'école aujourd'hui");
  });

  it('trie les caregivers par caregiverId pour la reproductibilité', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'e1',
          type: 'CaregiverInvited',
          payload: { caregiverId: 'cg-zebra', role: 'admin', displayName: 'Zoé' },
          occurredAtMs: BASE_MS - 1000,
        }),
        makeEvent({
          id: 'e2',
          type: 'CaregiverInvited',
          payload: { caregiverId: 'cg-alpha', role: 'contributor', displayName: 'Alex' },
          occurredAtMs: BASE_MS - 500,
        }),
      ],
    };

    const out = serializeDocForExport(doc, BASE_MS);
    expect(out.caregivers.map((c) => c.caregiverId)).toEqual(['cg-alpha', 'cg-zebra']);
  });

  it('trie les doses par administeredAtMs ascendant puis doseId', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'e1',
          type: 'DoseAdministered',
          payload: {
            doseId: 'dose-z',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE_MS,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
          occurredAtMs: BASE_MS,
        }),
        makeEvent({
          id: 'e2',
          type: 'DoseAdministered',
          payload: {
            doseId: 'dose-a',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE_MS - 1000,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
          occurredAtMs: BASE_MS - 1000,
        }),
        makeEvent({
          id: 'e3',
          type: 'DoseAdministered',
          payload: {
            doseId: 'dose-b',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE_MS,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
          occurredAtMs: BASE_MS,
        }),
      ],
    };

    const out = serializeDocForExport(doc, BASE_MS);
    expect(out.doses.map((d) => d.doseId)).toEqual(['dose-a', 'dose-b', 'dose-z']);
  });

  it('est déterministe — même doc → même sortie (clé de la reproductibilité du hash)', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'e1',
          type: 'DoseAdministered',
          payload: {
            doseId: 'dose-1',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE_MS,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: ['cough', 'wheezing'],
            circumstances: ['exercise'],
            freeFormTag: null,
          },
          occurredAtMs: BASE_MS,
        }),
      ],
    };

    const a = serializeDocForExport(doc, BASE_MS);
    const b = serializeDocForExport(doc, BASE_MS);
    expect(canonicalJsonStringify(a)).toBe(canonicalJsonStringify(b));
  });

  it('produit un JSON canonique avec clés triées par ordre alphabétique', () => {
    const out = canonicalJsonStringify({ z: 1, a: 2, m: { y: 3, x: 4 } });
    // Les clés sont triées (a, m, z) et l'objet imbriqué aussi (x, y)
    expect(out).toBe('{\n  "a": 2,\n  "m": {\n    "x": 4,\n    "y": 3\n  },\n  "z": 1\n}\n');
  });

  it('sérialisation déterministe — la chaîne hashée est identique à chaque appel', () => {
    const obj = { foo: { bar: [1, 2, 3], baz: 'test' } };
    expect(canonicalJsonStringify(obj)).toBe(canonicalJsonStringify(obj));
  });
});
