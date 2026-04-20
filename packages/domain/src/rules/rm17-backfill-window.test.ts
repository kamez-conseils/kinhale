import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  BACKFILL_MAX_WINDOW_HOURS,
  type BackfillValidation,
  ensureBackfillAllowed,
  validateBackfillTiming,
} from './rm17-backfill-window';

const NOW = new Date('2026-04-19T12:00:00Z');

function offsetMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

describe('RM17 — constant', () => {
  it('expose la fenêtre max de 24 h', () => {
    expect(BACKFILL_MAX_WINDOW_HOURS).toBe(24);
  });
});

describe('RM17 — validateBackfillTiming', () => {
  it('on_time quand administered == recorded', () => {
    const validation = validateBackfillTiming({
      administeredAtUtc: NOW,
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('on_time');
    expect(validation.requiresExplicitConfirmation).toBe(false);
  });

  it('on_time pour une saisie temps réel (< 5 s d écart)', () => {
    const validation = validateBackfillTiming({
      administeredAtUtc: new Date(NOW.getTime() - 3_000),
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('on_time');
  });

  it('within_window pour une saisie à -1 h (backfill 1 h passé)', () => {
    const administered = offsetMinutes(NOW, -60);
    const validation = validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('within_window');
    if (validation.validity.kind === 'within_window') {
      expect(validation.validity.lateBy).toBe(60 * 60_000);
    }
    expect(validation.requiresExplicitConfirmation).toBe(false);
  });

  it('within_window à -23 h 59 min', () => {
    const administered = offsetMinutes(NOW, -(23 * 60 + 59));
    const validation = validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('within_window');
  });

  it('within_window à -24 h pile (borne inclusive)', () => {
    const administered = offsetMinutes(NOW, -24 * 60);
    const validation = validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('within_window');
    if (validation.validity.kind === 'within_window') {
      expect(validation.validity.lateBy).toBe(24 * 60 * 60_000);
    }
  });

  it('too_old à -24 h 01 min (requiresExplicitConfirmation=true)', () => {
    const administered = offsetMinutes(NOW, -(24 * 60 + 1));
    const validation = validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('too_old');
    if (validation.validity.kind === 'too_old') {
      expect(validation.validity.lateBy).toBe((24 * 60 + 1) * 60_000);
    }
    expect(validation.requiresExplicitConfirmation).toBe(true);
  });

  it('future_refused pour une prise 1 min dans le futur', () => {
    const administered = offsetMinutes(NOW, 1);
    const validation: BackfillValidation = validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
    });
    expect(validation.validity.kind).toBe('future_refused');
    if (validation.validity.kind === 'future_refused') {
      expect(validation.validity.aheadBy).toBe(60_000);
    }
    expect(validation.requiresExplicitConfirmation).toBe(false);
  });

  it('ignore le flag explicitlyConfirmed (simple diagnostic)', () => {
    const administered = offsetMinutes(NOW, -(25 * 60));
    const validation = validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
      explicitlyConfirmed: true,
    });
    // La classification ne change pas : elle reste too_old.
    expect(validation.validity.kind).toBe('too_old');
  });

  it('ne mute pas les dates fournies', () => {
    const administered = offsetMinutes(NOW, -60);
    const adminMs = administered.getTime();
    const nowMs = NOW.getTime();
    validateBackfillTiming({
      administeredAtUtc: administered,
      recordedAtUtc: NOW,
    });
    expect(administered.getTime()).toBe(adminMs);
    expect(NOW.getTime()).toBe(nowMs);
  });
});

describe('RM17 — ensureBackfillAllowed', () => {
  it('passe pour une saisie on_time', () => {
    expect(() =>
      ensureBackfillAllowed({
        administeredAtUtc: NOW,
        recordedAtUtc: NOW,
      }),
    ).not.toThrow();
  });

  it('passe pour un backfill within_window sans confirmation', () => {
    expect(() =>
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, -60),
        recordedAtUtc: NOW,
      }),
    ).not.toThrow();
  });

  it('lève RM17_TOO_OLD_REQUIRES_CONFIRMATION à -25 h sans confirmation', () => {
    expect(() =>
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, -(25 * 60)),
        recordedAtUtc: NOW,
      }),
    ).toThrowError(DomainError);
    try {
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, -(25 * 60)),
        recordedAtUtc: NOW,
      });
    } catch (err) {
      expect((err as DomainError).code).toBe('RM17_TOO_OLD_REQUIRES_CONFIRMATION');
    }
  });

  it('passe à -25 h avec explicitlyConfirmed=true', () => {
    expect(() =>
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, -(25 * 60)),
        recordedAtUtc: NOW,
        explicitlyConfirmed: true,
      }),
    ).not.toThrow();
  });

  it('lève RM17_FUTURE_ADMINISTRATION_REFUSED pour une saisie dans le futur', () => {
    expect(() =>
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, 1),
        recordedAtUtc: NOW,
      }),
    ).toThrowError(DomainError);
    try {
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, 1),
        recordedAtUtc: NOW,
      });
    } catch (err) {
      expect((err as DomainError).code).toBe('RM17_FUTURE_ADMINISTRATION_REFUSED');
    }
  });

  it('lève RM17_FUTURE_ADMINISTRATION_REFUSED même avec explicitlyConfirmed=true', () => {
    // Le futur n'est JAMAIS acceptable, même confirmé : c'est une dérive
    // d'horloge ou une tentative de falsification, pas un rattrapage.
    expect(() =>
      ensureBackfillAllowed({
        administeredAtUtc: offsetMinutes(NOW, 1),
        recordedAtUtc: NOW,
        explicitlyConfirmed: true,
      }),
    ).toThrowError(/RM17_FUTURE_ADMINISTRATION_REFUSED|future/i);
  });
});
