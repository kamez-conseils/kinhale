/**
 * Couche device-key web — keypair Ed25519 + clé symétrique de groupe.
 *
 * **Zero-knowledge** : le navigateur génère et conserve les clés sensibles
 * dans un magasin chiffré (`secure-store`) qui s'appuie sur une wrapping key
 * AES-GCM 256 non-extractable WebCrypto, persistée dans IndexedDB. Aucune
 * donnée n'est jamais stockée en clair dans `localStorage`.
 *
 * Refs: KIN-095, ADR-D15, kz-securite-AUDIT-TRANSVERSE B1+B2.
 */

import { ed25519ToX25519, generateSigningKeypair, randomBytes, toHex } from '@kinhale/crypto';
import type { KeyExchangeKeypair, SigningKeypair } from '@kinhale/crypto';
import { secureStoreGet, secureStorePut } from './secure-store';

const DEVICE_KEY_NAME = 'device-keypair-v1';
const GROUP_KEY_PREFIX = 'group-key-v1:';

const SIGNING_PUBLIC_KEY_LEN = 32;
const SIGNING_SECRET_KEY_LEN = 64;
const DEVICE_BLOB_LEN = SIGNING_PUBLIC_KEY_LEN + SIGNING_SECRET_KEY_LEN;
const GROUP_KEY_LEN = 32;

export interface DeviceKeypair extends SigningKeypair {
  publicKeyHex: string;
}

let cachedDevice: DeviceKeypair | null = null;
const groupKeyCache = new Map<string, Uint8Array>();

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Récupère ou crée le keypair Ed25519 du device courant.
 *
 * - Premier appel : génère un keypair via libsodium et le persiste dans
 *   `secure-store` (chiffré AES-GCM par la wrapping key non-extractable).
 * - Appels suivants : déchiffre depuis `secure-store` ; cache module-scope
 *   pour éviter les déchiffrements répétés en boucle React.
 *
 * KIN-024 résolu : la clé secrète n'est plus dans `localStorage` clair.
 */
export async function getOrCreateDevice(): Promise<DeviceKeypair> {
  if (cachedDevice !== null) return cachedDevice;

  const stored = await secureStoreGet(DEVICE_KEY_NAME);
  if (stored !== null && stored.length === DEVICE_BLOB_LEN) {
    const publicKey = stored.slice(0, SIGNING_PUBLIC_KEY_LEN);
    const secretKey = stored.slice(SIGNING_PUBLIC_KEY_LEN, DEVICE_BLOB_LEN);
    cachedDevice = { publicKey, secretKey, publicKeyHex: toHex(publicKey) };
    return cachedDevice;
  }

  const kp = await generateSigningKeypair();
  const blob = concat(kp.publicKey, kp.secretKey);
  await secureStorePut(DEVICE_KEY_NAME, blob);
  cachedDevice = { ...kp, publicKeyHex: toHex(kp.publicKey) };
  return cachedDevice;
}

/**
 * Récupère la clé symétrique du foyer (chiffrement E2EE des blobs Automerge
 * routés via le relais). La clé doit déjà exister localement :
 *
 *   - **Foyer créé sur ce device** : `createGroupKey()` est appelée à la
 *     création du foyer (post-onboarding) pour générer une clé aléatoire 32B.
 *   - **Foyer rejoint** (KIN-025 / flux QR invite) : `setGroupKey()` est
 *     appelée par le flux d'acceptation d'invitation après décryptage du
 *     payload E2EE.
 *
 * KIN-023 résolu : la clé n'est **plus dérivée du `householdId`** — un
 * relais qui connaît `householdId` ne peut donc plus déchiffrer la mailbox.
 *
 * @throws Error si aucune clé locale n'existe pour ce foyer.
 */
export async function getGroupKey(householdId: string): Promise<Uint8Array> {
  const cached = groupKeyCache.get(householdId);
  if (cached !== undefined) return cached;

  const stored = await secureStoreGet(GROUP_KEY_PREFIX + householdId);
  if (stored !== null && stored.length === GROUP_KEY_LEN) {
    groupKeyCache.set(householdId, stored);
    return stored;
  }
  throw new Error(
    'Group key not found — household must be created (createGroupKey) or joined (setGroupKey via QR invite) first',
  );
}

/**
 * Crée et persiste une clé de groupe aléatoire 32B pour un foyer nouvellement
 * créé sur ce device. Idempotente : si une clé existe déjà, retourne celle-ci
 * sans en générer une nouvelle (sinon on perdrait la possibilité de déchiffrer
 * les blobs déjà routés au relais).
 */
export async function createGroupKey(householdId: string): Promise<Uint8Array> {
  const cached = groupKeyCache.get(householdId);
  if (cached !== undefined) return cached;

  const existing = await secureStoreGet(GROUP_KEY_PREFIX + householdId);
  if (existing !== null && existing.length === GROUP_KEY_LEN) {
    groupKeyCache.set(householdId, existing);
    return existing;
  }

  const key = await randomBytes(GROUP_KEY_LEN);
  await secureStorePut(GROUP_KEY_PREFIX + householdId, key);
  groupKeyCache.set(householdId, key);
  return key;
}

/**
 * Persiste une clé de groupe reçue via le flux QR invite (KIN-025).
 * À appeler **après** avoir décrypté le payload d'invitation côté client.
 *
 * @throws Error si la clé n'a pas exactement 32 bytes.
 */
export async function setGroupKey(householdId: string, key: Uint8Array): Promise<void> {
  if (key.length !== GROUP_KEY_LEN) {
    throw new Error(`groupKey must be ${String(GROUP_KEY_LEN)} bytes, got ${String(key.length)}`);
  }
  await secureStorePut(GROUP_KEY_PREFIX + householdId, key);
  groupKeyCache.set(householdId, key);
}

/**
 * Convertit le keypair Ed25519 du device courant en keypair X25519
 * (transformation de Montgomery). Utilisé par le flux KIN-096 pour
 * sceller / descellement la `groupKey` reçue du foyer.
 *
 * **Pas de persistance séparée** : on dérive à la volée depuis le keypair
 * Ed25519 déjà chiffré dans `secure-store`. La conversion est purement
 * mathématique (sodium `crypto_sign_ed25519_*_to_curve25519`).
 */
export async function getDeviceX25519Keypair(): Promise<KeyExchangeKeypair> {
  const ed = await getOrCreateDevice();
  return ed25519ToX25519(ed);
}

/**
 * Réinitialise les caches modules. **Tests uniquement.**
 */
export function __resetDeviceForTests(): void {
  cachedDevice = null;
  groupKeyCache.clear();
}
