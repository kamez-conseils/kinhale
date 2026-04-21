import { secretbox, secretboxOpen, secretboxNonce } from '@kinhale/crypto';

/**
 * Blob chiffré à envoyer au relais.
 * Nonce et ciphertext encodés en hex pour sérialisation JSON.
 */
export interface EncryptedBlob {
  /** Hex, 24 bytes XChaCha20 nonce (48 chars) */
  readonly nonce: string;
  /** Hex, plaintext chiffré + MAC Poly1305 */
  readonly ciphertext: string;
}

/**
 * Chiffre un tableau de Uint8Array (changes Automerge) avec la clé de groupe.
 * Sérialisation : JSON d'un tableau de hex strings, puis XChaCha20-Poly1305.
 */
export async function encryptChanges(
  changes: Uint8Array[],
  groupKey: Uint8Array,
): Promise<EncryptedBlob> {
  const serialized = JSON.stringify(changes.map((c) => Buffer.from(c).toString('hex')));
  const plaintext = new TextEncoder().encode(serialized);
  const nonce = await secretboxNonce();
  const ciphertext = await secretbox(plaintext, nonce, groupKey);
  return {
    nonce: Buffer.from(nonce).toString('hex'),
    ciphertext: Buffer.from(ciphertext).toString('hex'),
  };
}

/**
 * Déchiffre un EncryptedBlob et restitue le tableau de Uint8Array d'origine.
 * Throws si le MAC est invalide (clé incorrecte ou blob corrompu).
 */
export async function decryptChanges(
  blob: EncryptedBlob,
  groupKey: Uint8Array,
): Promise<Uint8Array[]> {
  const nonce = Buffer.from(blob.nonce, 'hex');
  const ciphertext = Buffer.from(blob.ciphertext, 'hex');
  const plaintext = await secretboxOpen(ciphertext, nonce, groupKey);
  const hexArray = JSON.parse(new TextDecoder().decode(plaintext)) as string[];
  return hexArray.map((h) => Buffer.from(h, 'hex'));
}
