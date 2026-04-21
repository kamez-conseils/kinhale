import { getSodium } from '../sodium.js';
import { deriveKey } from '../kdf/argon2id.js';
import { sha256HexFromString } from '../hash/sha256.js';
import { seedPhraseToBytes } from '../seed/bip39.js';
import { ed25519ToX25519, type KeyExchangeKeypair } from '../kx/x25519.js';
import { toHex } from '../encode/index.js';
import type { SigningKeypair } from '../sign/ed25519.js';

export interface DeviceKeypair {
  signing: SigningKeypair;
  exchange: KeyExchangeKeypair;
}

/**
 * Sel de séparation de domaine pour la dérivation Argon2id du keypair device.
 * = SHA-256("kinhale:device-keypair:v1")[0:16]
 * Calculé une seule fois puis mémoïsé : c'est une constante de domaine.
 */
let _deviceDerivationSalt: Uint8Array | undefined;

async function getDeviceDerivationSalt(): Promise<Uint8Array> {
  if (_deviceDerivationSalt !== undefined) return _deviceDerivationSalt;
  const sodium = await getSodium();
  const hashHex = await sha256HexFromString('kinhale:device-keypair:v1');
  _deviceDerivationSalt = sodium.from_hex(hashHex).slice(0, sodium.crypto_pwhash_SALTBYTES);
  return _deviceDerivationSalt;
}

/**
 * Dérive de manière déterministe le keypair device (Ed25519 + X25519) depuis
 * une phrase mnémonique BIP39 de 24 mots.
 *
 * Pipeline :
 *   seedPhrase → BIP39 entropy (32 bytes)
 *   → Argon2id(entropy_hex, domain_salt) → 32 bytes Ed25519 seed
 *   → crypto_sign_seed_keypair → Ed25519 signing keypair
 *   → ed25519ToX25519 → X25519 exchange keypair
 *
 * @throws Error si `seedPhrase` est une phrase BIP39 invalide.
 */
export async function deriveDeviceKeypair(seedPhrase: string): Promise<DeviceKeypair> {
  const sodium = await getSodium();
  const entropy = seedPhraseToBytes(seedPhrase);
  const salt = await getDeviceDerivationSalt();
  const ed25519Seed = await deriveKey(toHex(entropy), salt, 32);
  const { publicKey, privateKey: secretKey } = sodium.crypto_sign_seed_keypair(ed25519Seed);
  const signing: SigningKeypair = { publicKey, secretKey };
  const exchange = await ed25519ToX25519(signing);
  return { signing, exchange };
}
