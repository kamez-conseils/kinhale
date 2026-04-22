import { describe, expect, it } from 'vitest';
import type { Dose } from '../entities/dose';
import {
  DUPLICATE_DETECTION_WINDOW_MINUTES,
  type DoseSignature,
  findDuplicateCandidates,
  markDosesAsPendingReview,
  mustFlagAsPendingReview,
} from './rm6-duplicate-detection';

const BASE = new Date('2026-04-19T08:00:00Z');

function offsetSeconds(base: Date, seconds: number): Date {
  return new Date(base.getTime() + seconds * 1000);
}

function sig(overrides: Partial<DoseSignature> & { doseId: string }): DoseSignature {
  return {
    pumpId: 'pump-1',
    type: 'maintenance',
    recordedAtUtc: BASE,
    ...overrides,
  };
}

function makeDose(overrides: Partial<Dose> & { id: string }): Dose {
  return {
    householdId: 'h1',
    childId: 'child1',
    pumpId: 'pump-1',
    caregiverId: 'c1',
    type: 'maintenance',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: BASE,
    recordedAtUtc: BASE,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
    ...overrides,
  };
}

describe('RM6 — constant', () => {
  it('expose une fenêtre de détection de 2 minutes', () => {
    expect(DUPLICATE_DETECTION_WINDOW_MINUTES).toBe(2);
  });
});

describe('RM6 — findDuplicateCandidates', () => {
  it('renvoie vide si aucune prise existante', () => {
    const candidate = sig({ doseId: 'd1' });
    expect(findDuplicateCandidates(candidate, [])).toEqual([]);
  });

  it('détecte un conflit à 0 min d écart (même pompe, même type)', () => {
    const candidate = sig({ doseId: 'd-new' });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: BASE })];
    const conflicts = findDuplicateCandidates(candidate, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.doseId).toBe('d-existing');
  });

  it('détecte un conflit à 1 min 59 s d écart', () => {
    const candidate = sig({ doseId: 'd-new', recordedAtUtc: offsetSeconds(BASE, 119) });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: BASE })];
    expect(findDuplicateCandidates(candidate, existing)).toHaveLength(1);
  });

  it('ne détecte pas de conflit à exactement 2 min d écart (borne stricte)', () => {
    const candidate = sig({ doseId: 'd-new', recordedAtUtc: offsetSeconds(BASE, 120) });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: BASE })];
    expect(findDuplicateCandidates(candidate, existing)).toEqual([]);
  });

  it('ne détecte pas de conflit à 2 min 01 s d écart', () => {
    const candidate = sig({ doseId: 'd-new', recordedAtUtc: offsetSeconds(BASE, 121) });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: BASE })];
    expect(findDuplicateCandidates(candidate, existing)).toEqual([]);
  });

  it('ne détecte pas de conflit entre types différents (fond vs secours)', () => {
    const candidate = sig({ doseId: 'd-new', type: 'maintenance' });
    const existing = [sig({ doseId: 'd-existing', type: 'rescue' })];
    expect(findDuplicateCandidates(candidate, existing)).toEqual([]);
  });

  it('ne détecte pas de conflit entre pompes différentes', () => {
    const candidate = sig({ doseId: 'd-new', pumpId: 'pump-1' });
    const existing = [sig({ doseId: 'd-existing', pumpId: 'pump-2' })];
    expect(findDuplicateCandidates(candidate, existing)).toEqual([]);
  });

  it('détecte le conflit en valeur absolue (prise existante postérieure)', () => {
    const candidate = sig({ doseId: 'd-new', recordedAtUtc: BASE });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: offsetSeconds(BASE, 60) })];
    expect(findDuplicateCandidates(candidate, existing)).toHaveLength(1);
  });

  it('détecte le conflit en valeur absolue (prise existante antérieure)', () => {
    const candidate = sig({ doseId: 'd-new', recordedAtUtc: BASE });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: offsetSeconds(BASE, -60) })];
    expect(findDuplicateCandidates(candidate, existing)).toHaveLength(1);
  });

  it('renvoie toutes les prises existantes en conflit, pas seulement la plus proche', () => {
    const candidate = sig({ doseId: 'd-new', recordedAtUtc: BASE });
    const existing = [
      sig({ doseId: 'd-a', recordedAtUtc: offsetSeconds(BASE, 30) }),
      sig({ doseId: 'd-b', recordedAtUtc: offsetSeconds(BASE, -45) }),
      sig({ doseId: 'd-c', recordedAtUtc: offsetSeconds(BASE, 500) }), // hors fenêtre
      sig({ doseId: 'd-d', recordedAtUtc: offsetSeconds(BASE, 90) }),
    ];
    const ids = findDuplicateCandidates(candidate, existing)
      .map((d) => d.doseId)
      .sort();
    expect(ids).toEqual(['d-a', 'd-b', 'd-d']);
  });

  it('ignore la candidate elle-même si présente dans existing (même doseId)', () => {
    const candidate = sig({ doseId: 'd-same' });
    const existing = [sig({ doseId: 'd-same' })];
    expect(findDuplicateCandidates(candidate, existing)).toEqual([]);
  });

  it('ignore la candidate elle-même mais garde les autres conflits', () => {
    const candidate = sig({ doseId: 'd-same', recordedAtUtc: BASE });
    const existing = [
      sig({ doseId: 'd-same', recordedAtUtc: BASE }),
      sig({ doseId: 'd-other', recordedAtUtc: offsetSeconds(BASE, 30) }),
    ];
    const conflicts = findDuplicateCandidates(candidate, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.doseId).toBe('d-other');
  });

  it('ne mute pas le tableau existing fourni (pureté)', () => {
    const candidate = sig({ doseId: 'd-new' });
    const existing = [
      sig({ doseId: 'd-a', recordedAtUtc: offsetSeconds(BASE, 30) }),
      sig({ doseId: 'd-b', recordedAtUtc: offsetSeconds(BASE, -500) }),
    ];
    const snapshot = existing.map((d) => d.doseId);
    findDuplicateCandidates(candidate, existing);
    expect(existing.map((d) => d.doseId)).toEqual(snapshot);
  });
});

describe('RM6 — mustFlagAsPendingReview', () => {
  it('renvoie false sans prises existantes', () => {
    expect(mustFlagAsPendingReview(sig({ doseId: 'd1' }), [])).toBe(false);
  });

  it('renvoie true dès qu un conflit existe', () => {
    const candidate = sig({ doseId: 'd-new' });
    const existing = [sig({ doseId: 'd-existing', recordedAtUtc: offsetSeconds(BASE, 30) })];
    expect(mustFlagAsPendingReview(candidate, existing)).toBe(true);
  });

  it('renvoie false si la seule occurrence est la candidate elle-même', () => {
    const candidate = sig({ doseId: 'd-same' });
    const existing = [sig({ doseId: 'd-same' })];
    expect(mustFlagAsPendingReview(candidate, existing)).toBe(false);
  });
});

describe('RM6 — markDosesAsPendingReview', () => {
  it('bascule une prise confirmed en pending_review', () => {
    const dose = makeDose({ id: 'd1', status: 'confirmed' });
    const [result] = markDosesAsPendingReview([dose]);
    expect(result?.status).toBe('pending_review');
  });

  it('préserve les autres champs de la prise', () => {
    const dose = makeDose({
      id: 'd1',
      status: 'confirmed',
      symptoms: ['cough'],
      freeFormTag: 'sport',
    });
    const [result] = markDosesAsPendingReview([dose]);
    expect(result).toMatchObject({
      id: 'd1',
      symptoms: ['cough'],
      freeFormTag: 'sport',
      status: 'pending_review',
    });
  });

  it('est idempotent pour une prise déjà pending_review', () => {
    const dose = makeDose({ id: 'd1', status: 'pending_review' });
    const [result] = markDosesAsPendingReview([dose]);
    expect(result?.status).toBe('pending_review');
  });

  it('ne réactive jamais une prise voided (reste voided)', () => {
    const dose = makeDose({ id: 'd1', status: 'voided', voidedReason: 'saisie erronée' });
    const [result] = markDosesAsPendingReview([dose]);
    expect(result?.status).toBe('voided');
    expect(result?.voidedReason).toBe('saisie erronée');
  });

  it('ne mute pas les prises en entrée (pureté)', () => {
    const dose = makeDose({ id: 'd1', status: 'confirmed' });
    markDosesAsPendingReview([dose]);
    expect(dose.status).toBe('confirmed');
  });

  it('traite correctement un lot mixte (confirmed + voided)', () => {
    const doses = [
      makeDose({ id: 'd1', status: 'confirmed' }),
      makeDose({ id: 'd2', status: 'voided', voidedReason: 'erreur' }),
      makeDose({ id: 'd3', status: 'pending_review' }),
    ];
    const result = markDosesAsPendingReview(doses);
    expect(result.map((d) => d.status)).toEqual(['pending_review', 'voided', 'pending_review']);
  });

  it('renvoie un tableau vide pour un lot vide', () => {
    expect(markDosesAsPendingReview([])).toEqual([]);
  });
});
