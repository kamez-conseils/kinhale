import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  BACKFILL_HORIZON_MINUTES,
  classifyDoseTiming,
  ensureDoseTimingAcceptable,
  MAX_CONFIRMATION_WINDOW_MINUTES,
  MIN_CONFIRMATION_WINDOW_MINUTES,
} from './rm2-confirmation-window';

const TARGET = new Date('2026-04-19T08:00:00Z');
const WINDOW = 30; // minutes

function offsetMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

describe('RM2 — classifyDoseTiming', () => {
  it('on_time quand la prise est exactement à la cible', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: TARGET,
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('on_time');
  });

  it('on_time à la borne basse (target - window)', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, -WINDOW),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('on_time');
  });

  it('on_time à la borne haute (target + window)', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, WINDOW),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('on_time');
  });

  it('too_early juste avant la borne basse', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, -(WINDOW + 1)),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('too_early');
  });

  it('late_backfill juste au-dessus de la borne haute', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, WINDOW + 1),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('late_backfill');
  });

  it('late_backfill à 23 h 59 après la cible', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, BACKFILL_HORIZON_MINUTES - 1),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('late_backfill');
  });

  it('late_backfill exactement à 24 h pile après la cible (borne incluse)', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, BACKFILL_HORIZON_MINUTES),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('late_backfill');
  });

  it('too_late au-delà de 24 h après la cible', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, BACKFILL_HORIZON_MINUTES + 1),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('too_late');
  });

  it('rejette une fenêtre inférieure à 10 min', () => {
    expect(() =>
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: TARGET,
        confirmationWindowMinutes: MIN_CONFIRMATION_WINDOW_MINUTES - 1,
      }),
    ).toThrowError(DomainError);
  });

  it('rejette une fenêtre supérieure à 120 min', () => {
    expect(() =>
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: TARGET,
        confirmationWindowMinutes: MAX_CONFIRMATION_WINDOW_MINUTES + 1,
      }),
    ).toThrowError(/must be in/);
  });

  it('accepte les bornes de fenêtre (10 et 120)', () => {
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: TARGET,
        confirmationWindowMinutes: MIN_CONFIRMATION_WINDOW_MINUTES,
      }),
    ).toBe('on_time');
    expect(
      classifyDoseTiming({
        targetAtUtc: TARGET,
        administeredAtUtc: TARGET,
        confirmationWindowMinutes: MAX_CONFIRMATION_WINDOW_MINUTES,
      }),
    ).toBe('on_time');
  });
});

describe('RM2 — ensureDoseTimingAcceptable', () => {
  it("renvoie on_time sans erreur pour une prise à l'heure", () => {
    expect(
      ensureDoseTimingAcceptable({
        targetAtUtc: TARGET,
        administeredAtUtc: TARGET,
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('on_time');
  });

  it('renvoie late_backfill sans erreur pour un rattrapage', () => {
    expect(
      ensureDoseTimingAcceptable({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, 60),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toBe('late_backfill');
  });

  it('lève RM2_TOO_EARLY', () => {
    expect(() =>
      ensureDoseTimingAcceptable({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, -60),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toThrowError(DomainError);
    try {
      ensureDoseTimingAcceptable({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, -60),
        confirmationWindowMinutes: WINDOW,
      });
    } catch (err) {
      expect((err as DomainError).code).toBe('RM2_TOO_EARLY');
    }
  });

  it('lève RM2_TOO_LATE', () => {
    expect(() =>
      ensureDoseTimingAcceptable({
        targetAtUtc: TARGET,
        administeredAtUtc: offsetMinutes(TARGET, BACKFILL_HORIZON_MINUTES + 10),
        confirmationWindowMinutes: WINDOW,
      }),
    ).toThrowError(/backfill window closed/);
  });
});
