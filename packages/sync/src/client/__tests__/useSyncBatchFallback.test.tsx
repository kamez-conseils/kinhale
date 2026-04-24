/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KinhaleDoc } from '../../doc/schema.js';
import type * as A from '@automerge/automerge';

// ---------------------------------------------------------------------------
// Mock du module @kinhale/sync (helpers E2EE) — le hook importe depuis
// '../../index.js'. On remplace buildSyncMessage par un fake déterministe.
// ---------------------------------------------------------------------------

const mockBuildSyncMessage = vi.fn(
  async (_before: unknown, _after: unknown, _key: Uint8Array, _meta: unknown) =>
    '{"mocked":"blob"}' as string | null,
);

vi.mock('../../index.js', () => ({
  buildSyncMessage: (before: unknown, after: unknown, key: Uint8Array, meta: unknown) =>
    mockBuildSyncMessage(before, after, key, meta),
}));

// Import APRÈS vi.mock — hoisting vitest est garanti.
import { useSyncBatchFallback } from '../useSyncBatchFallback.js';

// ---------------------------------------------------------------------------
// Fakes plateforme injectés au hook.
// ---------------------------------------------------------------------------

type FakeDoc = A.Doc<KinhaleDoc>;

let fakeAuth: {
  accessToken: string | null;
  deviceId: string | null;
  householdId: string | null;
};
let fakeDoc: FakeDoc | null;
let fakeConnected: boolean;
let fetchBatch: Mock;
let deriveGroupKey: Mock;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake doc opaque
const makeFakeDoc = (payload: Record<string, unknown>): FakeDoc => payload as any;

function buildDeps() {
  return {
    useAccessToken: () => fakeAuth.accessToken,
    useDeviceId: () => fakeAuth.deviceId,
    useHouseholdId: () => fakeAuth.householdId,
    useDoc: () => fakeDoc,
    getDocSnapshot: () => fakeDoc,
    useConnected: () => fakeConnected,
    fetchBatch,
    deriveGroupKey,
  };
}

function setAuthenticated(): void {
  fakeAuth = {
    accessToken: 'tok-test',
    deviceId: 'device-001',
    householdId: 'household-001',
  };
}

function setDocLoaded(): void {
  fakeDoc = makeFakeDoc({ householdId: 'household-001', events: [] });
}

describe('useSyncBatchFallback (package client)', () => {
  beforeEach(() => {
    fakeAuth = { accessToken: null, deviceId: null, householdId: null };
    fakeDoc = null;
    fakeConnected = false;
    mockBuildSyncMessage.mockClear();
    mockBuildSyncMessage.mockImplementation(async () => '{"mocked":"blob"}');
    fetchBatch = vi.fn(async () => ({ accepted: 1, duplicate: false }));
    deriveGroupKey = vi.fn(async () => new Uint8Array(32).fill(1));
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function advanceBy(ms: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('ne fait aucun envoi tant que connected=true', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = true;

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(2 * 60 * 60 * 1000); // 2 h

    expect(fetchBatch).not.toHaveBeenCalled();
  });

  it("ne fait pas d'envoi avant 60 s de déconnexion", async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(59_000);

    expect(fetchBatch).not.toHaveBeenCalled();
  });

  it('déclenche un envoi après exactement 60 s de déconnexion continue', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(60_000);

    expect(fetchBatch).toHaveBeenCalledTimes(1);
    const call = fetchBatch.mock.calls[0]?.[0] as {
      accessToken: string;
      householdId: string;
      messages: Array<{ blobJson: string }>;
    };
    expect(call.accessToken).toBe('tok-test');
    expect(call.householdId).toBe('household-001');
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0]?.blobJson).toBe('{"mocked":"blob"}');
  });

  it("n'envoie rien si buildSyncMessage retourne null (pas de delta)", async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    mockBuildSyncMessage.mockResolvedValueOnce(null);

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(60_000);

    expect(fetchBatch).not.toHaveBeenCalled();
  });

  it('retry après échec avec backoff [60s, 2min, 5min, 15min, 1h]', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    fetchBatch.mockRejectedValue(new Error('network'));

    renderHook(() => useSyncBatchFallback(buildDeps()));

    const expectedDelays = [60_000, 60_000, 120_000, 300_000, 900_000, 3_600_000];
    for (let i = 0; i < expectedDelays.length; i++) {
      await advanceBy((expectedDelays[i] ?? 0) - 1);
      // Pas encore atteint l'échéance.
      expect(fetchBatch).toHaveBeenCalledTimes(i);
      await advanceBy(1);
      // Nouvelle tentative.
      expect(fetchBatch).toHaveBeenCalledTimes(i + 1);
    }
  });

  it('plafonne le retry à 1h pour les tentatives suivantes', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    fetchBatch.mockRejectedValue(new Error('network'));

    renderHook(() => useSyncBatchFallback(buildDeps()));
    // 1er envoi à 60 s + 5 retries (60s, 2min, 5min, 15min, 1h) → 6 appels.
    await advanceBy(60_000);
    await advanceBy(60_000);
    await advanceBy(120_000);
    await advanceBy(300_000);
    await advanceBy(900_000);
    await advanceBy(3_600_000);
    expect(fetchBatch).toHaveBeenCalledTimes(6);

    // 7e tentative doit attendre 1h supplémentaire, pas plus.
    await advanceBy(3_599_999);
    expect(fetchBatch).toHaveBeenCalledTimes(6);
    await advanceBy(1);
    expect(fetchBatch).toHaveBeenCalledTimes(7);
  });

  it('reset compteur de retries après une reconnexion', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    fetchBatch.mockRejectedValueOnce(new Error('network'));

    const { rerender } = renderHook(() => useSyncBatchFallback(buildDeps()));
    // 1er envoi à 60 s → échoue.
    await advanceBy(60_000);
    expect(fetchBatch).toHaveBeenCalledTimes(1);

    // La connexion revient → reset.
    fakeConnected = true;
    rerender();
    await advanceBy(2 * 60 * 60 * 1000); // 2 h de connexion stable
    // Toujours 1 seul appel (pas de retry envoyé pendant qu'on était connecté).
    expect(fetchBatch).toHaveBeenCalledTimes(1);

    // Nouvelle déconnexion → doit repartir à 60 s, pas sur l'ancien palier.
    fakeConnected = false;
    fetchBatch.mockResolvedValueOnce({ accepted: 1, duplicate: false });
    rerender();
    await advanceBy(59_999);
    expect(fetchBatch).toHaveBeenCalledTimes(1);
    await advanceBy(1);
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("n'envoie plus après démontage", async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;

    const { unmount } = renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(30_000);

    act(() => {
      unmount();
    });
    await advanceBy(2 * 60 * 60 * 1000); // 2 h
    expect(fetchBatch).not.toHaveBeenCalled();
  });

  it('génère un Idempotency-Key différent à chaque retry (anti-collision)', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    fetchBatch.mockRejectedValue(new Error('network'));

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(60_000);
    await advanceBy(60_000);

    expect(fetchBatch).toHaveBeenCalledTimes(2);
    const key1 = (fetchBatch.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey;
    const key2 = (fetchBatch.mock.calls[1]?.[0] as { idempotencyKey: string }).idempotencyKey;
    expect(key1).not.toBe(key2);
    // Format UUID v4 (canonique 36 chars avec tirets) ou slug ≥ 16 chars.
    expect(key1.length).toBeGreaterThanOrEqual(16);
  });

  it("ne consomme pas de seq tant que le POST n'a pas réussi (monotonie après échec)", async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    // Premier appel échoue, deuxième réussit.
    fetchBatch.mockRejectedValueOnce(new Error('network'));
    fetchBatch.mockResolvedValueOnce({ accepted: 1, duplicate: false });

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(60_000);
    await advanceBy(60_000);

    expect(fetchBatch).toHaveBeenCalledTimes(2);
    const seq1 = (fetchBatch.mock.calls[0]?.[0] as { messages: Array<{ seq: number }> }).messages[0]
      ?.seq;
    const seq2 = (fetchBatch.mock.calls[1]?.[0] as { messages: Array<{ seq: number }> }).messages[0]
      ?.seq;
    // Les deux tentatives utilisent le même seq : le compteur ne s'incrémente
    // qu'après un POST réussi. Refs: kz-review-KIN-072 §M3.
    expect(seq1).toBe(seq2);
  });

  it('avance le curseur interne après un envoi réussi (ne réenvoie pas le même delta)', async () => {
    setAuthenticated();
    setDocLoaded();
    fakeConnected = false;
    fetchBatch.mockResolvedValue({ accepted: 1, duplicate: false });

    renderHook(() => useSyncBatchFallback(buildDeps()));
    await advanceBy(60_000);
    expect(fetchBatch).toHaveBeenCalledTimes(1);

    // Le doc n'a pas changé depuis l'envoi → aucune nouvelle tentative ne
    // doit être schedulée automatiquement (backoff reset côté succès).
    // Mais le hook reste actif, donc si un nouveau tick arrive, buildSyncMessage
    // doit être appelé avec le doc courant comme `before` (cursor avancé).
    mockBuildSyncMessage.mockClear();
    mockBuildSyncMessage.mockResolvedValueOnce(null); // pas de delta

    // Force un nouveau cycle en passant offline → online → offline.
    fakeConnected = true;
    await advanceBy(1);
    fakeConnected = false;
    await advanceBy(60_000);

    // buildSyncMessage a été rappelé, mais il retourne null → pas d'envoi.
    expect(mockBuildSyncMessage).toHaveBeenCalled();
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });
});
