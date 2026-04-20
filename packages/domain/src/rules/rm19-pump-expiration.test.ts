import { describe, expect, it } from 'vitest';
import type { Pump } from '../entities/pump';
import { DomainError } from '../errors';
import {
  canUsePumpForDose,
  daysUntilExpiration,
  ensurePumpUsableForDose,
  evaluatePumpExpiration,
  PUMP_EXPIRING_WARNING_WINDOW_DAYS,
} from './rm19-pump-expiration';

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
    expiresAt: offsetDays(NOW, 60),
    createdAt: offsetDays(NOW, -30),
    ...overrides,
  };
}

describe('RM19 — constante', () => {
  it('expose la fenêtre d avertissement de 30 jours', () => {
    expect(PUMP_EXPIRING_WARNING_WINDOW_DAYS).toBe(30);
  });
});

describe('RM19 — daysUntilExpiration', () => {
  it('retourne null pour une pompe sans date de péremption', () => {
    const pump = makePump({ expiresAt: null });
    expect(daysUntilExpiration(pump, NOW)).toBeNull();
  });

  it('retourne 60 pour une pompe qui expire dans 60 jours', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 60) });
    expect(daysUntilExpiration(pump, NOW)).toBe(60);
  });

  it('retourne 30 à J-30 pile', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 30) });
    expect(daysUntilExpiration(pump, NOW)).toBe(30);
  });

  it('retourne 0 le jour même de l expiration', () => {
    const pump = makePump({ expiresAt: NOW });
    expect(daysUntilExpiration(pump, NOW)).toBe(0);
  });

  it('retourne une valeur négative après expiration', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -5) });
    expect(daysUntilExpiration(pump, NOW)).toBe(-5);
  });

  it('utilise Math.floor : 30 j et 1 min reste 30 j', () => {
    const pump = makePump({
      expiresAt: new Date(NOW.getTime() + 30 * ONE_DAY_MS + 60_000),
    });
    expect(daysUntilExpiration(pump, NOW)).toBe(30);
  });
});

describe('RM19 — evaluatePumpExpiration — pompe sans date', () => {
  it('pompe sans expiresAt : pas d événement, status inchangé', () => {
    const pump = makePump({ expiresAt: null, status: 'active' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual([]);
    expect(update.pump).toBe(pump);
  });

  it('pompe sans expiresAt : un previousRemainingDays passé est ignoré', () => {
    const pump = makePump({ expiresAt: null });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 100,
      nowUtc: NOW,
    });
    expect(update.events).toEqual([]);
  });
});

describe('RM19 — evaluatePumpExpiration — franchissement J-30', () => {
  it('pompe à J-100 : aucun événement', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 100), status: 'active' });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 101,
      nowUtc: NOW,
    });
    expect(update.events).toEqual([]);
    expect(update.pump.status).toBe('active');
  });

  it('pompe à J-30 pile avec previousRemainingDays=31 : pump_expiring émis', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 30), status: 'active' });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 31,
      nowUtc: NOW,
    });
    expect(update.events).toEqual(['pump_expiring_threshold_crossed']);
    expect(update.pump.status).toBe('active');
  });

  it('pompe à J-29 avec previousRemainingDays=31 : franchissement émis', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 29), status: 'active' });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 31,
      nowUtc: NOW,
    });
    expect(update.events).toEqual(['pump_expiring_threshold_crossed']);
  });

  it('pompe à J-25 avec previousRemainingDays=28 : pas d événement (déjà sous seuil)', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 25), status: 'active' });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 28,
      nowUtc: NOW,
    });
    expect(update.events).toEqual([]);
  });

  it('pompe à J-30 sans previousRemainingDays : conservatif, pas d événement', () => {
    // Choix sémantique : sans previous, on ne spam pas. L'UI peut rafraîchir
    // via une autre voie. Protège contre les répétitions à chaque appel.
    const pump = makePump({ expiresAt: offsetDays(NOW, 30), status: 'active' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual([]);
  });
});

describe('RM19 — evaluatePumpExpiration — expiration effective', () => {
  it('pompe à J-0 (expires == now) : pump_expired émis + status=expired', () => {
    const pump = makePump({ expiresAt: NOW, status: 'active' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual(['pump_expired']);
    expect(update.pump.status).toBe('expired');
  });

  it('pompe à J+5 avec status encore active : pump_expired + status corrigé', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -5), status: 'active' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual(['pump_expired']);
    expect(update.pump.status).toBe('expired');
  });

  it('pompe à J-1 avec previousRemainingDays=2 : franchissement seulement si > 30, donc rien pour le seuil — mais expire dans 1 j donc pas expired', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 1), status: 'active' });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 2,
      nowUtc: NOW,
    });
    expect(update.events).toEqual([]);
    expect(update.pump.status).toBe('active');
  });

  it('pompe déjà en status expired : pas d événement (état final)', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -10), status: 'expired' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual([]);
    expect(update.pump).toBe(pump);
  });

  it('pompe archived à J+5 : pas de transition vers expired (archived est terminal)', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -5), status: 'archived' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual([]);
    expect(update.pump.status).toBe('archived');
  });

  it('pompe empty à J+5 : pas de transition vers expired (empty est terminal pour le cycle de prise)', () => {
    const pump = makePump({
      expiresAt: offsetDays(NOW, -5),
      status: 'empty',
      dosesRemaining: 0,
    });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.events).toEqual([]);
    expect(update.pump.status).toBe('empty');
  });

  it('expiration : franchissement 30j + expiré ne double pas (expired seul émis)', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -1), status: 'active' });
    const update = evaluatePumpExpiration({
      pump,
      previousRemainingDays: 50,
      nowUtc: NOW,
    });
    expect(update.events).toEqual(['pump_expired']);
  });
});

describe('RM19 — evaluatePumpExpiration — pureté', () => {
  it('ne mute pas la pompe source', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -1), status: 'active' });
    const snapshot = { ...pump };
    evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(pump).toEqual(snapshot);
  });

  it('retourne une nouvelle instance quand le statut change', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, -1), status: 'active' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.pump).not.toBe(pump);
    expect(update.pump.status).toBe('expired');
  });

  it('retourne la même instance quand aucun changement', () => {
    const pump = makePump({ expiresAt: offsetDays(NOW, 100), status: 'active' });
    const update = evaluatePumpExpiration({ pump, nowUtc: NOW });
    expect(update.pump).toBe(pump);
  });
});

describe('RM19 — canUsePumpForDose', () => {
  it('autorise une pompe active', () => {
    const pump = makePump({ status: 'active', expiresAt: offsetDays(NOW, 60) });
    expect(canUsePumpForDose({ pump, nowUtc: NOW })).toBe(true);
  });

  it('autorise une pompe low', () => {
    const pump = makePump({ status: 'low' });
    expect(canUsePumpForDose({ pump, nowUtc: NOW })).toBe(true);
  });

  it('refuse une pompe expired sans justification', () => {
    const pump = makePump({ status: 'expired', expiresAt: offsetDays(NOW, -1) });
    expect(canUsePumpForDose({ pump, nowUtc: NOW })).toBe(false);
  });

  it('autorise une pompe expired avec justification non vide', () => {
    const pump = makePump({ status: 'expired', expiresAt: offsetDays(NOW, -1) });
    expect(
      canUsePumpForDose({
        pump,
        nowUtc: NOW,
        adminForcedJustification: 'ordonnance en renouvellement',
      }),
    ).toBe(true);
  });

  it('refuse avec une justification whitespace (considérée vide)', () => {
    const pump = makePump({ status: 'expired', expiresAt: offsetDays(NOW, -1) });
    expect(canUsePumpForDose({ pump, nowUtc: NOW, adminForcedJustification: '   \t\n' })).toBe(
      false,
    );
  });

  it('refuse une pompe empty (RM7 prend le relais, pas un cas RM19)', () => {
    const pump = makePump({ status: 'empty', dosesRemaining: 0 });
    expect(canUsePumpForDose({ pump, nowUtc: NOW })).toBe(false);
  });

  it('refuse une pompe archived', () => {
    const pump = makePump({ status: 'archived' });
    expect(canUsePumpForDose({ pump, nowUtc: NOW })).toBe(false);
  });

  it('refuse une pompe active mais déjà expirée par la date', () => {
    // La pompe n'a pas encore été "réconciliée" par evaluatePumpExpiration
    // mais son expiresAt est déjà passé : la règle doit traiter le cas.
    const pump = makePump({ status: 'active', expiresAt: offsetDays(NOW, -2) });
    expect(canUsePumpForDose({ pump, nowUtc: NOW })).toBe(false);
  });

  it('autorise une pompe active expirée par la date avec justification Admin', () => {
    const pump = makePump({ status: 'active', expiresAt: offsetDays(NOW, -2) });
    expect(
      canUsePumpForDose({
        pump,
        nowUtc: NOW,
        adminForcedJustification: 'dépannage jusqu à pharmacie',
      }),
    ).toBe(true);
  });
});

describe('RM19 — ensurePumpUsableForDose', () => {
  it('ne lève pas pour une pompe active', () => {
    const pump = makePump({ status: 'active' });
    expect(() => ensurePumpUsableForDose({ pump, nowUtc: NOW })).not.toThrow();
  });

  it('lève RM19_PUMP_EXPIRED pour une pompe expired sans justification', () => {
    const pump = makePump({ status: 'expired', expiresAt: offsetDays(NOW, -1) });
    try {
      ensurePumpUsableForDose({ pump, nowUtc: NOW });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.code).toBe('RM19_PUMP_EXPIRED');
    }
  });

  it('lève RM19_PUMP_EXPIRED pour une pompe active avec date passée sans justification', () => {
    const pump = makePump({ status: 'active', expiresAt: offsetDays(NOW, -5) });
    try {
      ensurePumpUsableForDose({ pump, nowUtc: NOW });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM19_PUMP_EXPIRED');
    }
  });

  it('ne lève pas pour une pompe expired avec justification Admin', () => {
    const pump = makePump({ status: 'expired', expiresAt: offsetDays(NOW, -1) });
    expect(() =>
      ensurePumpUsableForDose({
        pump,
        nowUtc: NOW,
        adminForcedJustification: 'renouvellement prescription',
      }),
    ).not.toThrow();
  });

  it('ne lève PAS RM19 pour une pompe empty ou archived (déléguée à RM7)', () => {
    // RM19 ne doit pas empiler les erreurs avec RM7. Ici, on teste que
    // la fonction ne lève pas RM19_PUMP_EXPIRED pour ces statuts :
    // l'appelant devra consulter RM7 pour avoir le bon code.
    const emptyPump = makePump({ status: 'empty', dosesRemaining: 0 });
    const archivedPump = makePump({ status: 'archived' });
    expect(() => ensurePumpUsableForDose({ pump: emptyPump, nowUtc: NOW })).not.toThrow();
    expect(() => ensurePumpUsableForDose({ pump: archivedPump, nowUtc: NOW })).not.toThrow();
  });

  it('lève avec un contexte riche (pumpId, status, expiresAt, nowUtc)', () => {
    const pump = makePump({
      id: 'pump-42',
      status: 'expired',
      expiresAt: offsetDays(NOW, -3),
    });
    try {
      ensurePumpUsableForDose({ pump, nowUtc: NOW });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const context = (err as DomainError).context;
      expect(context).toBeDefined();
      expect(context?.['pumpId']).toBe('pump-42');
      expect(context?.['status']).toBe('expired');
    }
  });
});
