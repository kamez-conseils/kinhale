import { describe, expect, it } from 'vitest';
import type { Pump, PumpStatus, PumpType } from '../entities/pump';
import { DomainError } from '../errors';
import {
  applyConfirmedDoseToPump,
  DEFAULT_PUMP_ALERT_THRESHOLD_DOSES,
  isPumpEmpty,
  isPumpLow,
} from './rm7-pump-dose-countdown';

const BASE_CREATED_AT = new Date('2026-04-01T00:00:00Z');
const BASE_EXPIRES_AT = new Date('2026-10-01T00:00:00Z');

function makePump(overrides: Partial<Pump> = {}): Pump {
  return {
    id: 'pump-1',
    householdId: 'h1',
    type: 'maintenance',
    status: 'active',
    label: 'Flovent HFA 125',
    dosesRemaining: 100,
    expiresAt: BASE_EXPIRES_AT,
    createdAt: BASE_CREATED_AT,
    ...overrides,
  };
}

describe('RM7 — constants', () => {
  it('expose un seuil d alerte par défaut de 20 doses', () => {
    expect(DEFAULT_PUMP_ALERT_THRESHOLD_DOSES).toBe(20);
  });
});

describe('RM7 — applyConfirmedDoseToPump — décrément simple', () => {
  it('décrémente doses_remaining de 1 sur une prise standard', () => {
    const pump = makePump({ dosesRemaining: 100, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
    });
    expect(updated.dosesRemaining).toBe(99);
    expect(updated.status).toBe('active');
    expect(events).toEqual([]);
  });

  it('décrémente doses_remaining de N pour une prise multi-doses', () => {
    const pump = makePump({ dosesRemaining: 100, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 5,
    });
    expect(updated.dosesRemaining).toBe(95);
    expect(updated.status).toBe('active');
    expect(events).toEqual([]);
  });

  it('préserve tous les autres champs de la pompe (immutabilité partielle)', () => {
    const pump = makePump({
      id: 'pump-42',
      householdId: 'h-xyz',
      type: 'rescue',
      label: 'Ventolin HFA',
      dosesRemaining: 80,
      status: 'active',
      expiresAt: BASE_EXPIRES_AT,
      createdAt: BASE_CREATED_AT,
    });
    const { pump: updated } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 2,
    });
    expect(updated).toMatchObject({
      id: 'pump-42',
      householdId: 'h-xyz',
      type: 'rescue',
      label: 'Ventolin HFA',
      expiresAt: BASE_EXPIRES_AT,
      createdAt: BASE_CREATED_AT,
      dosesRemaining: 78,
      status: 'active',
    });
  });
});

describe('RM7 — applyConfirmedDoseToPump — franchissement seuil bas (pump_low)', () => {
  it('bascule active → low et émet pump_low_threshold_crossed au franchissement', () => {
    const pump = makePump({ dosesRemaining: 21, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 2,
      alertThresholdDoses: 20,
    });
    expect(updated.dosesRemaining).toBe(19);
    expect(updated.status).toBe('low');
    expect(events).toEqual(['pump_low_threshold_crossed']);
  });

  it('franchit le seuil à la valeur exacte (inclusif, <=)', () => {
    const pump = makePump({ dosesRemaining: 21, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
      alertThresholdDoses: 20,
    });
    expect(updated.dosesRemaining).toBe(20);
    expect(updated.status).toBe('low');
    expect(events).toEqual(['pump_low_threshold_crossed']);
  });

  it('n émet aucun événement tant que le seuil n est pas franchi', () => {
    const pump = makePump({ dosesRemaining: 22, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
      alertThresholdDoses: 20,
    });
    expect(updated.dosesRemaining).toBe(21);
    expect(updated.status).toBe('active');
    expect(events).toEqual([]);
  });

  it('utilise le seuil par défaut 20 si alertThresholdDoses est omis', () => {
    const pump = makePump({ dosesRemaining: 21, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
    });
    expect(updated.status).toBe('low');
    expect(events).toEqual(['pump_low_threshold_crossed']);
  });

  it('n émet pas pump_low_threshold_crossed si la pompe est déjà low', () => {
    const pump = makePump({ dosesRemaining: 15, status: 'low' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 3,
      alertThresholdDoses: 20,
    });
    expect(updated.dosesRemaining).toBe(12);
    expect(updated.status).toBe('low');
    expect(events).toEqual([]);
  });
});

describe('RM7 — applyConfirmedDoseToPump — pump_emptied', () => {
  it('bascule active → empty en franchissant zéro pile', () => {
    const pump = makePump({ dosesRemaining: 3, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 3,
    });
    expect(updated.dosesRemaining).toBe(0);
    expect(updated.status).toBe('empty');
    expect(events).toEqual(['pump_emptied']);
  });

  it('clamp à 0 (pas de remaining négatif) même si on dépasse', () => {
    const pump = makePump({ dosesRemaining: 3, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 10,
    });
    expect(updated.dosesRemaining).toBe(0);
    expect(updated.status).toBe('empty');
    expect(events).toEqual(['pump_emptied']);
  });

  it('bascule active → empty sans réémettre pump_low_threshold_crossed (saut direct)', () => {
    // active 5, threshold 20 — on saute depuis active (5 > 0 et 5 <= 20 mais pompe active)
    // En fait active avec remaining=5 est déjà un état incohérent en amont, mais la
    // fonction doit gérer : émettre uniquement pump_emptied, pas low.
    const pump = makePump({ dosesRemaining: 5, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 5,
      alertThresholdDoses: 20,
    });
    expect(updated.dosesRemaining).toBe(0);
    expect(updated.status).toBe('empty');
    expect(events).toEqual(['pump_emptied']);
  });

  it('bascule low → empty quand on atteint zéro depuis low', () => {
    const pump = makePump({ dosesRemaining: 2, status: 'low' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 2,
    });
    expect(updated.dosesRemaining).toBe(0);
    expect(updated.status).toBe('empty');
    expect(events).toEqual(['pump_emptied']);
  });
});

describe('RM7 — applyConfirmedDoseToPump — erreurs', () => {
  it('refuse un décrément sur une pompe déjà empty (RM7_PUMP_ALREADY_EMPTY)', () => {
    const pump = makePump({ dosesRemaining: 0, status: 'empty' });
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 1 });
      expect.fail('attendu: DomainError RM7_PUMP_ALREADY_EMPTY');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_PUMP_ALREADY_EMPTY');
    }
  });

  it('refuse un décrément sur une pompe expired (RM7_PUMP_NOT_USABLE)', () => {
    const pump = makePump({ status: 'expired' });
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 1 });
      expect.fail('attendu: DomainError RM7_PUMP_NOT_USABLE');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_PUMP_NOT_USABLE');
    }
  });

  it('refuse un décrément sur une pompe archived (RM7_PUMP_NOT_USABLE)', () => {
    const pump = makePump({ status: 'archived' });
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 1 });
      expect.fail('attendu: DomainError RM7_PUMP_NOT_USABLE');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_PUMP_NOT_USABLE');
    }
  });

  it('refuse dosesAdministered = 0 (RM7_INVALID_DOSES_AMOUNT)', () => {
    const pump = makePump();
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 0 });
      expect.fail('attendu: DomainError RM7_INVALID_DOSES_AMOUNT');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_INVALID_DOSES_AMOUNT');
    }
  });

  it('refuse dosesAdministered négatif (RM7_INVALID_DOSES_AMOUNT)', () => {
    const pump = makePump();
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: -3 });
      expect.fail('attendu: DomainError RM7_INVALID_DOSES_AMOUNT');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_INVALID_DOSES_AMOUNT');
    }
  });

  it('refuse dosesAdministered non entier (RM7_INVALID_DOSES_AMOUNT)', () => {
    const pump = makePump();
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 1.5 });
      expect.fail('attendu: DomainError RM7_INVALID_DOSES_AMOUNT');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_INVALID_DOSES_AMOUNT');
    }
  });

  it('refuse alertThresholdDoses = 0 (RM7_INVALID_THRESHOLD)', () => {
    const pump = makePump();
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 1, alertThresholdDoses: 0 });
      expect.fail('attendu: DomainError RM7_INVALID_THRESHOLD');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_INVALID_THRESHOLD');
    }
  });

  it('refuse alertThresholdDoses négatif (RM7_INVALID_THRESHOLD)', () => {
    const pump = makePump();
    try {
      applyConfirmedDoseToPump({ pump, dosesAdministered: 1, alertThresholdDoses: -5 });
      expect.fail('attendu: DomainError RM7_INVALID_THRESHOLD');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM7_INVALID_THRESHOLD');
    }
  });
});

describe('RM7 — applyConfirmedDoseToPump — type de pompe', () => {
  it('s applique identiquement à une pompe maintenance', () => {
    const pump = makePump({ type: 'maintenance', dosesRemaining: 50 });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
    });
    expect(updated.dosesRemaining).toBe(49);
    expect(events).toEqual([]);
  });

  it('s applique identiquement à une pompe rescue', () => {
    const pump = makePump({ type: 'rescue', dosesRemaining: 50 });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
    });
    expect(updated.dosesRemaining).toBe(49);
    expect(updated.type).toBe('rescue');
    expect(events).toEqual([]);
  });

  it('déclenche pump_low_threshold_crossed sur pompe rescue aussi', () => {
    const pump = makePump({ type: 'rescue', dosesRemaining: 21, status: 'active' });
    const { pump: updated, events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 2,
    });
    expect(updated.status).toBe('low');
    expect(events).toEqual(['pump_low_threshold_crossed']);
  });
});

describe('RM7 — applyConfirmedDoseToPump — pureté', () => {
  it('ne mute pas la pompe en entrée (dosesRemaining)', () => {
    const pump = makePump({ dosesRemaining: 100, status: 'active' });
    applyConfirmedDoseToPump({ pump, dosesAdministered: 5 });
    expect(pump.dosesRemaining).toBe(100);
    expect(pump.status).toBe('active');
  });

  it('ne mute pas la pompe en entrée (status)', () => {
    const pump = makePump({ dosesRemaining: 21, status: 'active' });
    applyConfirmedDoseToPump({ pump, dosesAdministered: 1, alertThresholdDoses: 20 });
    expect(pump.status).toBe('active');
    expect(pump.dosesRemaining).toBe(21);
  });

  it('renvoie une nouvelle instance de pompe (différente référence)', () => {
    const pump = makePump({ dosesRemaining: 100, status: 'active' });
    const { pump: updated } = applyConfirmedDoseToPump({ pump, dosesAdministered: 1 });
    expect(updated).not.toBe(pump);
  });

  it('renvoie events en tableau read-only figé (pas de partage mutable)', () => {
    const pump = makePump({ dosesRemaining: 21, status: 'active' });
    const { events } = applyConfirmedDoseToPump({
      pump,
      dosesAdministered: 1,
      alertThresholdDoses: 20,
    });
    // On vérifie juste que c'est bien un array et qu'il contient les bons éléments ;
    // la structure ReadonlyArray est garantie par le type.
    expect(Array.isArray(events)).toBe(true);
    expect(events).toHaveLength(1);
  });
});

describe('RM7 — isPumpLow', () => {
  it('renvoie true pour une pompe active avec remaining <= threshold', () => {
    const pump = makePump({ dosesRemaining: 15, status: 'active' });
    expect(isPumpLow(pump, 20)).toBe(true);
  });

  it('renvoie true pour une pompe de statut low', () => {
    const pump = makePump({ dosesRemaining: 15, status: 'low' });
    expect(isPumpLow(pump)).toBe(true);
  });

  it('renvoie false pour une pompe empty (empty n est pas low)', () => {
    const pump = makePump({ dosesRemaining: 0, status: 'empty' });
    expect(isPumpLow(pump)).toBe(false);
  });

  it('renvoie false quand remaining est strictement au-dessus du seuil', () => {
    const pump = makePump({ dosesRemaining: 25, status: 'active' });
    expect(isPumpLow(pump, 20)).toBe(false);
  });

  it('renvoie true à la valeur exacte du seuil (inclusif, <=)', () => {
    const pump = makePump({ dosesRemaining: 20, status: 'active' });
    expect(isPumpLow(pump, 20)).toBe(true);
  });

  it('utilise le seuil par défaut 20 si non fourni', () => {
    const pump = makePump({ dosesRemaining: 19, status: 'active' });
    expect(isPumpLow(pump)).toBe(true);
  });
});

describe('RM7 — isPumpEmpty', () => {
  it('renvoie true pour une pompe de statut empty', () => {
    const pump = makePump({ dosesRemaining: 0, status: 'empty' });
    expect(isPumpEmpty(pump)).toBe(true);
  });

  it('renvoie false pour une pompe active', () => {
    const pump = makePump({ dosesRemaining: 10, status: 'active' });
    expect(isPumpEmpty(pump)).toBe(false);
  });

  it('renvoie false pour une pompe low', () => {
    const pump = makePump({ dosesRemaining: 5, status: 'low' });
    expect(isPumpEmpty(pump)).toBe(false);
  });
});

describe('RM7 — contrat de typage', () => {
  // Ces tests vérifient simplement que le typage public est correct ; ils
  // tournent en exécution mais la vraie valeur est à la compilation.
  it('accepte tous les PumpStatus et PumpType', () => {
    const statuses: PumpStatus[] = ['active', 'low', 'empty', 'expired', 'archived'];
    const types: PumpType[] = ['maintenance', 'rescue'];
    expect(statuses).toHaveLength(5);
    expect(types).toHaveLength(2);
  });
});
