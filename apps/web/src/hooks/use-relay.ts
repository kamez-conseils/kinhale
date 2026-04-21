import { useEffect, useRef, useCallback } from 'react';
import { decryptChanges, encryptChanges } from '@kinhale/sync';
import type { EncryptedBlob } from '@kinhale/sync';
import { useDocStore } from '../stores/doc-store';
import { createRelayClient, type RelayClient } from '../lib/relay-client';

export interface UseRelayResult {
  sendChanges: (changes: Uint8Array[], groupKey: Uint8Array) => Promise<void>;
}

export function useRelay(token: string | null, groupKey: Uint8Array | null): UseRelayResult {
  const clientRef = useRef<RelayClient | null>(null);
  const receiveChanges = useDocStore((s) => s.receiveChanges);

  useEffect(() => {
    if (token === null || groupKey === null) return;

    const client = createRelayClient(token, async (msg) => {
      try {
        const blob = JSON.parse(msg.blobJson) as EncryptedBlob;
        const changes = await decryptChanges(blob, groupKey);
        receiveChanges(changes);
      } catch {
        // blob corrompu ou mauvaise clé — ignoré
      }
    });
    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [token, groupKey, receiveChanges]);

  const sendChanges = useCallback(async (changes: Uint8Array[], gk: Uint8Array): Promise<void> => {
    if (clientRef.current === null) return;
    const blob = await encryptChanges(changes, gk);
    clientRef.current.send(JSON.stringify(blob));
  }, []);

  return { sendChanges };
}
