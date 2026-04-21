import type { EncryptedBlob } from './encrypt.js';

/**
 * Enveloppe de synchronisation envoyée au relais (WebSocket ou HTTP).
 * Le relais indexe par mailboxId + seq mais ne peut jamais lire blob.
 */
export interface SyncMessage {
  /** Identifiant opaque du groupe/foyer */
  readonly mailboxId: string;
  readonly deviceId: string;
  /** Contenu chiffré : changes Automerge chiffrés XChaCha20 */
  readonly blob: EncryptedBlob;
  /** Numéro de séquence monotone côté émetteur */
  readonly seq: number;
  /** Timestamp d'émission UTC ms */
  readonly sentAtMs: number;
}

export function encodeSyncMessage(msg: SyncMessage): string {
  return JSON.stringify(msg);
}

export function decodeSyncMessage(json: string): SyncMessage {
  const parsed: unknown = JSON.parse(json);
  if (!isSyncMessage(parsed)) {
    throw new Error('sync: message invalide');
  }
  return parsed;
}

function isSyncMessage(v: unknown): v is SyncMessage {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m['mailboxId'] === 'string' &&
    typeof m['deviceId'] === 'string' &&
    typeof m['seq'] === 'number' &&
    typeof m['sentAtMs'] === 'number' &&
    isEncryptedBlob(m['blob'])
  );
}

function isEncryptedBlob(v: unknown): v is EncryptedBlob {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return typeof b['nonce'] === 'string' && typeof b['ciphertext'] === 'string';
}
