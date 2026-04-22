import { secretbox, secretboxOpen, secretboxNonce } from '../box/xchacha20.js';
import { toHex, fromHex } from '../encode/index.js';

export interface EncryptedBlob {
  /** nonce hex (24 bytes = 48 chars) */
  nonceHex: string;
  /** ciphertext hex (plaintext + 16 bytes Poly1305 MAC) */
  ciphertextHex: string;
  /** version format — permet migration future */
  version: 1;
}

/**
 * Chiffre un blob (Automerge doc binary) avec XSalsa20-Poly1305 (AEAD).
 * Génère un nonce aléatoire 24 bytes à chaque appel (jamais réutilisé).
 */
export async function encryptDocBlob(
  plaintext: Uint8Array,
  key: Uint8Array,
): Promise<EncryptedBlob> {
  const nonce = await secretboxNonce();
  const ciphertext = await secretbox(plaintext, nonce, key);
  return {
    nonceHex: toHex(nonce),
    ciphertextHex: toHex(ciphertext),
    version: 1,
  };
}

/**
 * Déchiffre et vérifie le MAC. Throw si la clé est fausse, le blob corrompu,
 * ou la version non supportée.
 */
export async function decryptDocBlob(blob: EncryptedBlob, key: Uint8Array): Promise<Uint8Array> {
  if (blob.version !== 1) {
    throw new Error(`storage: version de blob non supportée (${String(blob.version)})`);
  }
  const nonce = fromHex(blob.nonceHex);
  const ciphertext = fromHex(blob.ciphertextHex);
  return secretboxOpen(ciphertext, nonce, key);
}
