import { describe, expect, it } from 'vitest';
import { isReminder, REMINDER_STATUSES, type Reminder } from './reminder';

const validReminder: Reminder = {
  id: 'reminder-1',
  planId: 'plan-abc',
  targetAtUtc: '2026-04-22T08:00:00.000Z',
  windowStartUtc: '2026-04-22T07:55:00.000Z',
  windowEndUtc: '2026-04-22T08:30:00.000Z',
  status: 'scheduled',
};

describe('Reminder — REMINDER_STATUSES', () => {
  it('liste tous les statuts légaux (SPECS §3.7)', () => {
    expect(REMINDER_STATUSES).toEqual([
      'scheduled',
      'sent',
      'confirmed',
      'missed',
      'snoozed',
      'cancelled',
    ]);
  });

  it('est gelé comme readonly (annotation type, pas d’immuabilité runtime)', () => {
    // Sanity check sur la cardinalité ; si on modifie l’enum, ce test saute.
    expect(REMINDER_STATUSES).toHaveLength(6);
  });
});

describe('Reminder — isReminder (garde-fou structurel)', () => {
  it('accepte un rappel valide minimal', () => {
    expect(isReminder(validReminder)).toBe(true);
  });

  it('accepte un rappel confirmé avec confirmedByDoseId', () => {
    expect(isReminder({ ...validReminder, status: 'confirmed', confirmedByDoseId: 'dose-7' })).toBe(
      true,
    );
  });

  it('rejette un objet null ou non-objet', () => {
    expect(isReminder(null)).toBe(false);
    expect(isReminder(undefined)).toBe(false);
    expect(isReminder('reminder')).toBe(false);
    expect(isReminder(42)).toBe(false);
  });

  it('rejette un rappel sans id / planId', () => {
    expect(isReminder({ ...validReminder, id: '' })).toBe(false);
    expect(isReminder({ ...validReminder, planId: '' })).toBe(false);
    const { id: _id, ...sansId } = validReminder;
    expect(isReminder(sansId)).toBe(false);
  });

  it('rejette un statut hors énumération', () => {
    expect(isReminder({ ...validReminder, status: 'pending' })).toBe(false);
    expect(isReminder({ ...validReminder, status: 42 })).toBe(false);
  });

  it('rejette des horodatages ISO invalides', () => {
    expect(isReminder({ ...validReminder, targetAtUtc: 'not-a-date' })).toBe(false);
    expect(isReminder({ ...validReminder, windowStartUtc: 'bad' })).toBe(false);
    expect(isReminder({ ...validReminder, windowEndUtc: '' })).toBe(false);
  });

  it('rejette un confirmedByDoseId de type non-string', () => {
    expect(isReminder({ ...validReminder, confirmedByDoseId: 42 })).toBe(false);
  });

  it('accepte confirmedByDoseId absent (optional)', () => {
    // Explicitement absent, pas undefined (exactOptionalPropertyTypes).
    const noDose: Reminder = {
      id: 'r1',
      planId: 'p1',
      targetAtUtc: '2026-04-22T08:00:00Z',
      windowStartUtc: '2026-04-22T07:55:00Z',
      windowEndUtc: '2026-04-22T08:30:00Z',
      status: 'scheduled',
    };
    expect(isReminder(noDose)).toBe(true);
  });
});
