import { describe, expect, it } from 'vitest';
import type { Dose } from '../entities/dose';
import type { Pump, PumpStatus } from '../entities/pump';
import {
  decideOfflineReadAccess,
  decideOfflineWriteAccess,
  filterDosesAvailableOffline,
  OFFLINE_READ_WINDOW_DAYS,
} from './rm20-offline-access';

const NOW = new Date('2026-04-19T12:00:00Z');
const ONE_DAY_MS = 86_400_000;

function offsetDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * ONE_DAY_MS);
}

function makePump(overrides: Partial<Pump> = {}): Pump {
  return {
    id: 'pump-1',
    householdId: 'h1',
    type: 'maintenance',
    status: 'active',
    label: 'Flovent HFA 125',
    dosesRemaining: 50,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeDose(overrides: Partial<Dose> = {}): Dose {
  return {
    id: 'dose-1',
    householdId: 'h1',
    childId: 'c1',
    pumpId: 'pump-1',
    caregiverId: 'u1',
    type: 'maintenance',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: NOW,
    recordedAtUtc: NOW,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
    ...overrides,
  };
}

describe('RM20 — constante', () => {
  it('expose la fenêtre offline de 30 jours', () => {
    expect(OFFLINE_READ_WINDOW_DAYS).toBe(30);
  });
});

describe('RM20 — decideOfflineReadAccess', () => {
  it('accepte une prise récente (1 jour)', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: offsetDays(NOW, -1),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('available_offline');
    expect(decision.ageDays).toBe(1);
  });

  it('accepte une prise à 29 jours', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: offsetDays(NOW, -29),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('available_offline');
    expect(decision.ageDays).toBe(29);
  });

  it('accepte une prise à 30 jours pile (borne inclusive)', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: offsetDays(NOW, -30),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('available_offline');
    expect(decision.ageDays).toBe(30);
  });

  it('refuse une prise à 31 jours', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: offsetDays(NOW, -31),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('requires_network');
    expect(decision.ageDays).toBe(31);
  });

  it('clampe l age à 0 pour une prise future (sync tardive)', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: offsetDays(NOW, 2),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('available_offline');
    expect(decision.ageDays).toBe(0);
  });

  it('age de 0 quand la prise est à l instant nowUtc', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: NOW,
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('available_offline');
    expect(decision.ageDays).toBe(0);
  });

  it('arrondit à la journée pleine inférieure (12 h = jour 0)', () => {
    const decision = decideOfflineReadAccess({
      doseRecordedAtUtc: new Date(NOW.getTime() - 12 * 60 * 60_000),
      nowUtc: NOW,
    });
    expect(decision.kind).toBe('available_offline');
    expect(decision.ageDays).toBe(0);
  });
});

describe('RM20 — filterDosesAvailableOffline', () => {
  it('retourne un tableau vide pour une liste vide', () => {
    const result = filterDosesAvailableOffline([], NOW);
    expect(result).toEqual([]);
  });

  it('garde uniquement les prises des 30 derniers jours, ordre préservé', () => {
    const recent = makeDose({ id: 'd-recent', recordedAtUtc: offsetDays(NOW, -5) });
    const edge = makeDose({ id: 'd-edge', recordedAtUtc: offsetDays(NOW, -30) });
    const tooOld = makeDose({ id: 'd-old', recordedAtUtc: offsetDays(NOW, -31) });
    const veryOld = makeDose({ id: 'd-very-old', recordedAtUtc: offsetDays(NOW, -120) });

    const result = filterDosesAvailableOffline([recent, edge, tooOld, veryOld], NOW);
    expect(result.map((d) => d.id)).toEqual(['d-recent', 'd-edge']);
  });

  it('inclut une prise sans recordedAtUtc (retombe sur administeredAtUtc)', () => {
    const dose = makeDose({
      id: 'd-offline',
      recordedAtUtc: null,
      administeredAtUtc: offsetDays(NOW, -2),
    });
    const result = filterDosesAvailableOffline([dose], NOW);
    expect(result.map((d) => d.id)).toEqual(['d-offline']);
  });

  it('ne mute pas l input (pureté)', () => {
    const doses: readonly Dose[] = [
      makeDose({ id: 'd1', recordedAtUtc: offsetDays(NOW, -1) }),
      makeDose({ id: 'd2', recordedAtUtc: offsetDays(NOW, -60) }),
    ];
    const snapshot = JSON.stringify(doses);
    filterDosesAvailableOffline(doses, NOW);
    expect(JSON.stringify(doses)).toBe(snapshot);
  });
});

describe('RM20 — decideOfflineWriteAccess', () => {
  it('autorise la saisie sur une pompe active', () => {
    const pump = makePump({ status: 'active' });
    const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(decision.kind).toBe('allowed');
  });

  it('autorise la saisie sur une pompe low', () => {
    const pump = makePump({ status: 'low' });
    const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(decision.kind).toBe('allowed');
  });

  it('refuse la saisie sur une pompe expired sans override', () => {
    const pump = makePump({
      status: 'expired',
      expiresAt: offsetDays(NOW, -1),
    });
    const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(decision.kind).toBe('refused');
    if (decision.kind === 'refused') {
      expect(decision.reason).toBe('pump_not_usable');
    }
  });

  it('autorise la saisie sur une pompe expired avec override Admin justifié', () => {
    const pump = makePump({
      status: 'expired',
      expiresAt: offsetDays(NOW, -1),
    });
    const decision = decideOfflineWriteAccess({
      pump,
      nowUtc: NOW,
      adminForcedJustification: 'ordonnance renouvelée en attente',
    });
    expect(decision.kind).toBe('allowed');
  });

  it('refuse la saisie avec justification whitespace (vide)', () => {
    const pump = makePump({
      status: 'expired',
      expiresAt: offsetDays(NOW, -1),
    });
    const decision = decideOfflineWriteAccess({
      pump,
      nowUtc: NOW,
      adminForcedJustification: '   ',
    });
    expect(decision.kind).toBe('refused');
  });

  it('refuse la saisie sur une pompe empty', () => {
    const pump = makePump({ status: 'empty', dosesRemaining: 0 });
    const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(decision.kind).toBe('refused');
    if (decision.kind === 'refused') {
      expect(decision.reason).toBe('pump_not_usable');
    }
  });

  it('refuse la saisie sur une pompe archived', () => {
    const pump = makePump({ status: 'archived' });
    const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(decision.kind).toBe('refused');
  });

  it('refuse la saisie sur une pompe expired par date même si status=active (cohérence RM19)', () => {
    const pump = makePump({
      status: 'active',
      expiresAt: offsetDays(NOW, -5),
    });
    const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(decision.kind).toBe('refused');
  });

  it('pureté : ne mute pas la pompe', () => {
    const pump = makePump({ status: 'active' });
    const snapshot = { ...pump };
    decideOfflineWriteAccess({ pump, nowUtc: NOW });
    expect(pump).toEqual(snapshot);
  });

  it('cases exhaustifs : chaque PumpStatus produit une décision', () => {
    const statuses: PumpStatus[] = ['active', 'low', 'empty', 'expired', 'archived'];
    for (const status of statuses) {
      const pump = makePump({ status });
      const decision = decideOfflineWriteAccess({ pump, nowUtc: NOW });
      expect(['allowed', 'refused']).toContain(decision.kind);
    }
  });
});
