const mockClose = jest.fn();
const mockSend = jest.fn();

type CapturedHandler = ((msg: { blobJson: string; seq: number; sentAtMs: number }) => Promise<void>) | undefined;
let capturedHandler: CapturedHandler;

jest.mock('../../lib/relay-client', () => ({
  createRelayClient: jest.fn().mockImplementation(
    (_token: string, handler: CapturedHandler) => {
      capturedHandler = handler;
      return { send: mockSend, close: mockClose };
    },
  ),
}));

const mockReceiveChanges = jest.fn();
jest.mock('../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { receiveChanges: jest.Mock }) => unknown) =>
    selector({ receiveChanges: mockReceiveChanges }),
  ),
}));

const mockDecryptChanges = jest.fn().mockResolvedValue([new Uint8Array([1])]);
const mockEncryptChanges = jest.fn().mockResolvedValue({ nonce: 'aabb', ciphertext: 'ccdd' });

jest.mock('@kinhale/sync', () => ({
  decryptChanges: (...args: unknown[]) => mockDecryptChanges(...args),
  encryptChanges: (...args: unknown[]) => mockEncryptChanges(...args),
}));

import { renderHook, act } from '@testing-library/react';
import { useRelay } from '../use-relay';

describe('useRelay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandler = undefined;
  });

  it('ne se connecte pas si token null', () => {
    const { createRelayClient } = jest.requireMock('../../lib/relay-client') as {
      createRelayClient: jest.Mock;
    };
    renderHook(() => useRelay(null, new Uint8Array(32)));
    expect(createRelayClient).not.toHaveBeenCalled();
  });

  it('ne se connecte pas si groupKey null', () => {
    const { createRelayClient } = jest.requireMock('../../lib/relay-client') as {
      createRelayClient: jest.Mock;
    };
    renderHook(() => useRelay('tok-1', null));
    expect(createRelayClient).not.toHaveBeenCalled();
  });

  it('se connecte quand token et groupKey fournis', () => {
    const { createRelayClient } = jest.requireMock('../../lib/relay-client') as {
      createRelayClient: jest.Mock;
    };
    renderHook(() => useRelay('tok-1', new Uint8Array(32)));
    expect(createRelayClient).toHaveBeenCalledWith('tok-1', expect.any(Function));
  });

  it('déchiffre le message entrant et appelle receiveChanges', async () => {
    renderHook(() => useRelay('tok-1', new Uint8Array(32)));
    await act(async () => {
      await capturedHandler?.({
        blobJson: JSON.stringify({ nonce: 'aa', ciphertext: 'bb' }),
        seq: 1,
        sentAtMs: Date.now(),
      });
    });
    expect(mockDecryptChanges).toHaveBeenCalledWith(
      { nonce: 'aa', ciphertext: 'bb' },
      expect.any(Uint8Array),
    );
    expect(mockReceiveChanges).toHaveBeenCalledWith([new Uint8Array([1])]);
  });

  it('ferme la connexion au démontage', () => {
    const { unmount } = renderHook(() => useRelay('tok-1', new Uint8Array(32)));
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });

  it('sendChanges chiffre et envoie via relay client', async () => {
    const { result } = renderHook(() => useRelay('tok-1', new Uint8Array(32)));
    await act(async () => {
      await result.current.sendChanges([new Uint8Array([10])], new Uint8Array(32));
    });
    expect(mockEncryptChanges).toHaveBeenCalledWith([new Uint8Array([10])], expect.any(Uint8Array));
    expect(mockSend).toHaveBeenCalledWith(JSON.stringify({ nonce: 'aabb', ciphertext: 'ccdd' }));
  });
});
