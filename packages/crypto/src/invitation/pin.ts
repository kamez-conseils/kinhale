import { getSodium } from '../sodium.js';

export async function generatePin(): Promise<string> {
  const sodium = await getSodium();
  return sodium.randombytes_uniform(1_000_000).toString().padStart(6, '0');
}

export async function hashPin(pin: string): Promise<string> {
  const sodium = await getSodium();
  return sodium.crypto_pwhash_str(
    pin,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
  );
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const sodium = await getSodium();
  return sodium.crypto_pwhash_str_verify(hash, pin);
}
