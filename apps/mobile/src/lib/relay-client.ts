import type { PeerPingMessage } from '@kinhale/sync';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

function toWsUrl(url: string): string {
  return url.replace(/^https/, 'wss').replace(/^http/, 'ws');
}

export interface RelayMessage {
  blobJson: string;
  seq: number;
  sentAtMs: number;
}

export type RelayMessageHandler = (msg: RelayMessage) => void | Promise<void>;

export interface RelayClient {
  send(blobJson: string): void;
  /**
   * Envoie un `peer_ping` typé au relais (RM5, ADR-D11). No-op silencieux
   * si la WS n'est pas OPEN — la retransmission est assurée par
   * `usePeerDosePing` + dédup Redis côté relais.
   */
  sendPing(ping: PeerPingMessage): void;
  close(): void;
}

export function createRelayClient(
  token: string,
  onMessage: RelayMessageHandler,
  onClose?: () => void,
): RelayClient {
  const url = `${toWsUrl(API_URL)}/relay?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  // Garde-fou contre les doubles signaux : certaines piles WS émettent
  // `error` puis `close` pour une même rupture. Un `client.close()` explicite
  // doit également inhiber `onClose`, sinon le hook relancerait une boucle
  // de reconnexion pour une fermeture voulue côté app.
  let closedSignaled = false;
  const signalClose = (): void => {
    if (closedSignaled) return;
    closedSignaled = true;
    onClose?.();
  };

  ws.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as Record<string, unknown>)['blobJson'] !== 'string'
      ) {
        return;
      }
      void onMessage(parsed as RelayMessage);
    } catch {
      // message malformé — ignoré silencieusement
    }
  });

  ws.addEventListener('close', signalClose);
  ws.addEventListener('error', signalClose);

  return {
    send(blobJson: string): void {
      // 1 === WebSocket.OPEN — comparaison sur la constante numérique pour compatibilité test/mock
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ blobJson, sentAtMs: Date.now() }));
      }
    },
    sendPing(ping: PeerPingMessage): void {
      if (ws.readyState !== 1) return;
      ws.send(JSON.stringify(ping));
    },
    close(): void {
      // Inhibe `onClose` avant d'appeler `ws.close()` : une fermeture
      // volontaire n'est pas une déconnexion à réparer.
      closedSignaled = true;
      ws.close();
    },
  };
}
