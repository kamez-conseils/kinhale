import { describe, expect, it } from 'vitest';
import type { Dose } from '../entities/dose';
import type { Role } from '../entities/role';
import { DomainError } from '../errors';
import {
  canVoidDose,
  ensureCanVoidDose,
  VOID_FREE_WINDOW_MINUTES,
  voidDose,
} from './rm18-void-dose';

const RECORDED = new Date('2026-04-19T08:00:00Z');

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function makeDose(overrides: Partial<Dose> & { id: string }): Dose {
  return {
    householdId: 'h1',
    childId: 'c1',
    pumpId: 'p1',
    caregiverId: 'author-1',
    type: 'maintenance',
    status: 'confirmed',
    source: 'manual',
    dosesAdministered: 1,
    administeredAtUtc: RECORDED,
    recordedAtUtc: RECORDED,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    voidedReason: null,
    ...overrides,
  };
}

function requester(
  caregiverId: string,
  role: Role,
): { readonly caregiverId: string; readonly role: Role } {
  return { caregiverId, role };
}

describe('RM18 — constant', () => {
  it('expose une fenêtre libre de 30 minutes', () => {
    expect(VOID_FREE_WINDOW_MINUTES).toBe(30);
  });
});

describe('RM18 — canVoidDose (auteur, dans la fenêtre libre)', () => {
  it('auteur contributor dans la fenêtre libre : OK sans raison', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).toBe(true);
  });

  it('auteur contributor dans la fenêtre libre : OK avec raison fournie', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
        voidedReason: 'mauvaise pompe',
      }),
    ).toBe(true);
  });

  it('auteur contributor à 30 min pile (borne incluse) : OK', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, VOID_FREE_WINDOW_MINUTES),
      }),
    ).toBe(true);
  });
});

describe('RM18 — canVoidDose (admin dans la fenêtre libre)', () => {
  it('admin non-auteur dans la fenêtre libre : OK sans raison', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).toBe(true);
  });

  it('admin non-auteur dans la fenêtre libre : OK avec raison', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 5),
        voidedReason: 'correction',
      }),
    ).toBe(true);
  });
});

describe('RM18 — canVoidDose (refus)', () => {
  it('contributor non-auteur dans la fenêtre libre : KO', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('other-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).toBe(false);
  });

  it('restricted_contributor même auteur : KO', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('author-1', 'restricted_contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).toBe(false);
  });

  it('auteur contributor hors fenêtre libre (31 min) : KO', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 31),
      }),
    ).toBe(false);
  });

  it('admin hors fenêtre libre sans raison : KO', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
      }),
    ).toBe(false);
  });

  it('admin hors fenêtre libre raison vide : KO', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
        voidedReason: '',
      }),
    ).toBe(false);
  });

  it('admin hors fenêtre libre whitespace pur : KO', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
        voidedReason: '   ',
      }),
    ).toBe(false);
  });

  it('admin hors fenêtre libre avec raison valide : OK', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
        voidedReason: 'saisie erronée',
      }),
    ).toBe(true);
  });

  it('prise déjà voided : toujours KO', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      status: 'voided',
      voidedReason: 'déjà',
    });
    expect(
      canVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 5),
        voidedReason: 'nouvelle',
      }),
    ).toBe(false);
  });
});

describe('RM18 — ensureCanVoidDose (codes d erreur précis)', () => {
  it('lève RM18_ALREADY_VOIDED sur prise déjà voidée', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      status: 'voided',
      voidedReason: 'déjà',
    });
    expect(() =>
      ensureCanVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).toThrowError(DomainError);
    try {
      ensureCanVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      });
    } catch (err) {
      expect((err as DomainError).code).toBe('RM18_ALREADY_VOIDED');
    }
  });

  it('lève RM18_NOT_AUTHORIZED pour contributor non-auteur (fenêtre libre)', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    try {
      ensureCanVoidDose({
        dose,
        requester: requester('other-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM18_NOT_AUTHORIZED');
    }
  });

  it('lève RM18_NOT_AUTHORIZED pour restricted_contributor même auteur', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    try {
      ensureCanVoidDose({
        dose,
        requester: requester('author-1', 'restricted_contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM18_NOT_AUTHORIZED');
    }
  });

  it('lève RM18_NOT_AUTHORIZED pour auteur contributor hors fenêtre libre', () => {
    // Hors fenêtre libre, seul un admin peut voider. Un contributor n est plus autorisé.
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    try {
      ensureCanVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 31),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM18_NOT_AUTHORIZED');
    }
  });

  it('lève RM18_VOIDED_REASON_REQUIRED pour admin hors fenêtre sans raison', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    try {
      ensureCanVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM18_VOIDED_REASON_REQUIRED');
    }
  });

  it('lève RM18_VOIDED_REASON_REQUIRED pour admin hors fenêtre raison whitespace', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    try {
      ensureCanVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
        voidedReason: '   \n\t',
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM18_VOIDED_REASON_REQUIRED');
    }
  });

  it('ne lève pas pour admin hors fenêtre avec raison valide', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(() =>
      ensureCanVoidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
        voidedReason: 'saisie erronée',
      }),
    ).not.toThrow();
  });

  it('ne lève pas pour auteur contributor dans la fenêtre libre', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(() =>
      ensureCanVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).not.toThrow();
  });
});

describe('RM18 — voidDose (transition)', () => {
  it('retourne une nouvelle prise status=voided', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    const result = voidDose({
      dose,
      requester: requester('author-1', 'contributor'),
      nowUtc: minutesAfter(RECORDED, 5),
    });
    expect(result.status).toBe('voided');
    expect(result.id).toBe('d1');
  });

  it('ne mute pas la prise source (pureté)', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1', status: 'confirmed' });
    voidDose({
      dose,
      requester: requester('author-1', 'contributor'),
      nowUtc: minutesAfter(RECORDED, 5),
    });
    expect(dose.status).toBe('confirmed');
    expect(dose.voidedReason).toBeNull();
  });

  it('stocke voidedReason trimé', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    const result = voidDose({
      dose,
      requester: requester('admin-1', 'admin'),
      nowUtc: minutesAfter(RECORDED, 60),
      voidedReason: '  saisie erronée  ',
    });
    expect(result.voidedReason).toBe('saisie erronée');
  });

  it('stocke voidedReason=null si non fourni (fenêtre libre)', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    const result = voidDose({
      dose,
      requester: requester('author-1', 'contributor'),
      nowUtc: minutesAfter(RECORDED, 5),
    });
    expect(result.voidedReason).toBeNull();
  });

  it('stocke voidedReason=null si whitespace pur (fenêtre libre)', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    const result = voidDose({
      dose,
      requester: requester('author-1', 'contributor'),
      nowUtc: minutesAfter(RECORDED, 5),
      voidedReason: '   ',
    });
    expect(result.voidedReason).toBeNull();
  });

  it('préserve les autres champs de la prise', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      symptoms: ['cough'],
      circumstances: ['exercise'],
      freeFormTag: 'sport',
      dosesAdministered: 2,
      source: 'reminder',
      type: 'rescue',
    });
    const result = voidDose({
      dose,
      requester: requester('admin-1', 'admin'),
      nowUtc: minutesAfter(RECORDED, 60),
      voidedReason: 'erreur',
    });
    expect(result).toMatchObject({
      id: 'd1',
      caregiverId: 'author-1',
      symptoms: ['cough'],
      circumstances: ['exercise'],
      freeFormTag: 'sport',
      dosesAdministered: 2,
      source: 'reminder',
      type: 'rescue',
      status: 'voided',
      voidedReason: 'erreur',
    });
  });

  it('lève RM18_ALREADY_VOIDED sur prise déjà voidée', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      status: 'voided',
      voidedReason: 'déjà',
    });
    expect(() =>
      voidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 5),
        voidedReason: 'nouvelle',
      }),
    ).toThrowError(DomainError);
  });

  it('lève RM18_NOT_AUTHORIZED sur contributor non-auteur', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(() =>
      voidDose({
        dose,
        requester: requester('other-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 5),
      }),
    ).toThrowError(DomainError);
  });

  it('lève RM18_VOIDED_REASON_REQUIRED admin hors fenêtre sans raison', () => {
    const dose = makeDose({ id: 'd1', caregiverId: 'author-1' });
    expect(() =>
      voidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 60),
      }),
    ).toThrowError(DomainError);
  });
});

// Cas local-first : une prise saisie hors-ligne n'a pas encore été horodatée
// par le serveur (`recordedAtUtc = null`). La fenêtre libre doit alors se
// calculer depuis `administeredAtUtc` pour ne pas bloquer un void légitime.
describe('RM18 — fallback recordedAtUtc=null (dose hors-ligne non synchronisée)', () => {
  it("autorise le void par l'auteur dans la fenêtre libre calculée sur administeredAtUtc", () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      recordedAtUtc: null,
    });
    expect(
      canVoidDose({
        dose,
        requester: requester('author-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 10),
      }),
    ).toBe(true);
  });

  it('refuse le void par un contributor non-auteur hors fenêtre même sans recordedAtUtc', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      recordedAtUtc: null,
    });
    expect(
      canVoidDose({
        dose,
        requester: requester('other-1', 'contributor'),
        nowUtc: minutesAfter(RECORDED, 45),
      }),
    ).toBe(false);
  });

  it('exige voidedReason pour un admin hors fenêtre calculée depuis administeredAtUtc', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      recordedAtUtc: null,
    });
    expect(() =>
      voidDose({
        dose,
        requester: requester('admin-1', 'admin'),
        nowUtc: minutesAfter(RECORDED, 45),
      }),
    ).toThrowError(DomainError);
  });

  it('accepte le void admin hors fenêtre avec raison, dose non synchronisée', () => {
    const dose = makeDose({
      id: 'd1',
      caregiverId: 'author-1',
      recordedAtUtc: null,
    });
    const result = voidDose({
      dose,
      requester: requester('admin-1', 'admin'),
      nowUtc: minutesAfter(RECORDED, 45),
      voidedReason: 'correction post-sync',
    });
    expect(result.status).toBe('voided');
    expect(result.voidedReason).toBe('correction post-sync');
  });
});
