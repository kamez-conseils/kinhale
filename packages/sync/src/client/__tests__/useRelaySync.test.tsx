/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KinhaleDoc } from '../../doc/schema.js';
import type * as A from '@automerge/automerge';

// ---------------------------------------------------------------------------
// Mock du module @kinhale/sync (helpers E2EE) — le hook importe depuis '../index.js'.
// On remplace les helpers par des fakes déterministes.
// ---------------------------------------------------------------------------

const mockBuildSyncMessage = vi.fn(
  async (_before: unknown, _after: unknown, _key: Uint8Array, _meta: unknown) =>
    '{"mocked":"blob"}',
);
const mockConsumeSyncMessage = vi.fn(
  async (_doc: unknown, _json: string, _key: Uint8Array) => ({ __mocked: true }),
);
const mockCreateCursor = vi.fn(() => ({
  lastSentDoc: null,
  knownHeads: [],
  receivedCount: 0,
}));
const mockRecordSent = vi.fn((cursor: unknown, _doc: unknown) => cursor);
const mockRecordReceived = vi.fn((cursor: unknown, _changes: unknown) => cursor);

vi.mock('../../index.js', () => ({
  buildSyncMessage: (before: unknown, after: unknown, key: Uint8Array, meta: unknown) =>
    mockBuildSyncMessage(before, after, key, meta),
  consumeSyncMessage: (doc: unknown, json: string, key: Uint8Array) =>
    mockConsumeSyncMessage(doc, json, key),
  createCursor: () => mockCreateCursor(),
  recordSent: (cursor: unknown, doc: unknown) => mockRecordSent(cursor, doc),
  recordReceived: (cursor: unknown, changes: unknown) => mockRecordReceived(cursor, changes),
  // getDocChanges retourne un tableau vide — aucun delta à merger
  getDocChanges: vi.fn(() => [] as Uint8Array[]),
}));

// Import APRÈS vi.mock — hoisting vitest est garanti.
import { useRelaySync } from '../useRelaySync.js';
import type { RelayClient, RelayMessageHandler } from '../useRelaySync.js';

// ---------------------------------------------------------------------------
// État plateforme simulé — injecté via deps du hook.
// ---------------------------------------------------------------------------

type FakeDoc = A.Doc<KinhaleDoc>;

let fakeAuth: {
  accessToken: string | null;
  deviceId: string | null;
  householdId: string | null;
};
let fakeDoc: FakeDoc | null;
let fakeReceiveChanges: Mock;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake doc opaque pour les tests : pas d'impact prod
const makeFakeDoc = (payload: Record<string, unknown>): FakeDoc => payload as any;

const mockRelayClient: RelayClient & { send: Mock; close: Mock } = {
  send: vi.fn(),
  close: vi.fn(),
};

let capturedOnMessage: RelayMessageHandler | null = null;

const mockCreateRelayClient = vi.fn((_token: string, onMessage: RelayMessageHandler) => {
  capturedOnMessage = onMessage;
  return mockRelayClient;
});

const mockDeriveGroupKey = vi.fn(async (_householdId: string) => new Uint8Array(32).fill(1));

function buildDeps() {
  return {
    useAccessToken: () => fakeAuth.accessToken,
    useDeviceId: () => fakeAuth.deviceId,
    useHouseholdId: () => fakeAuth.householdId,
    useDoc: () => fakeDoc,
    getDocSnapshot: () => fakeDoc,
    useReceiveChanges: () => fakeReceiveChanges,
    createRelayClient: mockCreateRelayClient,
    deriveGroupKey: mockDeriveGroupKey,
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

async function flushPromises(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRelaySync (package client)', () => {
  beforeEach(() => {
    fakeAuth = { accessToken: null, deviceId: null, householdId: null };
    fakeDoc = null;
    fakeReceiveChanges = vi.fn();
    capturedOnMessage = null;
    mockRelayClient.send.mockClear();
    mockRelayClient.close.mockClear();
    mockBuildSyncMessage.mockClear();
    mockConsumeSyncMessage.mockClear();
    mockCreateRelayClient.mockClear();
    mockDeriveGroupKey.mockClear();
  });

  it('ne se connecte pas si accessToken est null', async () => {
    await act(async () => {
      renderHook(() => useRelaySync(buildDeps()));
      await flushPromises();
    });

    expect(mockCreateRelayClient).not.toHaveBeenCalled();
  });

  it('ne se connecte pas si le doc est null même avec token valide', async () => {
    setAuthenticated();
    // fakeDoc reste null

    await act(async () => {
      renderHook(() => useRelaySync(buildDeps()));
      await flushPromises();
    });

    expect(mockCreateRelayClient).not.toHaveBeenCalled();
  });

  it('appelle createRelayClient avec le bon token quand authentifié + doc chargé', async () => {
    setAuthenticated();
    setDocLoaded();

    await act(async () => {
      renderHook(() => useRelaySync(buildDeps()));
      await flushPromises();
    });

    expect(mockCreateRelayClient).toHaveBeenCalledWith('tok-test', expect.any(Function));
  });

  it('retourne connected:true après que la WS est ouverte', async () => {
    setAuthenticated();
    setDocLoaded();

    const { result } = renderHook(() => useRelaySync(buildDeps()));

    expect(result.current.connected).toBe(false);

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.connected).toBe(true);
  });

  it('ferme la WS au démontage', async () => {
    setAuthenticated();
    setDocLoaded();

    const { unmount } = renderHook(() => useRelaySync(buildDeps()));

    await act(async () => {
      await flushPromises();
    });

    act(() => {
      unmount();
    });

    expect(mockRelayClient.close).toHaveBeenCalledTimes(1);
  });

  it('propage les changes locaux au relai via client.send quand le doc change après connexion', async () => {
    setAuthenticated();
    setDocLoaded();

    const { rerender } = renderHook(() => useRelaySync(buildDeps()));

    // Attend que la connexion WS soit établie (deriveGroupKey async).
    await act(async () => {
      await flushPromises();
    });

    // Simule un changement de doc : nouvel objet.
    fakeDoc = makeFakeDoc({ householdId: 'household-001', events: [{ id: 'evt-1' }] });

    await act(async () => {
      rerender();
      await flushPromises();
    });

    expect(mockBuildSyncMessage).toHaveBeenCalled();
    expect(mockRelayClient.send).toHaveBeenCalledWith('{"mocked":"blob"}');
  });

  it('applique les changes reçus du relai via receiveChanges', async () => {
    setAuthenticated();
    setDocLoaded();

    // Simule un delta non vide (1 change reçu).
    const syncIndex = await import('../../index.js');
    vi.mocked(syncIndex.getDocChanges).mockReturnValueOnce([new Uint8Array([1, 2, 3])]);

    renderHook(() => useRelaySync(buildDeps()));

    await act(async () => {
      await flushPromises();
    });

    // Le handler onMessage a été capturé à l'ouverture de la WS.
    expect(capturedOnMessage).not.toBeNull();

    await act(async () => {
      await capturedOnMessage?.({ blobJson: '{"blob":"x"}', seq: 1, sentAtMs: 0 });
      await flushPromises();
    });

    expect(fakeReceiveChanges).toHaveBeenCalledTimes(1);
    expect(mockRecordReceived).toHaveBeenCalled();
  });

  it('ignore silencieusement les messages dont le déchiffrement échoue', async () => {
    setAuthenticated();
    setDocLoaded();

    mockConsumeSyncMessage.mockRejectedValueOnce(new Error('decrypt failed'));

    renderHook(() => useRelaySync(buildDeps()));

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await capturedOnMessage?.({ blobJson: '{"tampered":true}', seq: 1, sentAtMs: 0 });
      await flushPromises();
    });

    expect(fakeReceiveChanges).not.toHaveBeenCalled();
  });
});
