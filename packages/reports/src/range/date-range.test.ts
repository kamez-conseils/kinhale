import { describe, expect, it } from 'vitest';
import {
  MAX_RANGE_MONTHS,
  MS_PER_DAY,
  presetRange,
  validateDateRange,
  type DateRange,
} from './date-range.js';

const MS_PER_MONTH = 30 * MS_PER_DAY;

describe('presetRange', () => {
  it('retourne une plage de 30 jours exactement pour "30d"', () => {
    const now = Date.UTC(2026, 3, 24, 12, 0, 0);
    const range = presetRange('30d', now);
    expect(range.endMs).toBe(now);
    expect(range.startMs).toBe(now - 30 * MS_PER_DAY);
  });

  it('retourne une plage de 90 jours exactement pour "90d"', () => {
    const now = Date.UTC(2026, 3, 24, 12, 0, 0);
    const range = presetRange('90d', now);
    expect(range.endMs).toBe(now);
    expect(range.startMs).toBe(now - 90 * MS_PER_DAY);
  });
});

describe('validateDateRange', () => {
  const BASE = Date.UTC(2026, 3, 24, 12, 0, 0);

  it('accepte une plage 30 jours valide', () => {
    const range: DateRange = { startMs: BASE - 30 * MS_PER_DAY, endMs: BASE };
    expect(validateDateRange(range)).toEqual({ ok: true });
  });

  it('accepte une plage 90 jours valide', () => {
    const range: DateRange = { startMs: BASE - 90 * MS_PER_DAY, endMs: BASE };
    expect(validateDateRange(range)).toEqual({ ok: true });
  });

  it('rejette une plage inversée (fin < début)', () => {
    const range: DateRange = { startMs: BASE, endMs: BASE - MS_PER_DAY };
    expect(validateDateRange(range)).toEqual({ ok: false, error: 'invalid_order' });
  });

  it('rejette une plage identique (fin == début)', () => {
    const range: DateRange = { startMs: BASE, endMs: BASE };
    expect(validateDateRange(range)).toEqual({ ok: false, error: 'invalid_order' });
  });

  it('rejette une plage > 24 mois (perf)', () => {
    const range: DateRange = {
      startMs: BASE - (MAX_RANGE_MONTHS * MS_PER_MONTH + MS_PER_DAY),
      endMs: BASE,
    };
    expect(validateDateRange(range)).toEqual({ ok: false, error: 'range_too_large' });
  });

  it('accepte exactement 24 mois (limite haute inclusive)', () => {
    const range: DateRange = {
      startMs: BASE - MAX_RANGE_MONTHS * MS_PER_MONTH,
      endMs: BASE,
    };
    expect(validateDateRange(range)).toEqual({ ok: true });
  });

  it('rejette une plage avec timestamp NaN (entrée corrompue)', () => {
    const range: DateRange = { startMs: Number.NaN, endMs: BASE };
    expect(validateDateRange(range)).toEqual({ ok: false, error: 'invalid_timestamp' });
  });

  it('rejette une plage avec timestamp non fini', () => {
    const range: DateRange = { startMs: BASE, endMs: Number.POSITIVE_INFINITY };
    expect(validateDateRange(range)).toEqual({ ok: false, error: 'invalid_timestamp' });
  });
});
