import type { Doc } from '@automerge/automerge';
import type { KinhaleDoc } from '../doc/schema.js';
import { getDocChanges, mergeChanges } from '../doc/lifecycle.js';
import { encryptChanges, decryptChanges } from './encrypt.js';
import { encodeSyncMessage, decodeSyncMessage } from './message.js';

export interface SyncMeta {
  mailboxId: string;
  deviceId: string;
  seq: number;
}

/**
 * Construit un SyncMessage JSON à envoyer au relais depuis les changements entre
 * `before` et `after`. Retourne `null` si aucun changement (pas d'envoi nécessaire).
 *
 * Pipeline : getDocChanges → encryptChanges → encodeSyncMessage
 */
export async function buildSyncMessage(
  before: Doc<KinhaleDoc>,
  after: Doc<KinhaleDoc>,
  groupKey: Uint8Array,
  meta: SyncMeta,
): Promise<string | null> {
  const changes = getDocChanges(before, after);
  if (changes.length === 0) return null;
  const blob = await encryptChanges(changes, groupKey);
  return encodeSyncMessage({
    mailboxId: meta.mailboxId,
    deviceId: meta.deviceId,
    blob,
    seq: meta.seq,
    sentAtMs: Date.now(),
  });
}

/**
 * Applique un SyncMessage JSON reçu du relais sur un document local.
 * Déchiffre, merge les changements Automerge et retourne le nouveau document.
 *
 * Pipeline : decodeSyncMessage → decryptChanges → mergeChanges
 *
 * @throws Error si le JSON est invalide, la clé incorrecte ou le MAC invalide.
 */
export async function consumeSyncMessage(
  doc: Doc<KinhaleDoc>,
  json: string,
  groupKey: Uint8Array,
): Promise<Doc<KinhaleDoc>> {
  const msg = decodeSyncMessage(json);
  const changes = await decryptChanges(msg.blob, groupKey);
  return mergeChanges(doc, changes);
}
