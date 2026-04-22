import { describe, expect, it } from 'vitest';
import type { Dose } from '../entities/dose';
import { DomainError } from '../errors';
import { buildMedicalReport, type MedicalReport } from './rm8-medical-report';

const HOUSEHOLD_ID = 'h-1';
const CHILD_ID = 'c-1';
const PUMP_MAINTENANCE = 'pump-fond';
const PUMP_RESCUE = 'pump-secours';
const CAREGIVER = 'cg-1';

function makeDose(override: Partial<Dose> = {}): Dose {
  const base: Dose = {
    id: 'd-1',
    householdId: HOUSEHOLD_ID,
    childId: CHILD_ID,
    pumpId: PUMP_MAINTENANCE,
    caregiverId: CAREGIVER,
    type: 'maintenance',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: new Date('2026-04-10T08:00:00Z'),
    recordedAtUtc: new Date('2026-04-10T08:00:01Z'),
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
  };
  return { ...base, ...override };
}

function defaultPeriod(): { fromUtc: Date; toUtc: Date } {
  return {
    fromUtc: new Date('2026-04-01T00:00:00Z'),
    toUtc: new Date('2026-04-30T23:59:59.999Z'),
  };
}

describe('RM8 — buildMedicalReport (chemin nominal)', () => {
  it('rapport vide → structure avec tableaux vides', () => {
    const report = buildMedicalReport({
      doses: [],
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses).toEqual([]);
    expect(report.voidedDoses).toEqual([]);
    expect(report.rescueFrequencyByWeek).toEqual([]);
    expect(report.symptomsEncountered).toEqual([]);
    expect(report.circumstancesEncountered).toEqual([]);
    expect(report.childFirstName).toBe('Mia');
    expect(report.childYearOfBirth).toBe(2020);
    expect(report.period.fromUtc).toEqual(new Date('2026-04-01T00:00:00Z'));
    expect(report.period.toUtc).toEqual(new Date('2026-04-30T23:59:59.999Z'));
  });

  it('inclut les 3 prises confirmed de la période', () => {
    const doses = [
      makeDose({
        id: 'd1',
        administeredAtUtc: new Date('2026-04-10T08:00:00Z'),
        dosesAdministered: 1,
      }),
      makeDose({
        id: 'd2',
        administeredAtUtc: new Date('2026-04-12T20:00:00Z'),
        dosesAdministered: 2,
      }),
      makeDose({
        id: 'd3',
        administeredAtUtc: new Date('2026-04-15T09:00:00Z'),
        dosesAdministered: 1,
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses.map((d) => d.doseId)).toEqual(['d1', 'd2', 'd3']);
  });

  it('exclut les prises hors période (avant from, après to)', () => {
    const doses = [
      makeDose({ id: 'before', administeredAtUtc: new Date('2026-03-31T23:59:58Z') }),
      makeDose({ id: 'inRange', administeredAtUtc: new Date('2026-04-10T08:00:00Z') }),
      makeDose({ id: 'after', administeredAtUtc: new Date('2026-05-01T00:00:01Z') }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses.map((d) => d.doseId)).toEqual(['inRange']);
  });

  it('bornes inclusives : fromUtc et toUtc pile sont dans la période', () => {
    const period = defaultPeriod();
    const doses = [
      makeDose({ id: 'onFrom', administeredAtUtc: period.fromUtc }),
      makeDose({ id: 'onTo', administeredAtUtc: period.toUtc }),
    ];

    const report = buildMedicalReport({
      doses,
      period,
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses.map((d) => d.doseId).sort()).toEqual(['onFrom', 'onTo']);
  });

  it('exclut les prises pending_review (pas confirmed)', () => {
    const doses = [
      makeDose({ id: 'confirmed-1' }),
      makeDose({ id: 'pending-1', status: 'pending_review' }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses.map((d) => d.doseId)).toEqual(['confirmed-1']);
  });

  it('prise voidée : exclue de confirmedDoses, incluse dans voidedDoses avec reason', () => {
    const doses = [
      makeDose({ id: 'ok' }),
      makeDose({
        id: 'voided-1',
        status: 'voided',
        voidedReason: 'erreur de saisie',
        administeredAtUtc: new Date('2026-04-14T08:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses.map((d) => d.doseId)).toEqual(['ok']);
    expect(report.voidedDoses).toHaveLength(1);
    const voided = report.voidedDoses[0];
    if (voided === undefined) throw new Error('unreachable');
    expect(voided.doseId).toBe('voided-1');
    expect(voided.voidedReason).toBe('erreur de saisie');
    expect(voided.originalAdministeredAtUtc).toEqual(new Date('2026-04-14T08:00:00Z'));
  });

  it('prise voidée sans reason → voidedReason=null conservé', () => {
    const doses = [
      makeDose({
        id: 'voided-noreason',
        status: 'voided',
        voidedReason: null,
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.voidedDoses).toHaveLength(1);
    const voided = report.voidedDoses[0];
    if (voided === undefined) throw new Error('unreachable');
    expect(voided.voidedReason).toBeNull();
  });

  it('voidedDoses hors période sont exclues aussi', () => {
    const doses = [
      makeDose({
        id: 'voided-outside',
        status: 'voided',
        administeredAtUtc: new Date('2026-03-01T08:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.voidedDoses).toEqual([]);
  });
});

describe('RM8 — ordre chronologique croissant', () => {
  it('confirmedDoses triés par administeredAtUtc croissant même si input désordonné', () => {
    const doses = [
      makeDose({ id: 'mid', administeredAtUtc: new Date('2026-04-15T08:00:00Z') }),
      makeDose({ id: 'early', administeredAtUtc: new Date('2026-04-05T08:00:00Z') }),
      makeDose({ id: 'late', administeredAtUtc: new Date('2026-04-25T08:00:00Z') }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.confirmedDoses.map((d) => d.doseId)).toEqual(['early', 'mid', 'late']);
  });

  it('voidedDoses triés chronologiquement aussi', () => {
    const doses = [
      makeDose({
        id: 'v-late',
        status: 'voided',
        administeredAtUtc: new Date('2026-04-25T08:00:00Z'),
      }),
      makeDose({
        id: 'v-early',
        status: 'voided',
        administeredAtUtc: new Date('2026-04-05T08:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.voidedDoses.map((v) => v.doseId)).toEqual(['v-early', 'v-late']);
  });
});

describe('RM8 — agrégation hebdomadaire secours (semaine ISO, lundi UTC)', () => {
  it("regroupe 3 rescues d'une même semaine en un seul bucket", () => {
    // 2026-04-06 lundi → 2026-04-12 dimanche (semaine ISO 15).
    const doses = [
      makeDose({
        id: 'r1',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-06T10:00:00Z'),
      }),
      makeDose({
        id: 'r2',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-08T15:00:00Z'),
      }),
      makeDose({
        id: 'r3',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-12T23:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.rescueFrequencyByWeek).toHaveLength(1);
    const week = report.rescueFrequencyByWeek[0];
    if (week === undefined) throw new Error('unreachable');
    expect(week.weekStartUtc).toEqual(new Date('2026-04-06T00:00:00.000Z'));
    expect(week.rescueCount).toBe(3);
  });

  it('lundi pile → début de semaine (00:00 UTC)', () => {
    // 2026-04-06 est un lundi.
    const doses = [
      makeDose({
        id: 'monday-00',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-06T00:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    const week = report.rescueFrequencyByWeek[0];
    if (week === undefined) throw new Error('unreachable');
    expect(week.weekStartUtc).toEqual(new Date('2026-04-06T00:00:00.000Z'));
  });

  it('dimanche 23:59 → fin de cette semaine, pas la suivante', () => {
    // 2026-04-12 est un dimanche → semaine du lundi 2026-04-06.
    const doses = [
      makeDose({
        id: 'sunday-end',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-12T23:59:59Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    const week = report.rescueFrequencyByWeek[0];
    if (week === undefined) throw new Error('unreachable');
    expect(week.weekStartUtc).toEqual(new Date('2026-04-06T00:00:00.000Z'));
  });

  it('2 semaines distinctes → 2 buckets triés chronologiquement', () => {
    const doses = [
      makeDose({
        id: 'r-w2',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-20T10:00:00Z'), // semaine 16 (lundi 2026-04-20)
      }),
      makeDose({
        id: 'r-w1',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-07T10:00:00Z'), // semaine 15 (lundi 2026-04-06)
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.rescueFrequencyByWeek).toHaveLength(2);
    expect(report.rescueFrequencyByWeek[0]?.weekStartUtc).toEqual(
      new Date('2026-04-06T00:00:00.000Z'),
    );
    expect(report.rescueFrequencyByWeek[1]?.weekStartUtc).toEqual(
      new Date('2026-04-20T00:00:00.000Z'),
    );
  });

  it("n'inclut pas les prises maintenance dans la fréquence secours", () => {
    const doses = [
      makeDose({
        id: 'maint',
        type: 'maintenance',
        administeredAtUtc: new Date('2026-04-07T10:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.rescueFrequencyByWeek).toEqual([]);
  });

  it("n'inclut pas les rescues voidées/pending dans la fréquence", () => {
    const doses = [
      makeDose({
        id: 'r-confirmed',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        symptoms: ['cough'],
        administeredAtUtc: new Date('2026-04-07T10:00:00Z'),
      }),
      makeDose({
        id: 'r-voided',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        status: 'voided',
        administeredAtUtc: new Date('2026-04-07T11:00:00Z'),
      }),
      makeDose({
        id: 'r-pending',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        status: 'pending_review',
        administeredAtUtc: new Date('2026-04-07T12:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.rescueFrequencyByWeek).toHaveLength(1);
    expect(report.rescueFrequencyByWeek[0]?.rescueCount).toBe(1);
  });
});

describe('RM8 — symptômes / circonstances dé-dupliqués', () => {
  it('symptômes uniques, même ordre que première occurrence', () => {
    const doses = [
      makeDose({
        id: 'r1',
        type: 'rescue',
        symptoms: ['cough', 'wheezing'],
        administeredAtUtc: new Date('2026-04-05T08:00:00Z'),
      }),
      makeDose({
        id: 'r2',
        type: 'rescue',
        symptoms: ['cough', 'shortness_of_breath'],
        administeredAtUtc: new Date('2026-04-10T08:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.symptomsEncountered).toEqual(['cough', 'wheezing', 'shortness_of_breath']);
  });

  it('circonstances uniques, même ordre que première occurrence', () => {
    const doses = [
      makeDose({
        id: 'r1',
        type: 'rescue',
        symptoms: ['cough'],
        circumstances: ['exercise', 'cold_air'],
        administeredAtUtc: new Date('2026-04-05T08:00:00Z'),
      }),
      makeDose({
        id: 'r2',
        type: 'rescue',
        symptoms: ['cough'],
        circumstances: ['exercise', 'allergen'],
        administeredAtUtc: new Date('2026-04-10T08:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.circumstancesEncountered).toEqual(['exercise', 'cold_air', 'allergen']);
  });

  it('ignore les symptômes/circonstances des prises exclues (voidées / hors période)', () => {
    const doses = [
      makeDose({
        id: 'r-voided',
        type: 'rescue',
        status: 'voided',
        symptoms: ['cough'],
        circumstances: ['exercise'],
        administeredAtUtc: new Date('2026-04-05T08:00:00Z'),
      }),
      makeDose({
        id: 'r-out',
        type: 'rescue',
        symptoms: ['wheezing'],
        circumstances: ['night'],
        administeredAtUtc: new Date('2026-05-15T08:00:00Z'), // hors période
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(report.symptomsEncountered).toEqual([]);
    expect(report.circumstancesEncountered).toEqual([]);
  });
});

describe('RM8 — ConfirmedDoseSummary : champs copiés intégralement', () => {
  it('copie type, dosesAdministered, pumpId, symptoms, circumstances, freeFormTag', () => {
    const doses = [
      makeDose({
        id: 'r-detailed',
        type: 'rescue',
        pumpId: PUMP_RESCUE,
        dosesAdministered: 2,
        symptoms: ['cough', 'wheezing'],
        circumstances: ['cold_air'],
        freeFormTag: 'après sport',
        administeredAtUtc: new Date('2026-04-10T08:00:00Z'),
      }),
    ];

    const report = buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    const summary = report.confirmedDoses[0];
    if (summary === undefined) throw new Error('unreachable');
    expect(summary.type).toBe('rescue');
    expect(summary.pumpId).toBe(PUMP_RESCUE);
    expect(summary.dosesAdministered).toBe(2);
    expect(summary.symptoms).toEqual(['cough', 'wheezing']);
    expect(summary.circumstances).toEqual(['cold_air']);
    expect(summary.freeFormTag).toBe('après sport');
    expect(summary.administeredAtUtc).toEqual(new Date('2026-04-10T08:00:00Z'));
  });
});

describe('RM8 — validation enfant', () => {
  it('lève RM8_INVALID_CHILD si prénom vide', () => {
    try {
      buildMedicalReport({
        doses: [],
        period: defaultPeriod(),
        childFirstName: '',
        childYearOfBirth: 2020,
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM8_INVALID_CHILD');
    }
  });

  it('lève RM8_INVALID_CHILD si prénom whitespace-only', () => {
    expect(() =>
      buildMedicalReport({
        doses: [],
        period: defaultPeriod(),
        childFirstName: '   ',
        childYearOfBirth: 2020,
      }),
    ).toThrow(DomainError);
  });

  it('lève RM8_INVALID_CHILD si année < 1900', () => {
    expect(() =>
      buildMedicalReport({
        doses: [],
        period: defaultPeriod(),
        childFirstName: 'Mia',
        childYearOfBirth: 1899,
      }),
    ).toThrow(DomainError);
  });

  it('lève RM8_INVALID_CHILD si année > année de la période (to)', () => {
    expect(() =>
      buildMedicalReport({
        doses: [],
        period: defaultPeriod(),
        childFirstName: 'Mia',
        childYearOfBirth: 2099, // la période est en 2026
      }),
    ).toThrow(DomainError);
  });

  it('accepte une année pile à la borne supérieure (année de period.toUtc)', () => {
    expect(() =>
      buildMedicalReport({
        doses: [],
        period: defaultPeriod(),
        childFirstName: 'Mia',
        childYearOfBirth: 2026,
      }),
    ).not.toThrow();
  });
});

describe('RM8 — validation période', () => {
  it('lève RM8_INVALID_PERIOD si fromUtc > toUtc', () => {
    try {
      buildMedicalReport({
        doses: [],
        period: {
          fromUtc: new Date('2026-05-01T00:00:00Z'),
          toUtc: new Date('2026-04-01T00:00:00Z'),
        },
        childFirstName: 'Mia',
        childYearOfBirth: 2020,
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM8_INVALID_PERIOD');
    }
  });

  it('accepte fromUtc = toUtc (rapport instantané, valide)', () => {
    expect(() =>
      buildMedicalReport({
        doses: [],
        period: {
          fromUtc: new Date('2026-04-15T12:00:00Z'),
          toUtc: new Date('2026-04-15T12:00:00Z'),
        },
        childFirstName: 'Mia',
        childYearOfBirth: 2020,
      }),
    ).not.toThrow();
  });
});

describe('RM8 — pureté (inputs non mutés)', () => {
  it('inputs doses non mutés', () => {
    const doses = [makeDose({ id: 'd1' })];
    const snapshot = JSON.stringify(doses);

    buildMedicalReport({
      doses,
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    expect(JSON.stringify(doses)).toBe(snapshot);
  });
});

describe('RM8 — ligne rouge dispositif médical (type interdit)', () => {
  it('aucun champ recommendation / interpretation / controlScore / diagnosis dans le type', () => {
    const report: MedicalReport = buildMedicalReport({
      doses: [],
      period: defaultPeriod(),
      childFirstName: 'Mia',
      childYearOfBirth: 2020,
    });

    // Cast en Record pour détecter un champ imprévu côté runtime.
    const asRecord = report as unknown as Record<string, unknown>;
    expect(asRecord['recommendation']).toBeUndefined();
    expect(asRecord['interpretation']).toBeUndefined();
    expect(asRecord['controlScore']).toBeUndefined();
    expect(asRecord['diagnosis']).toBeUndefined();
    expect(asRecord['alert']).toBeUndefined();
    expect(asRecord['advice']).toBeUndefined();
  });
});
