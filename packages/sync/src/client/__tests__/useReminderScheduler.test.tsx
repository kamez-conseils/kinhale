/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReminderScheduler } from '../useReminderScheduler.js';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import type { PlanUpdatedPayload, DoseAdministeredPayload } from '../../events/types.js';

function planEvent(
  payload: Partial<PlanUpdatedPayload> = {},
  occurredAtMs = 1000,
  id = 'evt-plan',
): SignedEventRecord {
  const p: PlanUpdatedPayload = {
    planId: 'plan-1',
    pumpId: 'pump-1',
    scheduledHoursUtc: [8, 20],
    startAtMs: 0,
    endAtMs: null,
    ...payload,
  };
  return {
    id,
    type: 'PlanUpdated',
    payloadJson: JSON.stringify(p),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs,
  };
}

function doseEvent(payload: Partial<DoseAdministeredPayload>): SignedEventRecord {
  const p: DoseAdministeredPayload = {
    doseId: 'dose-1',
    pumpId: 'pump-1',
    childId: 'child-1',
    caregiverId: 'cg-1',
    administeredAtMs: 0,
    doseType: 'maintenance',
    dosesAdministered: 1,
    symptoms: [],
    circumstances: [],
    freeFormTag: null,
    ...payload,
  };
  return {
    id: `evt-${p.doseId}`,
    type: 'DoseAdministered',
    payloadJson: JSON.stringify(p),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs: p.administeredAtMs,
  };
}

function makeDoc(events: SignedEventRecord[]): KinhaleDoc {
  return { householdId: 'hh-1', events };
}

let doc: KinhaleDoc | null;
let schedule: Mock;
let cancel: Mock;
let now: Date;

function buildDeps() {
  return {
    useDoc: () => doc,
    scheduleLocalNotification: schedule as unknown as (args: {
      id: string;
      triggerAtUtc: string;
      title: string;
      body: string;
    }) => Promise<void>,
    cancelLocalNotification: cancel as unknown as (id: string) => Promise<void>,
    now: () => now,
    reminderTitle: 'Kinhale',
    reminderBody: 'Prise prévue',
  };
}

beforeEach(() => {
  doc = null;
  schedule = vi.fn(async () => undefined);
  cancel = vi.fn(async () => undefined);
  now = new Date('2026-04-22T00:00:00.000Z');
});

describe('useReminderScheduler', () => {
  it('no-op si le doc est null', async () => {
    renderHook(() => useReminderScheduler(buildDeps()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('programme une notification par créneau projeté au premier rendu', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    renderHook(() => useReminderScheduler(buildDeps()));
    await act(async () => {
      await Promise.resolve();
    });
    // 48h × 1 créneau = 2 notifs programmées.
    expect(schedule).toHaveBeenCalledTimes(2);
    const first = schedule.mock.calls[0]?.[0] as {
      id: string;
      triggerAtUtc: string;
      title: string;
      body: string;
    };
    expect(first.id.startsWith('r:plan-1:')).toBe(true);
    expect(first.triggerAtUtc).toBe('2026-04-22T08:00:00.000Z');
    expect(first.title).toBe('Kinhale');
    expect(first.body).toBe('Prise prévue');
  });

  it('ne reprogramme pas un rappel déjà connu quand le doc ne change pas', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const { rerender } = renderHook(() => useReminderScheduler(buildDeps()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(schedule).toHaveBeenCalledTimes(2);

    // Rerender sans changer le doc → aucune nouvelle programmation.
    await act(async () => {
      rerender();
      await Promise.resolve();
    });
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('annule les rappels retirés du plan à la nouvelle projection', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8, 20] })]);
    const { rerender } = renderHook(() => useReminderScheduler(buildDeps()));
    await act(async () => {
      await Promise.resolve();
    });
    // 48h × 2 créneaux = 4 notifs.
    expect(schedule).toHaveBeenCalledTimes(4);

    // Nouveau plan : seulement [8], même pompe. On retire les 20h.
    doc = makeDoc([
      planEvent({ scheduledHoursUtc: [8, 20] }, 1000, 'evt-old'),
      planEvent({ scheduledHoursUtc: [8] }, 2000, 'evt-new'),
    ]);
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    // Annulation des 2 créneaux à 20h.
    expect(cancel).toHaveBeenCalledTimes(2);
    const cancelledIds = cancel.mock.calls.map((c) => c[0] as string);
    expect(cancelledIds.every((id) => id.includes('T20:00:00'))).toBe(true);
  });

  it('annule un rappel devenu confirmé par une dose dans la fenêtre', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const { rerender } = renderHook(() => useReminderScheduler(buildDeps()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(schedule).toHaveBeenCalledTimes(2);

    // Ajoute une dose dans la fenêtre du 2026-04-22T08:00.
    doc = makeDoc([
      planEvent({ scheduledHoursUtc: [8] }),
      doseEvent({
        doseId: 'dose-1',
        administeredAtMs: new Date('2026-04-22T08:05:00.000Z').getTime(),
      }),
    ]);
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    // Le rappel T=08:00 du 22 doit avoir été annulé.
    expect(cancel).toHaveBeenCalledTimes(1);
    const cancelledId = cancel.mock.calls[0]?.[0] as string;
    expect(cancelledId).toContain('2026-04-22T08:00:00');
  });

  it('annule toutes les notifs programmées au démontage', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const { unmount } = renderHook(() => useReminderScheduler(buildDeps()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(schedule).toHaveBeenCalledTimes(2);

    act(() => {
      unmount();
    });

    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('respecte horizonMs custom', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8, 20] })]);
    renderHook(() =>
      useReminderScheduler({
        ...buildDeps(),
        horizonMs: 24 * 60 * 60 * 1000, // 24h
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    // Sur 24h : 08:00 + 20:00 = 2 créneaux.
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('hydrate scheduledIds depuis l’OS au montage et ne reprogramme pas ces ids', async () => {
    // Simule un remount : 2 des 3 ids projetés sont déjà programmés côté OS.
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    // Calcule les ids projetés manuellement pour pouvoir en pré-remplir l'OS.
    const alreadyScheduled = ['r:plan-1:2026-04-22T08:00:00.000Z'];
    const hydrate = vi.fn(async () => alreadyScheduled);

    renderHook(() =>
      useReminderScheduler({
        ...buildDeps(),
        hydrateScheduledIds: hydrate,
      }),
    );
    // Laisse le Promise d'hydratation se résoudre + la prochaine passe de diff.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(hydrate).toHaveBeenCalledTimes(1);
    // 48h × 1 créneau = 2 notifs projetées ; 1 déjà en OS → 1 seule à programmer.
    expect(schedule).toHaveBeenCalledTimes(1);
    const scheduledId = schedule.mock.calls[0]?.[0] as { id: string };
    expect(scheduledId.id).toBe('r:plan-1:2026-04-23T08:00:00.000Z');
  });

  it('continue best-effort si hydrateScheduledIds rejette', async () => {
    doc = makeDoc([planEvent({ scheduledHoursUtc: [8] })]);
    const hydrate = vi.fn(async () => {
      throw new Error('native module not ready');
    });

    renderHook(() =>
      useReminderScheduler({
        ...buildDeps(),
        hydrateScheduledIds: hydrate,
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Set vide en cas d'échec → toutes les notifs sont programmées (2 sur 48h).
    expect(schedule).toHaveBeenCalledTimes(2);
  });
});
