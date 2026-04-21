import { getSodium } from '../sodium.js';

export const ARGON2ID_PARAMS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
} as const;

export async function generateSalt(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  outputLen: number,
): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.crypto_pwhash(
    outputLen,
    password,
    salt,
    ARGON2ID_PARAMS.timeCost,
    ARGON2ID_PARAMS.memoryCost * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
