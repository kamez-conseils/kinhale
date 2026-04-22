import { renderHook, act } from '@testing-library/react-native';

jest.mock('@kinhale/sync');
jest.mock('@kinhale/crypto');

const mockSend = jest.fn();
const mockClose = jest.fn();

jest.mock('../../lib/relay-client', () => ({
  createRelayClient: jest.fn(() => ({
    send: mockSend,
    close: mockClose,
  })),
}));

jest.mock('../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { receiveChanges: jest.Mock }) => unknown) =>
    selector({ receiveChanges: jest.fn() }),
  ),
}));

describe('useRelay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not create client when token is null', () => {
    const { createRelayClient } = jest.requireMock('../../lib/relay-client') as {
      createRelayClient: jest.Mock;
    };
    const { useRelay } = require('../use-relay') as typeof import('../use-relay');
    renderHook(() => useRelay(null, null));
    expect(createRelayClient).not.toHaveBeenCalled();
  });

  it('creates relay client when token is provided', () => {
    const { createRelayClient } = jest.requireMock('../../lib/relay-client') as {
      createRelayClient: jest.Mock;
    };
    const { useRelay } = require('../use-relay') as typeof import('../use-relay');
    renderHook(() => useRelay('my-token', new Uint8Array(32)));
    expect(createRelayClient).toHaveBeenCalledWith('my-token', expect.any(Function));
  });

  it('sendChanges calls send on the relay client', async () => {
    const { useRelay } = require('../use-relay') as typeof import('../use-relay');
    const { result } = renderHook(() => useRelay('my-token', new Uint8Array(32)));
    await act(async () => {
      await result.current.sendChanges([new Uint8Array([1, 2, 3])], new Uint8Array(32));
    });
    expect(mockSend).toHaveBeenCalled();
  });
});
