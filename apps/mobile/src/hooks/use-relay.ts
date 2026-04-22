import { useEffect, useRef, useCallback } from 'react';
import { encryptChanges, decryptChanges } from '@kinhale/sync';
import type { EncryptedBlob } from '@kinhale/sync';
import { createRelayClient, type RelayClient } from '../lib/relay-client';
import { useDocStore } from '../stores/doc-store';

export interface UseRelayResult {
  sendChanges: (changes: Uint8Array[], groupKey: Uint8Array) => Promise<void>;
}

export function useRelay(token: string | null, groupKey: Uint8Array | null): UseRelayResult {
  const clientRef = useRef<RelayClient | null>(null);
  const receiveChanges = useDocStore((s) => s.receiveChanges);

  useEffect(() => {
    if (token === null) return;

    const client = createRelayClient(token, async (msg) => {
      if (groupKey === null) return;
      try {
        const blob = JSON.parse(msg.blobJson) as EncryptedBlob;
        const changes = await decryptChanges(blob, groupKey);
        receiveChanges(changes);
      } catch {
        // blob malformé ou clé incorrecte — ignoré silencieusement
      }
    });

    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [token, groupKey, receiveChanges]);

  const sendChanges = useCallback(async (changes: Uint8Array[], gk: Uint8Array): Promise<void> => {
    const client = clientRef.current;
    if (client === null) return;
    const blob = await encryptChanges(changes, gk);
    client.send(JSON.stringify(blob));
  }, []);

  return { sendChanges };
}
