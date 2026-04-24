/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import type { DoseAdministeredPayload } from '../../events/types.js';
import { useDuplicateDetectionWatcher } from '../useDuplicateDetectionWatcher.js';

// ---------------------------------------------------------------------------
// Fakes plateforme
// ---------------------------------------------------------------------------

let fakeDoc: KinhaleDoc | null;
let flagDuplicatePair: Mock;
let notifyDuplicate: Mock;

function buildDeps() {
  return {
    useDoc: () => fakeDoc,
    flagDuplicatePair,
    notifyDuplicate,
    now: () => new Date('2026-04-24T10:00:00Z'),
    duplicateTitle: 'Kinhale',
    duplicateBody: 'Double saisie détectée',
  };
}

function signedDoseEvent(
  id: string,
  payload: Partial<DoseAdministeredPayload> & { doseId: string },
  occurredAtMs = 1_000_000,
): SignedEventRecord {
  const fullPayload: DoseAdministeredPayload = {
    doseId: payload.doseId,
    pumpId: payload.pumpId ?? 'pump-1',
    childId: payload.childId ?? 'child-1',
    caregiverId: payload.caregiverId ?? 'dev-1',
    administeredAtMs: payload.administeredAtMs ?? occurredAtMs,
    doseType: payload.doseType ?? 'maintenance',
    dosesAdministered: payload.dosesAdministered ?? 1,
    symptoms: payload.symptoms ?? [],
    circumstances: payload.circumstances ?? [],
    freeFormTag: payload.freeFormTag ?? null,
  };
  return {
    id,
    type: 'DoseAdministered',
    payloadJson: JSON.stringify(fullPayload),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs,
  };
}

function signedFlagEvent(
  id: string,
  doseIds: [string, string],
  occurredAtMs = 1_100_000,
): SignedEventRecord {
  return {
    id,
    type: 'DoseReviewFlagged',
    payloadJson: JSON.stringify({
      flagId: 'flag-' + id,
      doseIds,
      detectedAtMs: occurredAtMs,
    }),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-1',
    occurredAtMs,
  };
}

describe('useDuplicateDetectionWatcher', () => {
  beforeEach(() => {
    fakeDoc = null;
    flagDuplicatePair = vi.fn(async () => undefined);
    notifyDuplicate = vi.fn(async () => undefined);
  });

  async function flush(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('ne fait rien si le doc est null', async () => {
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).not.toHaveBeenCalled();
    expect(notifyDuplicate).not.toHaveBeenCalled();
  });

  it('ne flag rien avec une seule dose', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', { doseId: 'd-1' }, 1_000_000)],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).not.toHaveBeenCalled();
  });

  it('ne flag rien si les 2 doses sont séparées de plus de 2 min', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B' }, 1_000_000 + 3 * 60_000),
      ],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).not.toHaveBeenCalled();
    expect(notifyDuplicate).not.toHaveBeenCalled();
  });

  it("flag et notifie quand 2 doses sur la même pompe < 2 min s'enchaînent", async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent(
          'evt-1',
          { doseId: 'd-A', pumpId: 'pump-1', doseType: 'maintenance' },
          1_000_000,
        ),
        signedDoseEvent(
          'evt-2',
          { doseId: 'd-B', pumpId: 'pump-1', doseType: 'maintenance' },
          1_000_000 + 30_000, // 30 s plus tard
        ),
      ],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();

    expect(flagDuplicatePair).toHaveBeenCalledTimes(1);
    const call = flagDuplicatePair.mock.calls[0]?.[0] as { doseIds: [string, string] };
    // Les doseIds doivent être triés (canonicalité pour l'idempotence).
    expect(call.doseIds).toEqual(['d-A', 'd-B']);
    expect(notifyDuplicate).toHaveBeenCalledTimes(1);
  });

  it('ne flag pas les paires sur des pompes différentes', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A', pumpId: 'pump-1' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B', pumpId: 'pump-2' }, 1_000_000 + 30_000),
      ],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).not.toHaveBeenCalled();
  });

  it('ne flag pas les paires de types différents (maintenance vs rescue)', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A', doseType: 'maintenance' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B', doseType: 'rescue' }, 1_000_000 + 30_000),
      ],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).not.toHaveBeenCalled();
  });

  it('ne re-flag pas une paire déjà présente dans le doc (flag antérieur)', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B' }, 1_000_000 + 30_000),
        signedFlagEvent('flag-existing', ['d-A', 'd-B'], 1_100_000),
      ],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).not.toHaveBeenCalled();
    expect(notifyDuplicate).not.toHaveBeenCalled();
  });

  it('flag uniquement 1 fois même si le hook est appelé plusieurs fois avec le même doc (cache local)', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B' }, 1_000_000 + 30_000),
      ],
    };
    const { rerender } = renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).toHaveBeenCalledTimes(1);

    // Force un re-render avec le même doc — le cache local doit inhiber.
    rerender();
    await flush();
    expect(flagDuplicatePair).toHaveBeenCalledTimes(1);
    expect(notifyDuplicate).toHaveBeenCalledTimes(1);
  });

  it('flag une 2e paire distincte quand une nouvelle dose entre en conflit', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B' }, 1_000_000 + 30_000),
      ],
    };
    const { rerender } = renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();
    expect(flagDuplicatePair).toHaveBeenCalledTimes(1);

    // Nouvelle paire apparaît (simulant l'arrivée d'un 3e et 4e event).
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        ...fakeDoc.events,
        signedDoseEvent('evt-3', { doseId: 'd-C' }, 2_000_000),
        signedDoseEvent('evt-4', { doseId: 'd-D' }, 2_000_000 + 60_000),
      ],
    };
    rerender();
    await flush();
    expect(flagDuplicatePair).toHaveBeenCalledTimes(2);
    const secondCall = flagDuplicatePair.mock.calls[1]?.[0] as { doseIds: [string, string] };
    expect(secondCall.doseIds).toEqual(['d-C', 'd-D']);
  });

  it('passe title/body i18n déjà traduits à notifyDuplicate', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', { doseId: 'd-A' }, 1_000_000),
        signedDoseEvent('evt-2', { doseId: 'd-B' }, 1_000_000 + 30_000),
      ],
    };
    renderHook(() => useDuplicateDetectionWatcher(buildDeps()));
    await flush();

    const notifCall = notifyDuplicate.mock.calls[0]?.[0] as {
      id: string;
      title: string;
      body: string;
    };
    expect(notifCall.title).toBe('Kinhale');
    expect(notifCall.body).toBe('Double saisie détectée');
    // id unique/stable par paire pour dédoublonnage OS si la même paire
    // était flaggée plusieurs fois (paranoïaque).
    expect(notifCall.id).toMatch(/^dup:/);
  });
});
