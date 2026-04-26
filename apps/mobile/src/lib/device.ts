import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  ed25519ToX25519,
  generateSigningKeypair,
  randomBytes,
  toHex,
  fromHex,
} from '@kinhale/crypto';
import type { KeyExchangeKeypair } from '@kinhale/crypto';

const DEVICE_PUBKEY_KEY = 'kinhale-device-pubkey';
const DEVICE_SECRET_KEY = 'kinhale-device-secret';
const GROUP_KEY_PREFIX = 'kinhale-groupkey-';

export interface DeviceKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyHex: string;
}

let cachedDevice: DeviceKeypair | null = null;

export async function getOrCreateDevice(): Promise<DeviceKeypair> {
  if (cachedDevice !== null) return cachedDevice;

  const storedPubHex = await AsyncStorage.getItem(DEVICE_PUBKEY_KEY);
  const storedSecretB64 = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);

  if (storedPubHex !== null && storedSecretB64 !== null) {
    try {
      const publicKey = fromHex(storedPubHex);
      const secretKey = new Uint8Array(Buffer.from(storedSecretB64, 'base64'));
      cachedDevice = { publicKey, secretKey, publicKeyHex: storedPubHex };
      return cachedDevice;
    } catch {
      // corrupted — regenerate
    }
  }

  // KIN-024 resolved: secretKey stockée dans iOS Keychain / Android Keystore via expo-secure-store.
  // La clé publique (non-secrète) reste dans AsyncStorage pour la lisibilité.
  const kp = await generateSigningKeypair();
  const publicKeyHex = toHex(kp.publicKey);
  await AsyncStorage.setItem(DEVICE_PUBKEY_KEY, publicKeyHex);
  await SecureStore.setItemAsync(DEVICE_SECRET_KEY, Buffer.from(kp.secretKey).toString('base64'));
  cachedDevice = { publicKey: kp.publicKey, secretKey: kp.secretKey, publicKeyHex };
  return cachedDevice;
}

const groupKeyCache = new Map<string, Uint8Array>();

export async function getGroupKey(householdId: string): Promise<Uint8Array> {
  const hit = groupKeyCache.get(householdId);
  if (hit !== undefined) return hit;

  const storageKey = `${GROUP_KEY_PREFIX}${householdId}`;
  const stored = await SecureStore.getItemAsync(storageKey);
  if (stored !== null) {
    try {
      const key = new Uint8Array(Buffer.from(stored, 'base64'));
      groupKeyCache.set(householdId, key);
      return key;
    } catch {
      // corrupted — regenerate
    }
  }

  // KIN-023 resolved: clé de groupe aléatoire (32 octets) — non dérivable du householdId.
  // Cette clé doit être partagée aux appareils invités via le flux QR invite (KIN-025).
  const key = await randomBytes(32);
  await SecureStore.setItemAsync(storageKey, Buffer.from(key).toString('base64'));
  groupKeyCache.set(householdId, key);
  return key;
}

/**
 * Persiste une clé de groupe reçue via le flux QR invite (KIN-096).
 * À appeler après avoir descellé l'envelope X25519 envoyée par l'admin
 * du foyer.
 */
export async function setGroupKey(householdId: string, key: Uint8Array): Promise<void> {
  if (key.length !== 32) {
    throw new Error(`groupKey must be 32 bytes, got ${String(key.length)}`);
  }
  const storageKey = `${GROUP_KEY_PREFIX}${householdId}`;
  await SecureStore.setItemAsync(storageKey, Buffer.from(key).toString('base64'));
  groupKeyCache.set(householdId, key);
}

/**
 * Convertit le keypair Ed25519 du device courant en keypair X25519
 * (transformation de Montgomery, cf. `crypto_sign_ed25519_*_to_curve25519`).
 * Utilisé pour le scellement / descellement de la `groupKey` (KIN-096).
 */
export async function getDeviceX25519Keypair(): Promise<KeyExchangeKeypair> {
  const ed = await getOrCreateDevice();
  return ed25519ToX25519({ publicKey: ed.publicKey, secretKey: ed.secretKey });
}
