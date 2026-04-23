import { renderHook, act } from '@testing-library/react';
import { useRelaySync } from '../useRelaySync';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock group-key : dérive instantanément une clé fixe
jest.mock('../group-key', () => ({
  getGroupKey: jest.fn(async () => new Uint8Array(32).fill(1)),
}));

// Mock @kinhale/sync — pipeline E2EE
// Les types sont explicites pour satisfaire le mode strict TypeScript.
const mockBuildSyncMessage = jest.fn(
  async (_before: unknown, _after: unknown, _key: Uint8Array, _meta: unknown) =>
    '{"mocked":"blob"}',
);
const mockConsumeSyncMessage = jest.fn(async (_doc: unknown, _json: string, _key: Uint8Array) => ({
  __mocked: true,
}));
const mockCreateCursor = jest.fn(() => ({
  lastSentDoc: null,
  knownHeads: [],
  receivedCount: 0,
}));
const mockRecordSent = jest.fn((cursor: unknown, _doc: unknown) => cursor);
const mockRecordReceived = jest.fn((cursor: unknown, _changes: unknown) => cursor);

jest.mock('@kinhale/sync', () => ({
  buildSyncMessage: (before: unknown, after: unknown, key: Uint8Array, meta: unknown) =>
    mockBuildSyncMessage(before, after, key, meta),
  consumeSyncMessage: (doc: unknown, json: string, key: Uint8Array) =>
    mockConsumeSyncMessage(doc, json, key),
  createCursor: () => mockCreateCursor(),
  recordSent: (cursor: unknown, doc: unknown) => mockRecordSent(cursor, doc),
  recordReceived: (cursor: unknown, changes: unknown) => mockRecordReceived(cursor, changes),
  // getDocChanges retourne un tableau vide — aucun delta à merger
  getDocChanges: jest.fn(() => [] as Uint8Array[]),
  // createDoc utilisé pour le type ReturnType<typeof createDoc>
  createDoc: jest.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// État global mutable pour les stores — modifié par chaque test
// ---------------------------------------------------------------------------

let mockAuthState = {
  accessToken: null as string | null,
  deviceId: null as string | null,
  householdId: null as string | null,
};

let mockReceiveChanges = jest.fn();
let mockDocValue: Record<string, unknown> | null = null;

// Capture du handler onMessage injecté dans createRelayClient (utilisé dans tests futurs)
let _capturedOnMessage:
  | ((msg: { blobJson: string; seq: number; sentAtMs: number }) => void)
  | null = null;

const mockRelayClient = {
  send: jest.fn(),
  close: jest.fn(),
};

const mockCreateRelayClient = jest.fn((_token: string, onMessage: unknown) => {
  _capturedOnMessage = onMessage as typeof _capturedOnMessage;
  return mockRelayClient;
});

jest.mock('../../relay-client', () => ({
  createRelayClient: (token: string, onMessage: unknown) => mockCreateRelayClient(token, onMessage),
}));

jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

// Le store doc expose aussi getState() utilisé dans le handler onMessage async.
jest.mock('../../../stores/doc-store', () => ({
  useDocStore: Object.assign(
    (selector: (s: { doc: unknown; receiveChanges: jest.Mock }) => unknown) =>
      selector({ doc: mockDocValue, receiveChanges: mockReceiveChanges }),
    {
      getState: () => ({ doc: mockDocValue, receiveChanges: mockReceiveChanges }),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAuthenticated(): void {
  mockAuthState = {
    accessToken: 'tok-test',
    deviceId: 'device-001',
    householdId: 'household-001',
  };
}

function setDocLoaded(): void {
  mockDocValue = { householdId: 'household-001', events: [] };
}

/** Vide la file de microtasks pour laisser les promises async se résoudre. */
async function flushPromises(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRelaySync', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    mockAuthState = { accessToken: null, deviceId: null, householdId: null };
    mockDocValue = null;
    mockReceiveChanges = jest.fn();
    _capturedOnMessage = null;
    mockRelayClient.send.mockClear();
    mockRelayClient.close.mockClear();
    mockBuildSyncMessage.mockClear();
    mockConsumeSyncMessage.mockClear();
    mockCreateRelayClient.mockClear();
  });

  it('ne se connecte pas si accessToken est null', async () => {
    await act(async () => {
      renderHook(() => useRelaySync());
      await flushPromises();
    });

    expect(mockCreateRelayClient).not.toHaveBeenCalled();
  });

  it('ne se connecte pas si le doc est null même avec token valide', async () => {
    setAuthenticated();
    // mockDocValue reste null

    await act(async () => {
      renderHook(() => useRelaySync());
      await flushPromises();
    });

    expect(mockCreateRelayClient).not.toHaveBeenCalled();
  });

  it('appelle createRelayClient avec le bon token quand authentifié + doc chargé', async () => {
    setAuthenticated();
    setDocLoaded();

    await act(async () => {
      renderHook(() => useRelaySync());
      await flushPromises();
    });

    expect(mockCreateRelayClient).toHaveBeenCalledWith('tok-test', expect.any(Function));
  });

  it('retourne connected:true après que la WS est ouverte', async () => {
    setAuthenticated();
    setDocLoaded();

    const { result } = renderHook(() => useRelaySync());

    // Initialement non connecté
    expect(result.current.connected).toBe(false);

    await act(async () => {
      await flushPromises();
    });

    expect(result.current.connected).toBe(true);
  });

  it('ferme la WS au démontage', async () => {
    setAuthenticated();
    setDocLoaded();

    const { unmount } = renderHook(() => useRelaySync());

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

    // On utilise renderHook avec une valeur initiale et on la change après connexion.
    // Le doc initial sert à établir la connexion.
    // Une mutation (nouveau objet) déclenche le second effet.
    const { rerender } = renderHook(() => useRelaySync());

    // Attendre que la connexion WS soit établie (getGroupKey async)
    await act(async () => {
      await flushPromises();
    });

    // La WS est maintenant ouverte (clientRef.current est set).
    // Simuler un changement de doc : nouvel objet différent.
    mockDocValue = { householdId: 'household-001', events: [{ id: 'evt-1' }] };

    await act(async () => {
      rerender();
      await flushPromises();
    });

    // buildSyncMessage doit avoir été appelé avec le doc courant
    expect(mockBuildSyncMessage).toHaveBeenCalled();
    // Le résultat non-null est envoyé au relay
    expect(mockRelayClient.send).toHaveBeenCalledWith('{"mocked":"blob"}');
  });
});
