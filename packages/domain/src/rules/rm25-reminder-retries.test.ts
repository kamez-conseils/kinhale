import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  nextReminderRetry,
  planReminderRetries,
  REMINDER_RETRY_DELAYS_MS,
} from './rm25-reminder-retries';

const INITIAL = new Date('2026-04-19T08:00:00Z');

function minutesAfter(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

describe('RM25 — constantes', () => {
  it('deux relances : T+15 min push local, T+30 min e-mail', () => {
    expect(REMINDER_RETRY_DELAYS_MS).toEqual([15 * 60_000, 30 * 60_000]);
  });
});

describe('RM25 — planReminderRetries', () => {
  it('construit un plan à 2 relances (push local puis e-mail)', () => {
    const plan = planReminderRetries({
      reminderId: 'r1',
      initialNotifiedAtUtc: INITIAL,
    });
    expect(plan.reminderId).toBe('r1');
    expect(plan.initialNotifiedAtUtc).toEqual(INITIAL);
    expect(plan.retries).toHaveLength(2);
    expect(plan.retries[0]).toEqual({
      step: 1,
      channel: 'local_push',
      scheduledAtUtc: minutesAfter(INITIAL, 15),
    });
    expect(plan.retries[1]).toEqual({
      step: 2,
      channel: 'email_fallback',
      scheduledAtUtc: minutesAfter(INITIAL, 30),
    });
  });

  it('finalMissedAtUtc = instant de la dernière relance (T+30 min)', () => {
    const plan = planReminderRetries({
      reminderId: 'r1',
      initialNotifiedAtUtc: INITIAL,
    });
    expect(plan.finalMissedAtUtc).toEqual(minutesAfter(INITIAL, 30));
  });

  it('ne mute pas la Date fournie', () => {
    const source = new Date(INITIAL.getTime());
    const originalMs = source.getTime();
    planReminderRetries({ reminderId: 'r1', initialNotifiedAtUtc: source });
    expect(source.getTime()).toBe(originalMs);
  });
});

describe('RM25 — nextReminderRetry (déclenchement sur le temps)', () => {
  const plan = planReminderRetries({
    reminderId: 'r1',
    initialNotifiedAtUtc: INITIAL,
  });

  it('nowUtc < T+15 min : rien à faire', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [],
      nowUtc: minutesAfter(INITIAL, 5),
      doseConfirmed: false,
    });
    expect(step).toBeNull();
  });

  it('borne exacte T+15:00.000 (inclusive) : déclenche step 1', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [],
      nowUtc: minutesAfter(INITIAL, 15),
      doseConfirmed: false,
    });
    expect(step?.step).toBe(1);
    expect(step?.channel).toBe('local_push');
  });

  it('T+14:59.999 : pas encore (borne exclusive à l arrière)', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [],
      nowUtc: new Date(INITIAL.getTime() + 15 * 60_000 - 1),
      doseConfirmed: false,
    });
    expect(step).toBeNull();
  });

  it('T+16 min, aucune relance envoyée : step 1', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [],
      nowUtc: minutesAfter(INITIAL, 16),
      doseConfirmed: false,
    });
    expect(step?.step).toBe(1);
  });

  it('T+31 min, step 1 déjà envoyé : step 2 (e-mail)', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [1],
      nowUtc: minutesAfter(INITIAL, 31),
      doseConfirmed: false,
    });
    expect(step?.step).toBe(2);
    expect(step?.channel).toBe('email_fallback');
  });

  it('borne exacte T+30:00.000 (inclusive) avec step 1 envoyé : step 2', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [1],
      nowUtc: minutesAfter(INITIAL, 30),
      doseConfirmed: false,
    });
    expect(step?.step).toBe(2);
  });

  it('T+29:59.999 avec step 1 envoyé : pas encore step 2', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [1],
      nowUtc: new Date(INITIAL.getTime() + 30 * 60_000 - 1),
      doseConfirmed: false,
    });
    expect(step).toBeNull();
  });
});

describe('RM25 — nextReminderRetry (états terminaux)', () => {
  const plan = planReminderRetries({
    reminderId: 'r1',
    initialNotifiedAtUtc: INITIAL,
  });

  it('les 2 relances déjà envoyées : null (épuisé)', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [1, 2],
      nowUtc: minutesAfter(INITIAL, 60),
      doseConfirmed: false,
    });
    expect(step).toBeNull();
  });

  it('dose confirmée entre temps : null même si retry pas encore envoyé', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [],
      nowUtc: minutesAfter(INITIAL, 16),
      doseConfirmed: true,
    });
    expect(step).toBeNull();
  });

  it('dose confirmée après step 1 : plus de step 2', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [1],
      nowUtc: minutesAfter(INITIAL, 35),
      doseConfirmed: true,
    });
    expect(step).toBeNull();
  });

  it('tolérant hors ordre : alreadySentSteps=[2] + temps écoulé => step 1 récupéré', () => {
    const step = nextReminderRetry({
      plan,
      alreadySentSteps: [2],
      nowUtc: minutesAfter(INITIAL, 20),
      doseConfirmed: false,
    });
    expect(step?.step).toBe(1);
  });
});

describe('RM25 — nextReminderRetry (validation entrée)', () => {
  const plan = planReminderRetries({
    reminderId: 'r1',
    initialNotifiedAtUtc: INITIAL,
  });

  it('lève RM25_INVALID_STEP si alreadySentSteps contient une autre valeur', () => {
    expect(() =>
      nextReminderRetry({
        plan,
        // @ts-expect-error test d'une entrée invalide volontairement
        alreadySentSteps: [3],
        nowUtc: minutesAfter(INITIAL, 20),
        doseConfirmed: false,
      }),
    ).toThrowError(DomainError);
    try {
      nextReminderRetry({
        plan,
        // @ts-expect-error test d'une entrée invalide volontairement
        alreadySentSteps: [0],
        nowUtc: minutesAfter(INITIAL, 20),
        doseConfirmed: false,
      });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as DomainError).code).toBe('RM25_INVALID_STEP');
    }
  });

  it('accepte alreadySentSteps=[] ou duplicatas (idempotence)', () => {
    const empty = nextReminderRetry({
      plan,
      alreadySentSteps: [],
      nowUtc: minutesAfter(INITIAL, 16),
      doseConfirmed: false,
    });
    expect(empty?.step).toBe(1);
    const dup = nextReminderRetry({
      plan,
      alreadySentSteps: [1, 1],
      nowUtc: minutesAfter(INITIAL, 31),
      doseConfirmed: false,
    });
    expect(dup?.step).toBe(2);
  });
});
