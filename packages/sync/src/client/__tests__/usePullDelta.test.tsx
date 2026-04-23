/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KinhaleDoc } from '../../doc/schema.js';
import type * as A from '@automerge/automerge';

// ---------------------------------------------------------------------------
// Mock du module @kinhale/sync (helpers E2EE).
// ---------------------------------------------------------------------------

const mockConsumeSyncMessage = vi.fn(async (_doc: unknown, _json: string, _key: Uint8Array) => ({
  __mocked: true,
}));
const mockGetDocChanges = vi.fn((_before: unknown, _after: unknown) => [] as Uint8Array[]);

vi.mock('../../index.js', () => ({
  consumeSyncMessage: (doc: unknown, json: string, key: Uint8Array) =>
    mockConsumeSyncMessage(doc, json, key),
  getDocChanges: (before: unknown, after: unknown) => mockGetDocChanges(before, after),
}));

// Import APRÈS vi.mock — hoisting vitest est garanti.
import { usePullDelta } from '../usePullDelta.js';
import type { CatchupResponse, FetchCatchup } from '../usePullDelta.js';

// ---------------------------------------------------------------------------
// État plateforme simulé — injecté via deps du hook.
// ---------------------------------------------------------------------------

type FakeDoc = A.Doc<KinhaleDoc>;

let fakeAuth: {
  accessToken: string | null;
  householdId: string | null;
};
let fakeDoc: FakeDoc | null;
let fakeReceiveChanges: Mock;
let fetchCatchup: Mock<FetchCatchup>;
let loadCursor: Mock<() => Promise<number>>;
let saveCursor: Mock<(n: number) => Promise<void>>;
let deriveGroupKey: Mock<(id: string) => Promise<Uint8Array>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake doc opaque pour les tests : pas d'impact prod
const makeFakeDoc = (payload: Record<string, unknown>): FakeDoc => payload as any;

function buildDeps(overrides: Partial<Parameters<typeof usePullDelta>[0]> = {}) {
  return {
    useAccessToken: () => fakeAuth.accessToken,
    useHouseholdId: () => fakeAuth.householdId,
    useDoc: () => fakeDoc,
    getDocSnapshot: () => fakeDoc,
    useReceiveChanges: () => fakeReceiveChanges,
    fetchCatchup,
    loadCursor,
    saveCursor,
    deriveGroupKey,
    ...overrides,
  };
}

function setAuthenticated(): void {
  fakeAuth = {
    accessToken: 'tok-test',
    householdId: 'household-001',
  };
}

function setDocLoaded(): void {
  fakeDoc = makeFakeDoc({ householdId: 'household-001', events: [] });
}

async function flush(rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

function makeMessage(seq: number): CatchupResponse['messages'][number] {
  return {
    id: `evt-${seq}`,
    senderDeviceId: 'device-X',
    blobJson: `{"seq":${seq}}`,
    seq,
    sentAtMs: seq * 1000,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePullDelta (package client)', () => {
  beforeEach(() => {
    fakeAuth = { accessToken: null, householdId: null };
    fakeDoc = null;
    fakeReceiveChanges = vi.fn();
    mockConsumeSyncMessage.mockClear();
    mockGetDocChanges.mockClear();
    fetchCatchup = vi.fn(async () => ({ messages: [], hasMore: false }));
    loadCursor = vi.fn(async () => 0);
    saveCursor = vi.fn(async () => undefined);
    deriveGroupKey = vi.fn(async () => new Uint8Array(32).fill(1));
  });

  it('ne déclenche aucun pull si pas authentifié', async () => {
    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });
    expect(fetchCatchup).not.toHaveBeenCalled();
    expect(loadCursor).not.toHaveBeenCalled();
  });

  it('ne déclenche aucun pull si le doc est null', async () => {
    setAuthenticated();
    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });
    expect(fetchCatchup).not.toHaveBeenCalled();
  });

  it('appelle fetchCatchup avec le curseur persisté au montage', async () => {
    setAuthenticated();
    setDocLoaded();
    loadCursor.mockResolvedValueOnce(42);

    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });

    expect(loadCursor).toHaveBeenCalledTimes(1);
    expect(fetchCatchup).toHaveBeenCalledWith({
      accessToken: 'tok-test',
      householdId: 'household-001',
      since: 42,
    });
  });

  it('applique les deltas reçus et sauvegarde le dernier seq', async () => {
    setAuthenticated();
    setDocLoaded();
    fetchCatchup.mockResolvedValueOnce({
      messages: [makeMessage(1), makeMessage(2)],
      hasMore: false,
    });
    mockGetDocChanges.mockReturnValueOnce([new Uint8Array([1])]);
    mockGetDocChanges.mockReturnValueOnce([new Uint8Array([2])]);

    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });

    expect(fakeReceiveChanges).toHaveBeenCalledTimes(2);
    expect(saveCursor).toHaveBeenLastCalledWith(2);
  });

  it('ne sauvegarde pas de curseur si fetchCatchup échoue (erreur réseau)', async () => {
    setAuthenticated();
    setDocLoaded();
    loadCursor.mockResolvedValueOnce(10);
    fetchCatchup.mockRejectedValueOnce(new Error('network error'));

    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });

    expect(saveCursor).not.toHaveBeenCalled();
  });

  it('paginate immédiatement si hasMore=true', async () => {
    setAuthenticated();
    setDocLoaded();
    loadCursor.mockResolvedValueOnce(0);
    fetchCatchup
      .mockResolvedValueOnce({ messages: [makeMessage(1)], hasMore: true })
      .mockResolvedValueOnce({ messages: [makeMessage(2)], hasMore: false });

    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });

    expect(fetchCatchup).toHaveBeenCalledTimes(2);
    expect(fetchCatchup).toHaveBeenNthCalledWith(2, {
      accessToken: 'tok-test',
      householdId: 'household-001',
      since: 1,
    });
    expect(saveCursor).toHaveBeenLastCalledWith(2);
  });

  it('sort de la boucle si le relai renvoie {messages:[], hasMore:true} (anti-spin)', async () => {
    setAuthenticated();
    setDocLoaded();
    loadCursor.mockResolvedValueOnce(0);
    // Mock "malveillant/buggé" : toujours hasMore=true mais 0 messages.
    fetchCatchup.mockResolvedValue({ messages: [], hasMore: true });

    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });

    // Un seul appel : le hook doit sortir dès le 1er batch vide au lieu de
    // reboucler à l'infini. Refs: kz-securite-KIN-070 §B1.
    expect(fetchCatchup).toHaveBeenCalledTimes(1);
    expect(saveCursor).not.toHaveBeenCalled();
  });

  it("n'applique ni ne sauvegarde rien si unmount survient pendant qu'un fetch est en vol", async () => {
    setAuthenticated();
    setDocLoaded();
    loadCursor.mockResolvedValueOnce(0);

    // fetchCatchup bloque sur une Promise non résolue : on contrôle
    // manuellement le moment de la résolution pour simuler un unmount
    // qui arrive entre le fetch et l'application des messages.
    let resolvePage1: ((r: CatchupResponse) => void) | null = null;
    fetchCatchup.mockImplementationOnce(
      () =>
        new Promise<CatchupResponse>((r) => {
          resolvePage1 = r;
        }),
    );

    const { unmount } = renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });
    // fetchCatchup a été appelé, mais la Promise est toujours pendante.
    expect(fetchCatchup).toHaveBeenCalledTimes(1);

    // Unmount pendant que le fetch est en vol → cancelled=true + keyRef=null.
    act(() => {
      unmount();
    });

    // On résout maintenant la Promise avec des messages "normaux" : le
    // guard en tête du `for` doit court-circuiter l'application ET empêcher
    // `saveCursor` de persister un curseur fantôme. Refs: kz-review-KIN-070 §M1.
    await act(async () => {
      resolvePage1?.({
        messages: [makeMessage(1), makeMessage(2)],
        hasMore: false,
      });
      await flush();
    });

    expect(fakeReceiveChanges).not.toHaveBeenCalled();
    expect(saveCursor).not.toHaveBeenCalled();
  });

  it('ignore silencieusement un blob qui ne déchiffre pas mais avance le curseur', async () => {
    setAuthenticated();
    setDocLoaded();
    loadCursor.mockResolvedValueOnce(0);
    fetchCatchup.mockResolvedValueOnce({
      messages: [makeMessage(1), makeMessage(2)],
      hasMore: false,
    });
    // Premier blob OK, second rejected.
    mockConsumeSyncMessage.mockResolvedValueOnce({ __mocked: true });
    mockConsumeSyncMessage.mockRejectedValueOnce(new Error('decrypt failed'));
    mockGetDocChanges.mockReturnValueOnce([new Uint8Array([1])]);

    renderHook(() => usePullDelta(buildDeps()));
    await act(async () => {
      await flush();
    });

    expect(fakeReceiveChanges).toHaveBeenCalledTimes(1);
    // Curseur avance malgré l'erreur pour ne pas rester bloqué en boucle.
    expect(saveCursor).toHaveBeenLastCalledWith(2);
  });

  // ---------------------------------------------------------------------------
  // Polling périodique + interactions avec le timer.
  // ---------------------------------------------------------------------------
  describe('polling', () => {
    beforeEach(() => {
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

    it('refetch toutes les 60s par défaut', async () => {
      setAuthenticated();
      setDocLoaded();

      renderHook(() => usePullDelta(buildDeps()));
      await advanceBy(0);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);

      await advanceBy(59_999);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);

      await advanceBy(1);
      expect(fetchCatchup).toHaveBeenCalledTimes(2);

      await advanceBy(60_000);
      expect(fetchCatchup).toHaveBeenCalledTimes(3);
    });

    it('respecte un pollIntervalMs custom', async () => {
      setAuthenticated();
      setDocLoaded();

      renderHook(() => usePullDelta(buildDeps({ pollIntervalMs: 5_000 })));
      await advanceBy(0);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);

      await advanceBy(5_000);
      expect(fetchCatchup).toHaveBeenCalledTimes(2);
    });

    it('stoppe le polling au démontage', async () => {
      setAuthenticated();
      setDocLoaded();

      const { unmount } = renderHook(() => usePullDelta(buildDeps()));
      await advanceBy(0);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);

      act(() => {
        unmount();
      });

      await advanceBy(5 * 60_000);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);
    });

    it('ne déclenche pas de pull concurrent quand un pull est in-flight', async () => {
      setAuthenticated();
      setDocLoaded();
      // fetchCatchup bloque jusqu'à resolvePendingPull.
      let resolvePendingPull: ((r: CatchupResponse) => void) | null = null;
      fetchCatchup.mockImplementation(
        () =>
          new Promise((r) => {
            resolvePendingPull = r;
          }),
      );

      renderHook(() => usePullDelta(buildDeps()));
      await advanceBy(0);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);

      // Le timer ticker plusieurs fois, mais le pull initial n'est pas résolu.
      await advanceBy(3 * 60_000);
      expect(fetchCatchup).toHaveBeenCalledTimes(1);

      // Quand le pull initial se résout, le polling peut reprendre au tick suivant.
      await act(async () => {
        resolvePendingPull?.({ messages: [], hasMore: false });
        await flush();
      });
      await advanceBy(60_000);
      expect(fetchCatchup).toHaveBeenCalledTimes(2);
    });
  });
});
