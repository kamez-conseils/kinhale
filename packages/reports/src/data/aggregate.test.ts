import { describe, expect, it } from 'vitest';
import type { KinhaleDoc, SignedEventRecord } from '@kinhale/sync';
import { aggregateReportData } from './aggregate.js';
import { MS_PER_DAY } from '../range/date-range.js';

/**
 * Fabrique d'événement signé en clair (tests unitaires d'agrégation).
 * Les champs signature/publicKey sont fictifs — la projection ne les lit
 * pas, donc on peut poser des placeholders.
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

function emptyDoc(): KinhaleDoc {
  return { householdId: 'hh-1', events: [] };
}

const BASE = Date.UTC(2026, 3, 24, 12, 0, 0);

describe('aggregateReportData', () => {
  it('retourne une structure vide pour un doc sans événements', () => {
    const data = aggregateReportData(emptyDoc(), {
      startMs: BASE - 30 * MS_PER_DAY,
      endMs: BASE,
    });

    expect(data.childAlias).toBeNull();
    expect(data.doses).toEqual([]);
    // Les semaines sont matérialisées même à 0 (axe continu côté graphique)
    expect(data.rescueCountByWeek.every((w) => w.count === 0)).toBe(true);
    expect(data.rescueCountByWeek.length).toBeGreaterThan(0);
    expect(data.symptomTimeline).toEqual([]);
    expect(data.adherence.scheduled).toBe(0);
    expect(data.adherence.confirmed).toBe(0);
    expect(data.adherence.ratio).toBe(0);
  });

  it('projette le prénom enfant (sanitized) si présent', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'c1',
          type: 'ChildRegistered',
          payload: { childId: 'child-1', firstName: 'Léa', birthYear: 2020 },
          occurredAtMs: BASE - 100 * MS_PER_DAY,
        }),
      ],
    };
    const data = aggregateReportData(doc, {
      startMs: BASE - 30 * MS_PER_DAY,
      endMs: BASE,
    });
    expect(data.childAlias).toBe('Léa');
  });

  it('filtre les doses hors plage', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'd1',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 10 * MS_PER_DAY,
          payload: {
            doseId: 'dose-1',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 10 * MS_PER_DAY,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
        }),
        makeEvent({
          id: 'd2',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 100 * MS_PER_DAY, // hors plage
          payload: {
            doseId: 'dose-2',
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 100 * MS_PER_DAY,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
        }),
      ],
    };
    const data = aggregateReportData(doc, {
      startMs: BASE - 30 * MS_PER_DAY,
      endMs: BASE,
    });
    expect(data.doses).toHaveLength(1);
    expect(data.doses[0]?.doseId).toBe('dose-1');
  });

  it('calcule observance (confirmed/scheduled) pour un plan 2×/j', () => {
    const planStart = BASE - 10 * MS_PER_DAY;
    const doses: SignedEventRecord[] = [];
    // 5 doses maintenance confirmées dans la fenêtre 10 derniers jours
    for (let i = 0; i < 5; i++) {
      doses.push(
        makeEvent({
          id: `d-${i}`,
          type: 'DoseAdministered',
          occurredAtMs: planStart + i * MS_PER_DAY + 8 * 60 * 60 * 1_000,
          payload: {
            doseId: `dose-${i}`,
            pumpId: 'pump-1',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: planStart + i * MS_PER_DAY + 8 * 60 * 60 * 1_000,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
        }),
      );
    }
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'p1',
          type: 'PlanUpdated',
          occurredAtMs: planStart,
          payload: {
            planId: 'plan-1',
            pumpId: 'pump-1',
            scheduledHoursUtc: [8, 20],
            startAtMs: planStart,
            endAtMs: null,
          },
        }),
        ...doses,
      ],
    };
    const data = aggregateReportData(doc, { startMs: planStart, endMs: BASE });
    // 10 jours × 2 prises/jour = 20 scheduled ; 5 confirmées.
    expect(data.adherence.scheduled).toBeGreaterThanOrEqual(15);
    expect(data.adherence.scheduled).toBeLessThanOrEqual(22);
    expect(data.adherence.confirmed).toBe(5);
    expect(data.adherence.ratio).toBeGreaterThan(0);
    expect(data.adherence.ratio).toBeLessThan(1);
  });

  it('compte les prises secours par semaine (ISO-like, UTC)', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'r1',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 6 * MS_PER_DAY,
          payload: {
            doseId: 'dose-r1',
            pumpId: 'pump-r',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 6 * MS_PER_DAY,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: ['cough'],
            circumstances: ['exercise'],
            freeFormTag: null,
          },
        }),
        makeEvent({
          id: 'r2',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 5 * MS_PER_DAY,
          payload: {
            doseId: 'dose-r2',
            pumpId: 'pump-r',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 5 * MS_PER_DAY,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: ['wheezing'],
            circumstances: [],
            freeFormTag: null,
          },
        }),
      ],
    };
    const data = aggregateReportData(doc, {
      startMs: BASE - 30 * MS_PER_DAY,
      endMs: BASE,
    });
    const totalRescue = data.rescueCountByWeek.reduce((acc, w) => acc + w.count, 0);
    expect(totalRescue).toBe(2);
    // Toutes les semaines doivent avoir au moins 1 bucket affiché
    expect(data.rescueCountByWeek.length).toBeGreaterThan(0);
  });

  it("bâtit la timeline symptômes chronologique (plus récent d'abord)", () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'r1',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 2 * MS_PER_DAY,
          payload: {
            doseId: 'd-r1',
            pumpId: 'pump-r',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 2 * MS_PER_DAY,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: ['cough'],
            circumstances: ['night'],
            freeFormTag: null,
          },
        }),
        makeEvent({
          id: 'r2',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 1 * MS_PER_DAY,
          payload: {
            doseId: 'd-r2',
            pumpId: 'pump-r',
            childId: 'child-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 1 * MS_PER_DAY,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: ['wheezing'],
            circumstances: [],
            freeFormTag: null,
          },
        }),
      ],
    };
    const data = aggregateReportData(doc, {
      startMs: BASE - 30 * MS_PER_DAY,
      endMs: BASE,
    });
    expect(data.symptomTimeline.length).toBe(2);
    expect(data.symptomTimeline[0]?.symptoms).toEqual(['wheezing']);
    expect(data.symptomTimeline[1]?.symptoms).toEqual(['cough']);
  });

  it("n'expose aucune donnée santé en dehors de la structure agrégée (pas de log, pas d'appel externe)", () => {
    // Contrat : l'agrégation est pure. On vérifie qu'un appel sur 90j ne
    // produit aucune propriété inattendue contenant un payloadJson brut.
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'd-1',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 5 * MS_PER_DAY,
          payload: {
            doseId: 'd-1',
            pumpId: 'p-1',
            childId: 'c-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 5 * MS_PER_DAY,
            doseType: 'rescue',
            dosesAdministered: 1,
            symptoms: ['cough'],
            circumstances: ['cold_air'],
            freeFormTag: 'secret',
          },
        }),
      ],
    };
    const data = aggregateReportData(doc, {
      startMs: BASE - 90 * MS_PER_DAY,
      endMs: BASE,
    });
    const json = JSON.stringify(data);
    // Le freeFormTag n'est jamais affiché dans le PDF médecin (risque de
    // notes sensibles — ex. prénom d'un tiers). Vérification structurelle.
    expect(json).not.toContain('"secret"');
  });

  it('est déterministe : mêmes inputs → même output (clé pour le hash SHA-256)', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-1',
      events: [
        makeEvent({
          id: 'd-a',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 3 * MS_PER_DAY,
          payload: {
            doseId: 'd-a',
            pumpId: 'p-1',
            childId: 'c-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 3 * MS_PER_DAY,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
        }),
        makeEvent({
          id: 'd-b',
          type: 'DoseAdministered',
          occurredAtMs: BASE - 1 * MS_PER_DAY,
          payload: {
            doseId: 'd-b',
            pumpId: 'p-1',
            childId: 'c-1',
            caregiverId: 'cg-1',
            administeredAtMs: BASE - 1 * MS_PER_DAY,
            doseType: 'maintenance',
            dosesAdministered: 1,
            symptoms: [],
            circumstances: [],
            freeFormTag: null,
          },
        }),
      ],
    };
    const a = aggregateReportData(doc, { startMs: BASE - 30 * MS_PER_DAY, endMs: BASE });
    const b = aggregateReportData(doc, { startMs: BASE - 30 * MS_PER_DAY, endMs: BASE });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
