import { describe, expect, it } from 'vitest';
import type { Dose } from '../entities/dose';
import { DomainError } from '../errors';
import { ensureRescueDocumented } from './rm4-rescue-documented';

function makeDose(overrides: Partial<Dose> & { id: string; type: Dose['type'] }): Dose {
  return {
    householdId: 'h1',
    childId: 'child1',
    pumpId: 'p1',
    caregiverId: 'c1',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: new Date('2026-04-19T08:00:00Z'),
    recordedAtUtc: new Date('2026-04-19T08:00:00Z'),
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
    ...overrides,
  };
}

describe('RM4 — ensureRescueDocumented', () => {
  it('ignore complètement une prise maintenance (aucune exigence)', () => {
    const dose = makeDose({ id: 'd1', type: 'maintenance' });
    expect(() => ensureRescueDocumented(dose)).not.toThrow();
  });

  it('accepte une prise rescue avec au moins un symptôme', () => {
    const dose = makeDose({ id: 'd1', type: 'rescue', symptoms: ['cough'] });
    expect(() => ensureRescueDocumented(dose)).not.toThrow();
  });

  it('accepte une prise rescue avec au moins une circonstance', () => {
    const dose = makeDose({ id: 'd1', type: 'rescue', circumstances: ['exercise'] });
    expect(() => ensureRescueDocumented(dose)).not.toThrow();
  });

  it('accepte une prise rescue avec un tag libre non vide', () => {
    const dose = makeDose({ id: 'd1', type: 'rescue', freeFormTag: 'après sport' });
    expect(() => ensureRescueDocumented(dose)).not.toThrow();
  });

  it('rejette une prise rescue sans aucun champ', () => {
    const dose = makeDose({ id: 'd1', type: 'rescue' });
    expect(() => ensureRescueDocumented(dose)).toThrowError(DomainError);
    try {
      ensureRescueDocumented(dose);
    } catch (err) {
      expect((err as DomainError).code).toBe('RM4_RESCUE_NOT_DOCUMENTED');
      expect((err as DomainError).context).toMatchObject({ doseId: 'd1' });
    }
  });

  it('rejette une prise rescue avec un tag blanc (whitespace uniquement)', () => {
    const dose = makeDose({ id: 'd1', type: 'rescue', freeFormTag: '   ' });
    expect(() => ensureRescueDocumented(dose)).toThrowError(/must have at least one/);
  });

  it('accepte une prise rescue avec combinaison symptôme + circonstance', () => {
    const dose = makeDose({
      id: 'd1',
      type: 'rescue',
      symptoms: ['wheezing'],
      circumstances: ['cold_air'],
    });
    expect(() => ensureRescueDocumented(dose)).not.toThrow();
  });
});
