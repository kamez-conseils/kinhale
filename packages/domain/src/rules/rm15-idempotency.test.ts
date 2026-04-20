import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  createEmptyIdempotencyRegistry,
  decideIdempotency,
  type IdempotencyRegistry,
  type ProcessedEvent,
  recordProcessedEvent,
} from './rm15-idempotency';

const VALID_UUID_V4_A = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_V4_B = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_UUID_V4_C = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

const BASE = new Date('2026-04-19T08:00:00Z');

function makeEvent(overrides: Partial<ProcessedEvent> & { clientEventId: string }): ProcessedEvent {
  return {
    doseId: 'dose-default',
    recordedAtUtc: BASE,
    ...overrides,
  };
}

describe('RM15 — createEmptyIdempotencyRegistry', () => {
  it('construit un registre vide', () => {
    const registry = createEmptyIdempotencyRegistry();
    expect(registry.events.size).toBe(0);
  });
});

describe('RM15 — decideIdempotency', () => {
  it('retourne process quand le registre est vide', () => {
    const registry = createEmptyIdempotencyRegistry();
    const decision = decideIdempotency(registry, VALID_UUID_V4_A);
    expect(decision).toEqual({ kind: 'process', clientEventId: VALID_UUID_V4_A });
  });

  it('retourne replay quand le clientEventId est déjà connu', () => {
    let registry: IdempotencyRegistry = createEmptyIdempotencyRegistry();
    const processed = makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'dose-42' });
    registry = recordProcessedEvent(registry, processed);

    const decision = decideIdempotency(registry, VALID_UUID_V4_A);
    expect(decision.kind).toBe('replay');
    if (decision.kind === 'replay') {
      expect(decision.existing.doseId).toBe('dose-42');
      expect(decision.existing.clientEventId).toBe(VALID_UUID_V4_A);
    }
  });

  it('retourne process pour un UUID différent', () => {
    let registry: IdempotencyRegistry = createEmptyIdempotencyRegistry();
    registry = recordProcessedEvent(
      registry,
      makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'dose-42' }),
    );

    const decision = decideIdempotency(registry, VALID_UUID_V4_B);
    expect(decision.kind).toBe('process');
  });

  it('lève RM15_INVALID_CLIENT_EVENT_ID sur une chaîne vide', () => {
    const registry = createEmptyIdempotencyRegistry();
    expect(() => decideIdempotency(registry, '')).toThrowError(DomainError);
    try {
      decideIdempotency(registry, '');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM15_INVALID_CLIENT_EVENT_ID');
    }
  });

  it('lève RM15_INVALID_CLIENT_EVENT_ID sur du whitespace pur', () => {
    const registry = createEmptyIdempotencyRegistry();
    expect(() => decideIdempotency(registry, '   ')).toThrowError(DomainError);
    try {
      decideIdempotency(registry, '   ');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM15_INVALID_CLIENT_EVENT_ID');
    }
  });

  it('lève RM15_INVALID_CLIENT_EVENT_ID sur un UUID malformé', () => {
    const registry = createEmptyIdempotencyRegistry();
    expect(() => decideIdempotency(registry, 'not-a-uuid')).toThrowError(DomainError);
  });

  it('lève RM15_INVALID_CLIENT_EVENT_ID sur un UUID v1 (mauvaise version)', () => {
    const registry = createEmptyIdempotencyRegistry();
    // UUID v1 : version = 1 (4ème bloc commence par 1)
    expect(() => decideIdempotency(registry, '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toThrowError(
      DomainError,
    );
  });

  it('accepte un UUID v4 en majuscules', () => {
    const registry = createEmptyIdempotencyRegistry();
    const decision = decideIdempotency(registry, VALID_UUID_V4_A.toUpperCase());
    expect(decision.kind).toBe('process');
  });
});

describe('RM15 — recordProcessedEvent', () => {
  it('enregistre un nouvel événement', () => {
    const registry = createEmptyIdempotencyRegistry();
    const event = makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'dose-42' });
    const next = recordProcessedEvent(registry, event);
    expect(next.events.get(VALID_UUID_V4_A)).toEqual(event);
  });

  it('est idempotent : réenregistrer le même événement ne change rien', () => {
    let registry: IdempotencyRegistry = createEmptyIdempotencyRegistry();
    const event = makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'dose-42' });
    registry = recordProcessedEvent(registry, event);
    const sizeAfterFirst = registry.events.size;
    const afterSecond = recordProcessedEvent(registry, event);
    expect(afterSecond.events.size).toBe(sizeAfterFirst);
    expect(afterSecond.events.get(VALID_UUID_V4_A)).toEqual(event);
  });

  it('ne mute pas le registre source (pureté)', () => {
    const registry = createEmptyIdempotencyRegistry();
    const sourceSize = registry.events.size;
    recordProcessedEvent(
      registry,
      makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'dose-42' }),
    );
    expect(registry.events.size).toBe(sourceSize);
  });

  it('accumule plusieurs événements distincts', () => {
    let registry: IdempotencyRegistry = createEmptyIdempotencyRegistry();
    registry = recordProcessedEvent(
      registry,
      makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'd1' }),
    );
    registry = recordProcessedEvent(
      registry,
      makeEvent({ clientEventId: VALID_UUID_V4_B, doseId: 'd2' }),
    );
    registry = recordProcessedEvent(
      registry,
      makeEvent({ clientEventId: VALID_UUID_V4_C, doseId: 'd3' }),
    );
    expect(registry.events.size).toBe(3);
  });

  it('lève RM15_INVALID_CLIENT_EVENT_ID sur clientEventId invalide', () => {
    const registry = createEmptyIdempotencyRegistry();
    expect(() =>
      recordProcessedEvent(registry, makeEvent({ clientEventId: '', doseId: 'd1' })),
    ).toThrowError(DomainError);
  });

  it('normalise la casse : le même UUID en majuscules déclenche la déduplication', () => {
    let registry: IdempotencyRegistry = createEmptyIdempotencyRegistry();
    registry = recordProcessedEvent(
      registry,
      makeEvent({ clientEventId: VALID_UUID_V4_A, doseId: 'd1' }),
    );

    const decision = decideIdempotency(registry, VALID_UUID_V4_A.toUpperCase());
    expect(decision.kind).toBe('replay');
    if (decision.kind === 'replay') {
      expect(decision.existing.doseId).toBe('d1');
    }
  });
});
