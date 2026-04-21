import { getSodium } from '../sodium.js';

export interface SigningKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export async function generateSigningKeypair(): Promise<SigningKeypair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_sign_keypair();
  return { publicKey: kp.publicKey, secretKey: kp.privateKey };
}

export async function sign(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_sign_detached(message, secretKey);
}

export async function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  const sodium = await getSodium();
  try {
    return sodium.crypto_sign_verify_detached(signature, message, publicKey);
  } catch {
    return false;
  }
}
