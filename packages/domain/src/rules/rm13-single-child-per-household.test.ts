import { describe, expect, it } from 'vitest';
import type { Child } from '../entities/child';
import { DomainError } from '../errors';
import {
  canAddChild,
  CHILDREN_PER_HOUSEHOLD_LIMIT_V1,
  countChildrenInHousehold,
  ensureCanAddChild,
} from './rm13-single-child-per-household';

function makeChild(overrides: Partial<Child> & { id: string; householdId: string }): Child {
  return {
    firstName: 'Alix',
    birthYear: 2020,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('RM13 — CHILDREN_PER_HOUSEHOLD_LIMIT_V1', () => {
  it('vaut 1 en v1.0 (spec ligne 337)', () => {
    expect(CHILDREN_PER_HOUSEHOLD_LIMIT_V1).toBe(1);
  });
});

describe('RM13 — countChildrenInHousehold', () => {
  it('retourne 0 pour un foyer vide', () => {
    expect(countChildrenInHousehold([], 'h1')).toBe(0);
  });

  it('retourne 1 quand un enfant appartient au foyer demandé', () => {
    const children = [makeChild({ id: 'c1', householdId: 'h1' })];
    expect(countChildrenInHousehold(children, 'h1')).toBe(1);
  });

  it("ne compte pas les enfants d'autres foyers", () => {
    const children = [
      makeChild({ id: 'c1', householdId: 'h1' }),
      makeChild({ id: 'c2', householdId: 'h2' }),
      makeChild({ id: 'c3', householdId: 'h3' }),
    ];
    expect(countChildrenInHousehold(children, 'h1')).toBe(1);
    expect(countChildrenInHousehold(children, 'h2')).toBe(1);
    expect(countChildrenInHousehold(children, 'h-unknown')).toBe(0);
  });

  it('compte plusieurs enfants du même foyer (état incohérent détectable)', () => {
    const children = [
      makeChild({ id: 'c1', householdId: 'h1' }),
      makeChild({ id: 'c2', householdId: 'h1' }),
    ];
    expect(countChildrenInHousehold(children, 'h1')).toBe(2);
  });

  it('est une fonction pure (ne mute pas les entrées)', () => {
    const children: Child[] = [
      makeChild({ id: 'c1', householdId: 'h1' }),
      makeChild({ id: 'c2', householdId: 'h2' }),
    ];
    const snapshot = JSON.stringify(children);
    countChildrenInHousehold(children, 'h1');
    expect(JSON.stringify(children)).toBe(snapshot);
  });
});

describe('RM13 — canAddChild', () => {
  it('autorise un premier enfant dans un foyer vide', () => {
    expect(canAddChild({ existingChildren: [], householdId: 'h1' })).toBe(true);
  });

  it('refuse un deuxième enfant quand le foyer en possède déjà un', () => {
    const existingChildren = [makeChild({ id: 'c1', householdId: 'h1' })];
    expect(canAddChild({ existingChildren, householdId: 'h1' })).toBe(false);
  });

  it('ignore les enfants appartenant à un autre foyer', () => {
    const existingChildren = [
      makeChild({ id: 'c1', householdId: 'h2' }),
      makeChild({ id: 'c2', householdId: 'h3' }),
    ];
    expect(canAddChild({ existingChildren, householdId: 'h1' })).toBe(true);
  });

  it("autorise l'ajout dans un foyer vide même si un enfant existe dans un autre foyer", () => {
    const existingChildren = [makeChild({ id: 'c1', householdId: 'h2' })];
    expect(canAddChild({ existingChildren, householdId: 'h1' })).toBe(true);
  });

  it('refuse si foyer cible contient 1 + autre foyer contient aussi un enfant (isolation)', () => {
    const existingChildren = [
      makeChild({ id: 'c1', householdId: 'h1' }),
      makeChild({ id: 'c2', householdId: 'h2' }),
    ];
    expect(canAddChild({ existingChildren, householdId: 'h1' })).toBe(false);
  });

  it('refuse en cas d’état incohérent (plusieurs enfants dans le même foyer)', () => {
    const existingChildren = [
      makeChild({ id: 'c1', householdId: 'h1' }),
      makeChild({ id: 'c2', householdId: 'h1' }),
    ];
    expect(canAddChild({ existingChildren, householdId: 'h1' })).toBe(false);
  });
});

describe('RM13 — ensureCanAddChild', () => {
  it('ne lève pas pour un foyer vide', () => {
    expect(() => ensureCanAddChild({ existingChildren: [], householdId: 'h1' })).not.toThrow();
  });

  it('lève RM13_CHILD_LIMIT_REACHED quand un enfant existe déjà', () => {
    const existingChildren = [makeChild({ id: 'c1', householdId: 'h1' })];
    try {
      ensureCanAddChild({ existingChildren, householdId: 'h1' });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM13_CHILD_LIMIT_REACHED');
      expect((err as DomainError).context).toEqual({
        householdId: 'h1',
        currentCount: 1,
        limit: CHILDREN_PER_HOUSEHOLD_LIMIT_V1,
      });
    }
  });

  it("ne fuite ni prénom ni id enfant dans le context de l'erreur", () => {
    const existingChildren = [makeChild({ id: 'c-secret', householdId: 'h1', firstName: 'Alice' })];
    try {
      ensureCanAddChild({ existingChildren, householdId: 'h1' });
      expect.fail('should have thrown');
    } catch (err) {
      const ctx = (err as DomainError).context ?? {};
      expect(JSON.stringify(ctx)).not.toContain('c-secret');
      expect(JSON.stringify(ctx)).not.toContain('Alice');
    }
  });

  it('lève aussi en état incohérent (currentCount >= limit)', () => {
    const existingChildren = [
      makeChild({ id: 'c1', householdId: 'h1' }),
      makeChild({ id: 'c2', householdId: 'h1' }),
    ];
    try {
      ensureCanAddChild({ existingChildren, householdId: 'h1' });
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM13_CHILD_LIMIT_REACHED');
      expect((err as DomainError).context).toMatchObject({
        householdId: 'h1',
        currentCount: 2,
        limit: CHILDREN_PER_HOUSEHOLD_LIMIT_V1,
      });
    }
  });

  it('est pur : ne mute pas la liste reçue', () => {
    const existingChildren: Child[] = [makeChild({ id: 'c1', householdId: 'h1' })];
    const snapshot = JSON.stringify(existingChildren);
    try {
      ensureCanAddChild({ existingChildren, householdId: 'h1' });
    } catch {
      // attendu
    }
    expect(JSON.stringify(existingChildren)).toBe(snapshot);
  });
});
