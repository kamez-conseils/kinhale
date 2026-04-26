import { describe, it, expect } from 'vitest';
import { projectDoses } from '../../projections/doses.js';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import type {
  DoseAdministeredPayload,
  DoseEditedPayload,
  DoseVoidedPayload,
} from '../../events/types.js';

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

  // ---------------------------------------------------------------------------
  // Statut — RM6 DoseReviewFlagged (KIN-73 / E7-S03).
  // ---------------------------------------------------------------------------

  it("expose un statut 'recorded' par défaut (aucun flag)", () => {
    const d = dose({ doseId: 'dose-1' });
    const result = projectDoses(makeDoc([{ payload: d }]));
    expect(result[0]?.status).toBe('recorded');
  });

  it("marque les deux doses d'une paire DoseReviewFlagged comme 'pending_review'", () => {
    const d1 = dose({ doseId: 'dose-A', administeredAtMs: 1_000 });
    const d2 = dose({ doseId: 'dose-B', administeredAtMs: 1_060_000 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'evt-1',
          type: 'DoseAdministered',
          payloadJson: JSON.stringify(d1),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1_000,
        },
        {
          id: 'evt-2',
          type: 'DoseAdministered',
          payloadJson: JSON.stringify(d2),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1_060_000,
        },
        {
          id: 'evt-flag',
          type: 'DoseReviewFlagged',
          payloadJson: JSON.stringify({
            flagId: 'flag-1',
            doseIds: ['dose-A', 'dose-B'],
            detectedAtMs: 1_060_000,
          }),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1_060_100,
        },
      ],
    };
    const result = projectDoses(doc);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === 'pending_review')).toBe(true);
  });

  it("conserve 'recorded' pour une dose non référencée par un flag", () => {
    const flagged = dose({ doseId: 'dose-flagged' });
    const normal = dose({ doseId: 'dose-normal', administeredAtMs: 2_000 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'evt-1',
          type: 'DoseAdministered',
          payloadJson: JSON.stringify(flagged),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1_000,
        },
        {
          id: 'evt-2',
          type: 'DoseAdministered',
          payloadJson: JSON.stringify(normal),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 2_000,
        },
        {
          id: 'evt-flag',
          type: 'DoseReviewFlagged',
          payloadJson: JSON.stringify({
            flagId: 'flag-1',
            doseIds: ['dose-flagged', 'dose-other'],
            detectedAtMs: 2_500,
          }),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 2_500,
        },
      ],
    };
    const result = projectDoses(doc);
    const flaggedDose = result.find((r) => r.doseId === 'dose-flagged');
    const normalDose = result.find((r) => r.doseId === 'dose-normal');
    expect(flaggedDose?.status).toBe('pending_review');
    expect(normalDose?.status).toBe('recorded');
  });

  it('ignore un DoseReviewFlagged avec JSON invalide', () => {
    const d = dose({ doseId: 'dose-1' });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        {
          id: 'evt-1',
          type: 'DoseAdministered',
          payloadJson: JSON.stringify(d),
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 1_000,
        },
        {
          id: 'evt-flag',
          type: 'DoseReviewFlagged',
          payloadJson: 'garbage{{{',
          signerPublicKeyHex: 'a'.repeat(64),
          signatureHex: 'b'.repeat(128),
          deviceId: 'dev-1',
          occurredAtMs: 2_000,
        },
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.status).toBe('recorded');
  });

  // ---------------------------------------------------------------------------
  // Édition — DoseEdited (KIN-094 / E4-S06).
  // ---------------------------------------------------------------------------

  const sigEnvelope = {
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
  } as const;

  const editEvent = (
    payload: DoseEditedPayload,
    overrides: Partial<SignedEventRecord> = {},
  ): SignedEventRecord => ({
    id: `evt-edit-${payload.doseId}`,
    type: 'DoseEdited',
    payloadJson: JSON.stringify(payload),
    occurredAtMs: payload.editedAtMs,
    ...sigEnvelope,
    ...overrides,
  });

  const voidEvent = (
    payload: DoseVoidedPayload,
    overrides: Partial<SignedEventRecord> = {},
  ): SignedEventRecord => ({
    id: `evt-void-${payload.doseId}`,
    type: 'DoseVoided',
    payloadJson: JSON.stringify(payload),
    occurredAtMs: payload.voidedAtMs,
    ...sigEnvelope,
    ...overrides,
  });

  const doseEvent = (
    payload: DoseAdministeredPayload,
    occurredAtMs = payload.administeredAtMs,
  ): SignedEventRecord => ({
    id: `evt-${payload.doseId}`,
    type: 'DoseAdministered',
    payloadJson: JSON.stringify(payload),
    occurredAtMs,
    ...sigEnvelope,
  });

  it('applique un DoseEdited en patchant les champs déclarés', () => {
    const d = dose({ doseId: 'dose-1', dosesAdministered: 1, symptoms: ['cough'] });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        editEvent({
          doseId: 'dose-1',
          patch: { dosesAdministered: 2, symptoms: ['wheezing'], administeredAtMs: 9_000_000 },
          editedByDeviceId: 'dev-1',
          editedAtMs: 1_500_000,
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result).toHaveLength(1);
    expect(result[0]?.dosesAdministered).toBe(2);
    expect(result[0]?.symptoms).toEqual(['wheezing']);
    expect(result[0]?.administeredAtMs).toBe(9_000_000);
    // L'eventId reste celui du DoseAdministered original (audit trail intact).
    expect(result[0]?.eventId).toBe('evt-dose-1');
    expect(result[0]?.status).toBe('recorded');
  });

  it("préserve les champs non patchés et conserve l'eventId d'origine", () => {
    const d = dose({
      doseId: 'dose-1',
      dosesAdministered: 1,
      symptoms: ['cough'],
      circumstances: ['exercise'],
    });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        editEvent({
          doseId: 'dose-1',
          patch: { dosesAdministered: 3 },
          editedByDeviceId: 'dev-1',
          editedAtMs: 1_500_000,
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.dosesAdministered).toBe(3);
    expect(result[0]?.symptoms).toEqual(['cough']);
    expect(result[0]?.circumstances).toEqual(['exercise']);
  });

  it("cumule plusieurs DoseEdited dans l'ordre du log (dernier patch gagne par champ)", () => {
    const d = dose({ doseId: 'dose-1', dosesAdministered: 1, symptoms: [] });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        editEvent(
          {
            doseId: 'dose-1',
            patch: { dosesAdministered: 2 },
            editedByDeviceId: 'dev-1',
            editedAtMs: 1_100_000,
          },
          { id: 'edit-A' },
        ),
        editEvent(
          {
            doseId: 'dose-1',
            patch: { dosesAdministered: 5, symptoms: ['cough'] },
            editedByDeviceId: 'dev-1',
            editedAtMs: 1_200_000,
          },
          { id: 'edit-B' },
        ),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.dosesAdministered).toBe(5);
    expect(result[0]?.symptoms).toEqual(['cough']);
  });

  it('ignore un DoseEdited référant un doseId inconnu', () => {
    const d = dose({ doseId: 'dose-1' });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        editEvent({
          doseId: 'dose-ZZZ',
          patch: { dosesAdministered: 99 },
          editedByDeviceId: 'dev-1',
          editedAtMs: 1_500_000,
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result).toHaveLength(1);
    expect(result[0]?.dosesAdministered).toBe(1);
  });

  it('ignore un DoseEdited avec JSON invalide ou patch vide', () => {
    const d = dose({ doseId: 'dose-1', dosesAdministered: 1 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        {
          id: 'edit-bad-json',
          type: 'DoseEdited',
          payloadJson: 'not-json{{{',
          ...sigEnvelope,
          occurredAtMs: 1_500_000,
        },
        editEvent({
          doseId: 'dose-1',
          patch: {},
          editedByDeviceId: 'dev-1',
          editedAtMs: 1_500_000,
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.dosesAdministered).toBe(1);
  });

  it('ignore les valeurs invalides dans un patch (NaN, types erronés)', () => {
    const d = dose({ doseId: 'dose-1', dosesAdministered: 2 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        {
          id: 'edit-1',
          type: 'DoseEdited',
          payloadJson: JSON.stringify({
            doseId: 'dose-1',
            patch: {
              dosesAdministered: -1, // négatif → rejeté
              symptoms: ['ok', 42], // tableau hétérogène → rejeté
              administeredAtMs: 'not-a-number', // type erroné → rejeté
            },
            editedByDeviceId: 'dev-1',
            editedAtMs: 1_500_000,
          }),
          ...sigEnvelope,
          occurredAtMs: 1_500_000,
        },
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.dosesAdministered).toBe(2);
    expect(result[0]?.symptoms).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Annulation — DoseVoided (KIN-094 / E4-S07).
  // ---------------------------------------------------------------------------

  it("marque la dose en 'voided' et expose voidedReason / voidedByDeviceId / voidedAtMs", () => {
    const d = dose({ doseId: 'dose-1' });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        voidEvent({
          doseId: 'dose-1',
          voidedByDeviceId: 'dev-2',
          voidedAtMs: 5_000_000,
          voidedReason: 'mauvaise pompe',
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.status).toBe('voided');
    expect(result[0]?.voidedReason).toBe('mauvaise pompe');
    expect(result[0]?.voidedByDeviceId).toBe('dev-2');
    expect(result[0]?.voidedAtMs).toBe(5_000_000);
  });

  it('void prévaut strictement sur pending_review et libère la dose conservée (E4-S05)', () => {
    // AC E4-S05 : « La prise conservée repasse à status='recorded' ».
    // Quand A est voidée (résolution doublon) et B est seule dans la paire,
    // B doit redescendre de pending_review vers recorded.
    const d1 = dose({ doseId: 'dose-A', administeredAtMs: 1_000 });
    const d2 = dose({ doseId: 'dose-B', administeredAtMs: 2_000 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d1),
        doseEvent(d2),
        {
          id: 'flag-1',
          type: 'DoseReviewFlagged',
          payloadJson: JSON.stringify({
            flagId: 'f-1',
            doseIds: ['dose-A', 'dose-B'],
            detectedAtMs: 2_500,
          }),
          ...sigEnvelope,
          occurredAtMs: 2_500,
        },
        voidEvent({
          doseId: 'dose-A',
          voidedByDeviceId: 'dev-1',
          voidedAtMs: 3_000,
          voidedReason: 'duplicate_resolved',
        }),
      ],
    };
    const result = projectDoses(doc);
    const a = result.find((r) => r.doseId === 'dose-A');
    const b = result.find((r) => r.doseId === 'dose-B');
    expect(a?.status).toBe('voided');
    expect(b?.status).toBe('recorded');
  });

  it('flag à 3 doses : les 2 non-voidées restent pending_review', () => {
    // Si la paire conflictuelle a > 2 doses (cas rare) et qu'une seule est
    // voidée, les 2 autres restent flaggées (au moins 2 vivantes en conflit).
    const d1 = dose({ doseId: 'dose-A', administeredAtMs: 1_000 });
    const d2 = dose({ doseId: 'dose-B', administeredAtMs: 1_500 });
    const d3 = dose({ doseId: 'dose-C', administeredAtMs: 2_000 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d1),
        doseEvent(d2),
        doseEvent(d3),
        {
          id: 'flag-1',
          type: 'DoseReviewFlagged',
          payloadJson: JSON.stringify({
            flagId: 'f-1',
            doseIds: ['dose-A', 'dose-B', 'dose-C'],
            detectedAtMs: 2_500,
          }),
          ...sigEnvelope,
          occurredAtMs: 2_500,
        },
        voidEvent({
          doseId: 'dose-A',
          voidedByDeviceId: 'dev-1',
          voidedAtMs: 3_000,
          voidedReason: 'duplicate_resolved',
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result.find((r) => r.doseId === 'dose-A')?.status).toBe('voided');
    expect(result.find((r) => r.doseId === 'dose-B')?.status).toBe('pending_review');
    expect(result.find((r) => r.doseId === 'dose-C')?.status).toBe('pending_review');
  });

  it('idempotence : un second DoseVoided pour la même dose est ignoré', () => {
    const d = dose({ doseId: 'dose-1' });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        voidEvent({
          doseId: 'dose-1',
          voidedByDeviceId: 'dev-1',
          voidedAtMs: 5_000,
          voidedReason: 'première raison',
        }),
        voidEvent(
          {
            doseId: 'dose-1',
            voidedByDeviceId: 'dev-2',
            voidedAtMs: 9_000,
            voidedReason: 'second tentative',
          },
          { id: 'evt-void-second' },
        ),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.voidedReason).toBe('première raison');
    expect(result[0]?.voidedByDeviceId).toBe('dev-1');
    expect(result[0]?.voidedAtMs).toBe(5_000);
  });

  it('rejette un DoseVoided avec voidedReason vide ou trop long', () => {
    const d = dose({ doseId: 'dose-1' });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        voidEvent(
          {
            doseId: 'dose-1',
            voidedByDeviceId: 'dev-1',
            voidedAtMs: 5_000,
            voidedReason: '   ',
          },
          { id: 'evt-void-empty' },
        ),
        voidEvent(
          {
            doseId: 'dose-1',
            voidedByDeviceId: 'dev-1',
            voidedAtMs: 6_000,
            voidedReason: 'x'.repeat(201), // > 200 chars
          },
          { id: 'evt-void-long' },
        ),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.status).toBe('recorded');
    expect(result[0]?.voidedReason).toBeUndefined();
  });

  it('ignore un DoseVoided référant un doseId inconnu (pas de dose fantôme)', () => {
    const d = dose({ doseId: 'dose-1' });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        voidEvent({
          doseId: 'dose-XYZ',
          voidedByDeviceId: 'dev-1',
          voidedAtMs: 5_000,
          voidedReason: 'erreur',
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('recorded');
  });

  it('combine édition + annulation : la projection reflète les patches puis le void', () => {
    const d = dose({ doseId: 'dose-1', dosesAdministered: 1 });
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        doseEvent(d),
        editEvent({
          doseId: 'dose-1',
          patch: { dosesAdministered: 4 },
          editedByDeviceId: 'dev-1',
          editedAtMs: 1_500_000,
        }),
        voidEvent({
          doseId: 'dose-1',
          voidedByDeviceId: 'dev-1',
          voidedAtMs: 1_600_000,
          voidedReason: 'mauvaise saisie',
        }),
      ],
    };
    const result = projectDoses(doc);
    expect(result[0]?.dosesAdministered).toBe(4);
    expect(result[0]?.status).toBe('voided');
  });
});
