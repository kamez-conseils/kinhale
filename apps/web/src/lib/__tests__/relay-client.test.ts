import { createRelayClient } from '../relay-client';

class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  url: string;
  private handlers: Record<string, ((e: { data: string }) => void)[]> = {};
  readonly sentMessages: string[] = [];
  closed = false;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, fn: (e: { data: string }) => void): void {
    if (!this.handlers[type]) this.handlers[type] = [];
    this.handlers[type]!.push(fn);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: string): void {
    for (const fn of this.handlers[type] ?? []) {
      fn({ data });
    }
  }
}

let mockWs: MockWebSocket;

beforeAll(() => {
  global.WebSocket = jest.fn().mockImplementation((url: string) => {
    mockWs = new MockWebSocket(url);
    return mockWs;
  }) as unknown as typeof WebSocket;
});

afterAll(() => {
  delete (global as Record<string, unknown>)['WebSocket'];
});

describe('createRelayClient', () => {
  it('construit la bonne URL WebSocket avec le token', () => {
    createRelayClient('tok-abc', jest.fn());
    expect(mockWs.url).toContain('/relay?token=tok-abc');
  });

  it("remplace http par ws dans l'URL", () => {
    createRelayClient('tok-abc', jest.fn());
    expect(mockWs.url).toMatch(/^ws:/);
  });

  it('send émet le JSON avec blobJson et sentAtMs', () => {
    const client = createRelayClient('tok', jest.fn());
    client.send('{"nonce":"aa","ciphertext":"bb"}');
    expect(mockWs.sentMessages).toHaveLength(1);
    const parsed = JSON.parse(mockWs.sentMessages[0]!) as { blobJson: string; sentAtMs: number };
    expect(parsed.blobJson).toBe('{"nonce":"aa","ciphertext":"bb"}');
    expect(typeof parsed.sentAtMs).toBe('number');
  });

  it("n'envoie pas si socket fermé", () => {
    const client = createRelayClient('tok', jest.fn());
    mockWs.readyState = 3; // CLOSED
    client.send('test');
    expect(mockWs.sentMessages).toHaveLength(0);
  });

  it('sendPing émet le JSON du message peer_ping sur la socket (KIN-82 / RM5)', () => {
    const client = createRelayClient('tok', jest.fn());
    client.sendPing({
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab',
      sentAtMs: 1_717_000_000_000,
    });
    expect(mockWs.sentMessages).toHaveLength(1);
    const parsed = JSON.parse(mockWs.sentMessages[0]!) as Record<string, unknown>;
    // Aucun champ santé ne fuite.
    expect(parsed).toEqual({
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab',
      sentAtMs: 1_717_000_000_000,
    });
  });

  it('sendPing est no-op silencieux si socket fermée (retry géré côté watcher + relais)', () => {
    const client = createRelayClient('tok', jest.fn());
    mockWs.readyState = 3; // CLOSED
    client.sendPing({
      type: 'peer_ping',
      pingType: 'dose_recorded',
      doseId: '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab',
      sentAtMs: 1,
    });
    expect(mockWs.sentMessages).toHaveLength(0);
  });

  it('appelle onMessage pour un message valide avec blobJson', () => {
    const handler = jest.fn();
    createRelayClient('tok', handler);
    mockWs.emit('message', JSON.stringify({ blobJson: 'data', seq: 1, sentAtMs: 1000 }));
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ blobJson: 'data', seq: 1, sentAtMs: 1000 }),
    );
  });

  it('ignore les messages sans blobJson', () => {
    const handler = jest.fn();
    createRelayClient('tok', handler);
    mockWs.emit('message', JSON.stringify({ other: 'field' }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignore les messages JSON malformés', () => {
    const handler = jest.fn();
    createRelayClient('tok', handler);
    mockWs.emit('message', 'not-json{{');
    expect(handler).not.toHaveBeenCalled();
  });

  it('close ferme le WebSocket', () => {
    const client = createRelayClient('tok', jest.fn());
    client.close();
    expect(mockWs.closed).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Propagation du signal de déconnexion vers le hook (KIN-69 / E6-S03).
  // ---------------------------------------------------------------------------

  it("appelle onClose quand le WebSocket émet 'close'", () => {
    const onClose = jest.fn();
    createRelayClient('tok', jest.fn(), onClose);
    mockWs.emit('close', '');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("appelle onClose quand le WebSocket émet 'error'", () => {
    const onClose = jest.fn();
    createRelayClient('tok', jest.fn(), onClose);
    mockWs.emit('error', '');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dédoublonne error puis close pour ne déclencher onClose qu'une fois", () => {
    const onClose = jest.fn();
    createRelayClient('tok', jest.fn(), onClose);
    mockWs.emit('error', '');
    mockWs.emit('close', '');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("n'appelle pas onClose après un close volontaire côté client", () => {
    const onClose = jest.fn();
    const client = createRelayClient('tok', jest.fn(), onClose);
    client.close();
    // Les stacks réelles émettent `close` après ws.close() — simulation.
    mockWs.emit('close', '');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fonctionne sans onClose (paramètre optionnel rétrocompatible)', () => {
    expect(() => {
      createRelayClient('tok', jest.fn());
      mockWs.emit('close', '');
    }).not.toThrow();
  });
});
