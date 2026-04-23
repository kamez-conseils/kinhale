/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMissedDoseWatcher } from '../useMissedDoseWatcher.js';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import type { PlanUpdatedPayload } from '../../events/types.js';

function planEvent(payload: Partial<PlanUpdatedPayload> = {}): SignedEventRecord {
  const p: PlanUpdatedPayload = {
    planId: 'plan-1',
    pumpId: 'pump-1',
    scheduledHoursUtc: [8],
    startAtMs: 0,
    endAtMs: null,
    ...payload,
  };
  return {
    id: 'evt-plan',
    type: 'PlanUpdated',
    payloadJson: JSON.stringify(p),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs: 1000,
  };
}

function makeDoc(events: SignedEventRecord[]): KinhaleDoc {
  return { householdId: 'hh-1', events };
}

let doc: KinhaleDoc | null;
let mark: Mock;
let notify: Mock;
let now: Date;

function buildDeps(overrides: Partial<Parameters<typeof useMissedDoseWatcher>[0]> = {}) {
  return {
    useDoc: () => doc,
    markReminderMissed: mark as unknown as (id: string) => void,
    notifyMissedDose: notify as unknown as (args: {
      id: string;
      title: string;
      body: string;
    }) => Promise<void>,
    now: () => now,
    missedDoseTitle: 'Kinhale',
    missedDoseBody: 'Dose non confirmée',
    tickMs: 60_000,
    ...overrides,
  };
}

beforeEach(() => {
  doc = null;
  mark = vi.fn();
  notify = vi.fn(async () => undefined);
  now = new Date('2026-04-22T00:00:00.000Z');
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMissedDoseWatcher', () => {
  it('no-op si le doc est null', async () => {
    renderHook(() => useMissedDoseWatcher(buildDeps()));
    now = new Date('2026-04-22T09:00:00.000Z'); // après la fenêtre du 8h
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mark).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('ne déclenche rien au montage (timer uniquement)', () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    now = new Date('2026-04-22T10:00:00.000Z');
    renderHook(() => useMissedDoseWatcher(buildDeps()));
    expect(mark).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('à un tick avec un rappel dont la fenêtre est passée, marque missed + émet la notif', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    // now initial = 00:00 (fenêtre future) — le premier tick devra le voir passé.
    renderHook(() => useMissedDoseWatcher(buildDeps()));

    // Avance l'horloge simulée à 09:00 (fenêtre 7:55→8:30 dépassée).
    now = new Date('2026-04-22T09:00:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark.mock.calls[0]?.[0]).toContain('2026-04-22T08:00:00');
    expect(notify).toHaveBeenCalledTimes(1);
    const args = notify.mock.calls[0]?.[0] as { id: string; title: string; body: string };
    expect(args.title).toBe('Kinhale');
    expect(args.body).toBe('Dose non confirmée');
  });

  it('ne re-notifie pas le même rappel au tick suivant (dédoublonnage)', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    renderHook(() => useMissedDoseWatcher(buildDeps()));

    now = new Date('2026-04-22T09:00:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(notify).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(notify).toHaveBeenCalledTimes(1); // toujours 1
    expect(mark).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche rien tant que la fenêtre n’est pas passée', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    renderHook(() => useMissedDoseWatcher(buildDeps()));

    now = new Date('2026-04-22T08:10:00.000Z'); // dans la fenêtre
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(mark).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('n’émet pas de notif si notifyMissedDose est absent (mark only)', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const { notifyMissedDose: _notify, ...deps } = buildDeps();
    renderHook(() => useMissedDoseWatcher(deps));

    now = new Date('2026-04-22T09:00:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(mark).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it('clearInterval au démontage', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const { unmount } = renderHook(() => useMissedDoseWatcher(buildDeps()));

    act(() => {
      unmount();
    });

    now = new Date('2026-04-22T09:00:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(120_000); // 2 ticks après unmount
      await Promise.resolve();
    });

    expect(mark).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('tickMs custom raccourcit l’intervalle', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    renderHook(() => useMissedDoseWatcher(buildDeps({ tickMs: 10_000 })));

    now = new Date('2026-04-22T09:00:00.000Z');
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });
    expect(mark).toHaveBeenCalledTimes(1);
  });
});
