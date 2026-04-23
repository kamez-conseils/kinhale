import React from 'react';
import {
  buildSyncMessage,
  consumeSyncMessage,
  createCursor,
  recordSent,
  recordReceived,
  getDocChanges,
} from '@kinhale/sync';
import type { SyncCursor, createDoc } from '@kinhale/sync';
import { createRelayClient } from '../relay-client';
import type { RelayClient, RelayMessage } from '../relay-client';
import { useAuthStore } from '../../stores/auth-store';
import { useDocStore } from '../../stores/doc-store';
import { getGroupKey } from './group-key';

/**
 * Type du document Automerge — dérivé de createDoc pour éviter d'importer
 * directement @automerge/automerge qui est une dépendance transitive.
 */
type KinhaleDocument = ReturnType<typeof createDoc>;

/**
 * Hook qui maintient une connexion WS au relai et synchronise
 * bidirectionnellement le doc Automerge local.
 *
 * - À chaque change local (doc store update) → buildSyncMessage → ws.send
 * - À chaque message reçu → consumeSyncMessage → docStore.receiveChanges
 *
 * Miroir fidèle de apps/web/src/lib/sync/useRelaySync.ts. Aucune dépendance
 * DOM : `createRelayClient` mobile s'appuie sur le WebSocket natif React
 * Native (polyfillé par Expo / Hermes).
 *
 * Le groupKey est dérivé deterministiquement du householdId (v1.0 simplifié).
 * Le cursor garantit l'idempotence (pas de renvoi des mêmes changements).
 *
 * Principe zero-knowledge respecté : le relai ne reçoit que des blobs
 * chiffrés opaques (XChaCha20-Poly1305). Jamais de contenu en clair.
 */
export function useRelaySync(): { connected: boolean } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const deviceId = useAuthStore((s) => s.deviceId);
  const householdId = useAuthStore((s) => s.householdId);
  const doc = useDocStore((s) => s.doc);
  const receiveChanges = useDocStore((s) => s.receiveChanges);

  const [connected, setConnected] = React.useState(false);
  const clientRef = React.useRef<RelayClient | null>(null);
  const cursorRef = React.useRef<SyncCursor>(createCursor());
  const seqRef = React.useRef(0);
  const keyRef = React.useRef<Uint8Array | null>(null);

  // 1. Ouvre la WS quand l'utilisateur est authentifié et que le doc est chargé.
  //    Dépendance sur `doc !== null` (valeur booléenne) pour éviter de rouvrir
  //    la connexion à chaque mutation du doc.
  React.useEffect(() => {
    if (accessToken === null || deviceId === null || householdId === null || doc === null) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      const groupKey = await getGroupKey(householdId);
      if (cancelled) return;

      keyRef.current = groupKey;

      const client = createRelayClient(accessToken, async (msg: RelayMessage) => {
        if (keyRef.current === null) return;
        const currentDoc = useDocStore.getState().doc;
        if (currentDoc === null) return;

        try {
          const typedDoc = currentDoc as KinhaleDocument;
          const newDoc = await consumeSyncMessage(typedDoc, msg.blobJson, keyRef.current);
          // Extraire uniquement le delta pour éviter de re-persister des
          // changements déjà présents dans le doc local.
          const deltaChanges = getDocChanges(typedDoc, newDoc);
          if (deltaChanges.length > 0) {
            receiveChanges(deltaChanges);
            cursorRef.current = recordReceived(cursorRef.current, deltaChanges);
          }
        } catch {
          // Message invalide, corrompu ou clé incorrecte — ignoré silencieusement.
          // Aucune donnée santé dans les logs (principe zero-knowledge).
        }
      });

      clientRef.current = client;
      setConnected(true);
    })();

    return () => {
      cancelled = true;
      clientRef.current?.close();
      clientRef.current = null;
      keyRef.current = null;
      setConnected(false);
    };
  }, [accessToken, deviceId, householdId, doc !== null, receiveChanges]); // doc !== null intentionnel : on ne veut pas rouvrir la WS à chaque mutation du doc

  // 2. Sur chaque mutation du doc local, construire et pousser le delta au relai.
  React.useEffect(() => {
    if (
      doc === null ||
      clientRef.current === null ||
      keyRef.current === null ||
      deviceId === null ||
      householdId === null
    ) {
      return;
    }

    // Calcule le delta depuis le dernier envoi (ou doc complet si jamais envoyé).
    const typedDoc = doc as KinhaleDocument;
    const before = cursorRef.current.lastSentDoc ?? typedDoc;

    const localKey = keyRef.current;
    const localClient = clientRef.current;
    const localSeq = ++seqRef.current;

    void (async () => {
      const msg = await buildSyncMessage(before, typedDoc, localKey, {
        mailboxId: householdId,
        deviceId,
        seq: localSeq,
      });
      if (msg !== null) {
        localClient.send(msg);
        cursorRef.current = recordSent(cursorRef.current, typedDoc);
      }
    })();
  }, [doc, deviceId, householdId]);

  return { connected };
}
