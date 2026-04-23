import { describe, it, expect } from 'vitest';
import { projectScheduledReminders } from '../../projections/reminders.js';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import type { DoseAdministeredPayload, PlanUpdatedPayload } from '../../events/types.js';

const HH_ID = 'hh-1';
const PUMP_ID = 'pump-1';
const PLAN_ID = 'plan-1';

const DAY_MS = 24 * 60 * 60 * 1000;

function planEvent(
  overrides: Partial<PlanUpdatedPayload> = {},
  occurredAtMs = 1_000_000,
  id = 'evt-plan',
): SignedEventRecord {
  const payload: PlanUpdatedPayload = {
    planId: PLAN_ID,
    pumpId: PUMP_ID,
    scheduledHoursUtc: [8, 20],
    startAtMs: 0,
    endAtMs: null,
    ...overrides,
  };
  return {
    id,
    type: 'PlanUpdated',
    payloadJson: JSON.stringify(payload),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs,
  };
}

function doseEvent(
  overrides: Partial<DoseAdministeredPayload> = {},
  id = 'evt-dose',
): SignedEventRecord {
  const payload: DoseAdministeredPayload = {
    doseId: 'dose-1',
    pumpId: PUMP_ID,
    childId: 'child-1',
    caregiverId: 'cg-1',
    administeredAtMs: 0,
    doseType: 'maintenance',
    dosesAdministered: 1,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    ...overrides,
  };
  return {
    id,
    type: 'DoseAdministered',
    payloadJson: JSON.stringify(payload),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs: payload.administeredAtMs,
  };
}

function makeDoc(events: SignedEventRecord[]): KinhaleDoc {
  return { householdId: HH_ID, events };
}

describe('projectScheduledReminders', () => {
  const NOW = new Date('2026-04-22T00:00:00.000Z');

  it('retourne un tableau vide pour un doc sans plan', () => {
    const doc = makeDoc([]);
    expect(projectScheduledReminders(doc, NOW)).toEqual([]);
  });

  it('matérialise les créneaux d’un plan simple sur l’horizon par défaut (48 h)', () => {
    // Plan [8, 20] UTC → sur 48 h depuis 2026-04-22T00:00Z :
    // 2026-04-22T08, 2026-04-22T20, 2026-04-23T08, 2026-04-23T20
    const doc = makeDoc([planEvent({ scheduledHoursUtc: [8, 20] })]);
    const result = projectScheduledReminders(doc, NOW);
    expect(result).toHaveLength(4);
    expect(result[0]?.targetAtUtc).toBe('2026-04-22T08:00:00.000Z');
    expect(result[1]?.targetAtUtc).toBe('2026-04-22T20:00:00.000Z');
    expect(result[2]?.targetAtUtc).toBe('2026-04-23T08:00:00.000Z');
    expect(result[3]?.targetAtUtc).toBe('2026-04-23T20:00:00.000Z');
  });

  it('construit la fenêtre [target-5min, target+30min] pour chaque créneau', () => {
    const doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const result = projectScheduledReminders(doc, NOW);
    expect(result).toHaveLength(2); // 2 jours × 1 créneau
    const first = result[0];
    expect(first?.targetAtUtc).toBe('2026-04-22T08:00:00.000Z');
    expect(first?.windowStartUtc).toBe('2026-04-22T07:55:00.000Z');
    expect(first?.windowEndUtc).toBe('2026-04-22T08:30:00.000Z');
    expect(first?.status).toBe('scheduled');
    expect(first?.planId).toBe(PLAN_ID);
  });

  it('id déterministe : identique à entrée égale (idempotence)', () => {
    const doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const a = projectScheduledReminders(doc, NOW);
    const b = projectScheduledReminders(doc, NOW);
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(a[0]?.id).toBeDefined();
    expect(a[0]?.id).not.toBe('');
  });

  it('tri par targetAtUtc croissant', () => {
    // Ordre des heures intentionnellement inversé dans le plan.
    const doc = makeDoc([planEvent({ scheduledHoursUtc: [20, 8] })]);
    const result = projectScheduledReminders(doc, NOW);
    const targets = result.map((r) => r.targetAtUtc);
    const sorted = [...targets].sort();
    expect(targets).toEqual(sorted);
  });

  it('filtre les créneaux passés (antérieurs à now)', () => {
    // now = 10:00 → les créneaux 8h du jour courant ne doivent pas sortir.
    const now = new Date('2026-04-22T10:00:00.000Z');
    const doc = makeDoc([planEvent({ scheduledHoursUtc: [8, 20] })]);
    const result = projectScheduledReminders(doc, now);
    const targets = result.map((r) => r.targetAtUtc);
    // L'index 2026-04-22T08 doit être exclu.
    expect(targets).not.toContain('2026-04-22T08:00:00.000Z');
    // 20h du jour présent et 8/20h du lendemain restent.
    expect(targets).toContain('2026-04-22T20:00:00.000Z');
    expect(targets).toContain('2026-04-23T08:00:00.000Z');
  });

  it('respecte un horizonMs personnalisé (24 h)', () => {
    const doc = makeDoc([planEvent({ scheduledHoursUtc: [8, 20] })]);
    const result = projectScheduledReminders(doc, NOW, DAY_MS);
    // Sur 24h depuis 2026-04-22T00Z : 08:00 + 20:00 = 2 créneaux.
    expect(result).toHaveLength(2);
  });

  it('exclut un créneau déjà confirmé par une dose dans la fenêtre', () => {
    const doc = makeDoc([
      planEvent({ scheduledHoursUtc: [8, 20] }),
      doseEvent({
        doseId: 'dose-confirm',
        administeredAtMs: new Date('2026-04-22T08:05:00.000Z').getTime(),
        doseType: 'maintenance',
      }),
    ]);
    const result = projectScheduledReminders(doc, NOW);
    const targets = result.map((r) => r.targetAtUtc);
    expect(targets).not.toContain('2026-04-22T08:00:00.000Z');
  });

  it('ne confirme que les doses maintenance (les rescue sont ignorées)', () => {
    const doc = makeDoc([
      planEvent({ scheduledHoursUtc: [8] }),
      doseEvent({
        doseId: 'dose-rescue',
        administeredAtMs: new Date('2026-04-22T08:05:00.000Z').getTime(),
        doseType: 'rescue',
      }),
    ]);
    const result = projectScheduledReminders(doc, NOW);
    expect(result.map((r) => r.targetAtUtc)).toContain('2026-04-22T08:00:00.000Z');
  });

  it('retourne [] si endAtMs du plan est antérieur à now', () => {
    const doc = makeDoc([
      planEvent({
        scheduledHoursUtc: [8, 20],
        startAtMs: 0,
        endAtMs: new Date('2026-04-21T23:00:00.000Z').getTime(),
      }),
    ]);
    expect(projectScheduledReminders(doc, NOW)).toEqual([]);
  });

  it('retient le dernier PlanUpdated en cas de multiples', () => {
    const older = planEvent({ scheduledHoursUtc: [6] }, 1_000, 'evt-old');
    const newer = planEvent({ scheduledHoursUtc: [8, 20] }, 2_000, 'evt-new');
    const doc = makeDoc([older, newer]);
    const result = projectScheduledReminders(doc, NOW);
    // Les créneaux doivent être issus du PLUS RÉCENT plan (8, 20), pas [6].
    const hours = new Set(result.map((r) => r.targetAtUtc.slice(11, 13)));
    expect(hours).toEqual(new Set(['08', '20']));
  });

  it('tolère une dose confirmée attachée à une autre pompe (ne confirme pas)', () => {
    const doc = makeDoc([
      planEvent({ scheduledHoursUtc: [8], pumpId: PUMP_ID }),
      doseEvent({
        doseId: 'dose-other',
        pumpId: 'other-pump',
        administeredAtMs: new Date('2026-04-22T08:05:00.000Z').getTime(),
        doseType: 'maintenance',
      }),
    ]);
    const result = projectScheduledReminders(doc, NOW);
    expect(result.map((r) => r.targetAtUtc)).toContain('2026-04-22T08:00:00.000Z');
  });
});
