import { getSodium } from '../sodium.js';
import type { SigningKeypair } from '../sign/ed25519.js';

export interface KeyExchangeKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SessionKeys {
  sharedRx: Uint8Array;
  sharedTx: Uint8Array;
}

export async function generateKeyExchangeKeypair(): Promise<KeyExchangeKeypair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_kx_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

export async function clientSessionKeys(
  clientKeypair: KeyExchangeKeypair,
  serverPublicKey: Uint8Array,
): Promise<SessionKeys> {
  const sodium = await getSodium();
  const keys = sodium.crypto_kx_client_session_keys(
    clientKeypair.publicKey,
    clientKeypair.privateKey,
    serverPublicKey,
  );
  return { sharedRx: keys.sharedRx, sharedTx: keys.sharedTx };
}

export async function serverSessionKeys(
  serverKeypair: KeyExchangeKeypair,
  clientPublicKey: Uint8Array,
): Promise<SessionKeys> {
  const sodium = await getSodium();
  const keys = sodium.crypto_kx_server_session_keys(
    serverKeypair.publicKey,
    serverKeypair.privateKey,
    clientPublicKey,
  );
  return { sharedRx: keys.sharedRx, sharedTx: keys.sharedTx };
}

/**
 * Convertit un keypair Ed25519 en keypair X25519 (courbe de Montgomery).
 * Transformation mathématique standard utilisée par Signal, MLS, Double Ratchet.
 * Permet à un device d'utiliser une seule seed pour les deux keypairs.
 */
export async function ed25519ToX25519(ed: SigningKeypair): Promise<KeyExchangeKeypair> {
  if (ed.secretKey.byteLength !== 64) {
    throw new Error('ed25519ToX25519: secretKey doit être la clé étendue Ed25519 de 64 octets');
  }
  const sodium = await getSodium();
  const privateKey = sodium.crypto_sign_ed25519_sk_to_curve25519(ed.secretKey);
  const publicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(ed.publicKey);
  return { publicKey, privateKey };
}
