import { describe, expect, it } from 'vitest';
import type { Reminder } from '../entities/reminder';
import {
  detectMissedReminders,
  MISSED_DOSE_CLOCK_SKEW_BUFFER_MS,
  MISSED_ELIGIBLE_STATUSES,
} from './rm25-missed-dose';

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    planId: 'plan-1',
    targetAtUtc: '2026-04-22T08:00:00.000Z',
    windowStartUtc: '2026-04-22T07:55:00.000Z',
    windowEndUtc: '2026-04-22T08:30:00.000Z',
    status: 'scheduled',
    ...overrides,
  };
}

describe('RM25 — detectMissedReminders', () => {
  const NOW_BEFORE = new Date('2026-04-22T07:50:00.000Z'); // avant la fenêtre
  const NOW_IN_WINDOW = new Date('2026-04-22T08:10:00.000Z'); // dans la fenêtre
  const NOW_AT_END = new Date('2026-04-22T08:30:00.000Z'); // borne stricte
  const NOW_AFTER = new Date('2026-04-22T08:45:00.000Z'); // après la fenêtre

  it('retourne un tableau vide si aucun rappel fourni', () => {
    expect(detectMissedReminders([], NOW_AFTER)).toEqual([]);
  });

  it('ignore un rappel dont la fenêtre n’est pas encore passée (avant)', () => {
    const reminder = makeReminder({ status: 'scheduled' });
    expect(detectMissedReminders([reminder], NOW_BEFORE)).toEqual([]);
  });

  it('ignore un rappel dans sa fenêtre', () => {
    const reminder = makeReminder({ status: 'scheduled' });
    expect(detectMissedReminders([reminder], NOW_IN_WINDOW)).toEqual([]);
  });

  it('borne windowEndUtc est exclusive : à T=windowEnd, le rappel reste scheduled', () => {
    const reminder = makeReminder({ status: 'scheduled' });
    expect(detectMissedReminders([reminder], NOW_AT_END)).toEqual([]);
  });

  it('transitionne un rappel `scheduled` à `missed` une fois la fenêtre passée', () => {
    const reminder = makeReminder({ status: 'scheduled' });
    const result = detectMissedReminders([reminder], NOW_AFTER);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('missed');
    expect(result[0]?.id).toBe('r1');
    expect(result[0]?.targetAtUtc).toBe(reminder.targetAtUtc);
  });

  it('transitionne aussi un rappel `sent`', () => {
    const reminder = makeReminder({ status: 'sent' });
    const result = detectMissedReminders([reminder], NOW_AFTER);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('missed');
  });

  it.each(['confirmed', 'missed', 'snoozed', 'cancelled'] as const)(
    'ignore un rappel déjà `%s` même si fenêtre dépassée',
    (status) => {
      const reminder = makeReminder({ status });
      expect(detectMissedReminders([reminder], NOW_AFTER)).toEqual([]);
    },
  );

  it('préserve l’ordre d’entrée et ne mute pas les rappels sources', () => {
    const r1 = makeReminder({ id: 'r1', status: 'scheduled' });
    const r2 = makeReminder({
      id: 'r2',
      status: 'scheduled',
      windowEndUtc: '2026-04-22T09:00:00.000Z',
    });
    const snapshot = JSON.parse(JSON.stringify([r1, r2])) as Reminder[];
    const now = new Date('2026-04-22T09:30:00.000Z');
    const result = detectMissedReminders([r1, r2], now);
    expect(result.map((r) => r.id)).toEqual(['r1', 'r2']);
    // Les originaux ne sont pas mutés.
    expect(r1.status).toBe('scheduled');
    expect(r2.status).toBe('scheduled');
    expect([r1, r2]).toEqual(snapshot);
  });

  it('ignore silencieusement un rappel avec windowEndUtc non parsable', () => {
    const reminder = makeReminder({ windowEndUtc: 'not-a-date' });
    expect(detectMissedReminders([reminder], NOW_AFTER)).toEqual([]);
  });

  it('MISSED_ELIGIBLE_STATUSES = [scheduled, sent]', () => {
    expect(MISSED_ELIGIBLE_STATUSES).toEqual(['scheduled', 'sent']);
  });

  describe('tolérance dérive d’horloge (MISSED_DOSE_CLOCK_SKEW_BUFFER_MS = 120s)', () => {
    it('expose un buffer de 120 000 ms', () => {
      expect(MISSED_DOSE_CLOCK_SKEW_BUFFER_MS).toBe(120_000);
    });

    it('ne bascule pas missed à windowEnd + 60s (dérive potentielle tolérée)', () => {
      const reminder = makeReminder({ status: 'scheduled' });
      const now = new Date(Date.parse(reminder.windowEndUtc) + 60_000);
      expect(detectMissedReminders([reminder], now)).toEqual([]);
    });

    it('ne bascule pas missed exactement à windowEnd + buffer (borne stricte)', () => {
      const reminder = makeReminder({ status: 'scheduled' });
      const now = new Date(Date.parse(reminder.windowEndUtc) + MISSED_DOSE_CLOCK_SKEW_BUFFER_MS);
      expect(detectMissedReminders([reminder], now)).toEqual([]);
    });

    it('bascule missed à windowEnd + buffer + 1s (au-delà du buffer)', () => {
      const reminder = makeReminder({ status: 'scheduled' });
      const now = new Date(
        Date.parse(reminder.windowEndUtc) + MISSED_DOSE_CLOCK_SKEW_BUFFER_MS + 1_000,
      );
      const result = detectMissedReminders([reminder], now);
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('missed');
    });
  });
});
