import { getSodium } from '../sodium.js';

export async function secretboxKeygen(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_secretbox_keygen();
}

export async function secretboxNonce(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
}

export async function secretbox(
  plaintext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_secretbox_easy(plaintext, nonce, key);
}

export async function secretboxOpen(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  const result = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  if (!result) throw new Error('crypto: déchiffrement échoué — MAC invalide');
  return result;
}
