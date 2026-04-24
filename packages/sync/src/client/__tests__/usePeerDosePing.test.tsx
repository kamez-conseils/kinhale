/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KinhaleDoc, SignedEventRecord } from '../../doc/schema.js';
import type { DoseAdministeredPayload } from '../../events/types.js';
import { usePeerDosePing } from '../usePeerDosePing.js';
import { isPeerPingMessage } from '../../peer/peer-ping.js';

// ---------------------------------------------------------------------------
// Fakes plateforme
// ---------------------------------------------------------------------------

const VALID_UUID_A = '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab';
const VALID_UUID_B = 'b2c3d4e5-6789-4abc-8def-0123456789ab';
const VALID_UUID_C = 'c3d4e5f6-7890-4bcd-9ef0-123456789abc';

let fakeDoc: KinhaleDoc | null;
let fakeDeviceId: string | null;
let sendPeerPing: Mock;

function buildDeps() {
  return {
    useDoc: () => fakeDoc,
    useDeviceId: () => fakeDeviceId,
    sendPeerPing,
    now: () => new Date('2026-04-24T10:00:00Z'),
  };
}

function signedDoseEvent(
  eventId: string,
  doseId: string,
  deviceId: string,
  occurredAtMs = 1_717_000_000_000,
  extra: Partial<DoseAdministeredPayload> = {},
): SignedEventRecord {
  const payload: DoseAdministeredPayload = {
    doseId,
    pumpId: extra.pumpId ?? 'pump-1',
    childId: extra.childId ?? 'child-1',
    caregiverId: extra.caregiverId ?? deviceId,
    administeredAtMs: extra.administeredAtMs ?? occurredAtMs,
    doseType: extra.doseType ?? 'maintenance',
    dosesAdministered: extra.dosesAdministered ?? 1,
    symptoms: extra.symptoms ?? [],
    circumstances: extra.circumstances ?? [],
    freeFormTag: extra.freeFormTag ?? null,
  };
  return {
    id: eventId,
    type: 'DoseAdministered',
    payloadJson: JSON.stringify(payload),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId,
    occurredAtMs,
  };
}

function signedFlagEvent(
  eventId: string,
  doseIds: [string, string],
  occurredAtMs = 1_717_100_000_000,
): SignedEventRecord {
  return {
    id: eventId,
    type: 'DoseReviewFlagged',
    payloadJson: JSON.stringify({
      flagId: 'flag-' + eventId,
      doseIds,
      detectedAtMs: occurredAtMs,
    }),
    signerPublicKeyHex: 'a'.repeat(64),
    signatureHex: 'b'.repeat(128),
    deviceId: 'dev-local',
    occurredAtMs,
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('usePeerDosePing', () => {
  beforeEach(() => {
    fakeDoc = null;
    fakeDeviceId = 'dev-local';
    sendPeerPing = vi.fn();
  });

  it('ne fait rien si le doc est null', async () => {
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();
    expect(sendPeerPing).not.toHaveBeenCalled();
  });

  it('ne fait rien si le deviceId est null (non authentifié)', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local')],
    };
    fakeDeviceId = null;
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();
    expect(sendPeerPing).not.toHaveBeenCalled();
  });

  it('émet un peer_ping pour une nouvelle DoseAdministered émise par CE device', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local')],
    };
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();

    expect(sendPeerPing).toHaveBeenCalledTimes(1);
    const ping = sendPeerPing.mock.calls[0]?.[0];
    expect(isPeerPingMessage(ping)).toBe(true);
    expect(ping).toMatchObject({
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: VALID_UUID_A,
    });
  });

  it("n'émet pas de ping pour une DoseAdministered reçue d'un AUTRE device (sync)", async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-peer-other')],
    };
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();
    expect(sendPeerPing).not.toHaveBeenCalled();
  });

  it('dédoublonne : même doseId, plusieurs rerender → un seul ping', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local')],
    };
    const { rerender } = renderHook(() => usePeerDosePing(buildDeps()));
    await flush();
    expect(sendPeerPing).toHaveBeenCalledTimes(1);

    // Forcer un rerender avec un nouveau doc référence mais même événement.
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local')],
    };
    rerender();
    await flush();
    expect(sendPeerPing).toHaveBeenCalledTimes(1);
  });

  it('émet un ping par doseId distinct quand plusieurs nouvelles prises arrivent', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local', 1_717_000_000_000),
        signedDoseEvent('evt-2', VALID_UUID_B, 'dev-local', 1_717_000_010_000),
      ],
    };
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();

    expect(sendPeerPing).toHaveBeenCalledTimes(2);
    const ids = sendPeerPing.mock.calls.map((c) => (c[0] as { doseId: string }).doseId).sort();
    expect(ids).toEqual([VALID_UUID_A, VALID_UUID_B].sort());
  });

  it("filtre les doses reçues d'un autre device dans un lot mixte", async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local'),
        signedDoseEvent('evt-2', VALID_UUID_B, 'dev-peer-other'),
        signedDoseEvent('evt-3', VALID_UUID_C, 'dev-local'),
      ],
    };
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();

    expect(sendPeerPing).toHaveBeenCalledTimes(2);
    const ids = sendPeerPing.mock.calls.map((c) => (c[0] as { doseId: string }).doseId).sort();
    expect(ids).toEqual([VALID_UUID_A, VALID_UUID_C].sort());
  });

  it("n'émet pas de ping pour une dose flagguée `pending_review` (RM6 — autre flux)", async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local'),
        signedDoseEvent('evt-2', VALID_UUID_B, 'dev-local'),
        signedFlagEvent('flag-1', [VALID_UUID_A, VALID_UUID_B]),
      ],
    };
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();
    expect(sendPeerPing).not.toHaveBeenCalled();
  });

  it('remet le doseId en cache si sendPeerPing jette, permettant un retry à la prochaine mutation du doc', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local')],
    };
    sendPeerPing
      .mockImplementationOnce(() => {
        throw new Error('ws not open');
      })
      .mockImplementationOnce(() => undefined);

    const { rerender } = renderHook(() => usePeerDosePing(buildDeps()));
    await flush();
    expect(sendPeerPing).toHaveBeenCalledTimes(1);

    // Nouvelle mutation du doc (nouvelle référence) → l'effet se réexécute,
    // le doseId non-envoyé est retenté.
    fakeDoc = {
      householdId: 'hh-1',
      events: [signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local')],
    };
    rerender();
    await flush();
    expect(sendPeerPing).toHaveBeenCalledTimes(2);
  });

  it('payload ne contient PAS de champs santé (doseType, pumpId, childId, administeredAtMs, symptoms)', async () => {
    fakeDoc = {
      householdId: 'hh-1',
      events: [
        signedDoseEvent('evt-1', VALID_UUID_A, 'dev-local', 1_717_000_000_000, {
          doseType: 'rescue',
          pumpId: 'pump-secret-xyz',
          childId: 'child-confidential',
          symptoms: ['cough', 'wheezing'],
          circumstances: ['night'],
          freeFormTag: 'notes confidentielles',
        }),
      ],
    };
    renderHook(() => usePeerDosePing(buildDeps()));
    await flush();

    expect(sendPeerPing).toHaveBeenCalledTimes(1);
    const ping = sendPeerPing.mock.calls[0]?.[0] as Record<string, unknown>;
    // Invariants RM16 + ADR-D11 : aucune clé santé ne fuite.
    expect(ping).not.toHaveProperty('doseType');
    expect(ping).not.toHaveProperty('pumpId');
    expect(ping).not.toHaveProperty('childId');
    expect(ping).not.toHaveProperty('administeredAtMs');
    expect(ping).not.toHaveProperty('symptoms');
    expect(ping).not.toHaveProperty('circumstances');
    expect(ping).not.toHaveProperty('freeFormTag');
    expect(ping).not.toHaveProperty('caregiverId');
    expect(ping).not.toHaveProperty('householdId');
    expect(ping).not.toHaveProperty('senderDeviceId');
    // Les 4 seules clés légitimes.
    expect(Object.keys(ping).sort()).toEqual(['doseId', 'pingType', 'sentAtMs', 'type']);
  });
});
