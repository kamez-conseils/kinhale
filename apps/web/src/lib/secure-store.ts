/**
 * Module de stockage chiffré côté navigateur — wraps WebCrypto + IndexedDB.
 *
 * Pattern device-bound : une clé AES-GCM 256 bits **non-extractable** est
 * persistée dans IndexedDB et sert à chiffrer/déchiffrer toutes les données
 * sensibles côté web (clé secrète Ed25519 du device, clé symétrique de groupe
 * du foyer, etc.).
 *
 * Le navigateur sait persister un `CryptoKey` non-extractable nativement dans
 * IndexedDB (via `structuredClone`) sans jamais exposer la matière de clé au
 * code JS. Un attaquant qui exfiltre IndexedDB ne récupère que :
 *   - une référence opaque vers la clé AES-GCM (inutilisable hors du
 *     navigateur d'origine, car la matière reste dans le keystore interne)
 *   - les blobs chiffrés `{iv, ciphertext}` qui ne se déchiffrent qu'avec
 *     cette clé.
 *
 * Limites connues (cf. ADR-D15 + ticket de suivi v1.1) :
 *   - Une XSS active peut, tant qu'elle s'exécute dans l'origine, obtenir
 *     une référence à la wrapping key et appeler `subtle.decrypt()` à la
 *     volée. Le pattern borne le risque à la **durée** de la XSS — bien
 *     mieux que `localStorage` qui exfiltre aussi en post-incident.
 *   - Aucune récupération si l'utilisateur efface son profil navigateur.
 *     La récupération via seed BIP39 est tracée pour v1.1.
 *   - Pas de PIN/passphrase utilisateur en v1.0 (UX simple). Option
 *     Argon2id sur passphrase prévue v1.1.
 *
 * Refs: KIN-095, ADR-D15, kz-securite-AUDIT-TRANSVERSE B1+B2.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'kinhale-secure-v1';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_KEYS = 'keys';
const WRAPPING_KEY_ID = 'wrapping-key-v1';

interface StoredEntry {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

interface StoredWrappingKey {
  id: string;
  key: CryptoKey;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
let wrappingKeyPromise: Promise<CryptoKey> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (dbPromise === null) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          db.createObjectStore(STORE_ENTRIES);
        }
        if (!db.objectStoreNames.contains(STORE_KEYS)) {
          db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

async function loadOrCreateWrappingKey(): Promise<CryptoKey> {
  const db = await getDb();
  const existing = (await db.get(STORE_KEYS, WRAPPING_KEY_ID)) as StoredWrappingKey | undefined;
  if (existing !== undefined) {
    return existing.key;
  }
  // `extractable: false` : la matière de clé ne sort jamais du keystore
  // interne du navigateur. Le CryptoKey reste sérialisable via
  // structuredClone (donc persistable en IndexedDB) mais non exportable
  // en bytes via `subtle.exportKey` ni accessible en clair via le JS.
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const record: StoredWrappingKey = { id: WRAPPING_KEY_ID, key };
  await db.put(STORE_KEYS, record);
  return key;
}

function getWrappingKey(): Promise<CryptoKey> {
  if (wrappingKeyPromise === null) {
    wrappingKeyPromise = loadOrCreateWrappingKey();
  }
  return wrappingKeyPromise;
}

/**
 * Copie défensive d'un `Uint8Array` vers un `ArrayBuffer` strict.
 *
 * `Uint8Array.buffer` est typé `ArrayBufferLike` (qui peut être un
 * `SharedArrayBuffer` selon la spec TS). Or `crypto.subtle.encrypt/decrypt`
 * exige strictement un `ArrayBuffer`. On copie systématiquement les bytes
 * dans un nouveau `ArrayBuffer` non-partagé.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(view.byteLength);
  new Uint8Array(out).set(view);
  return out;
}

export async function secureStorePut(name: string, plaintext: Uint8Array): Promise<void> {
  const key = await getWrappingKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext),
  );
  const entry: StoredEntry = {
    iv,
    ciphertext: new Uint8Array(ciphertextBuffer),
  };
  const db = await getDb();
  await db.put(STORE_ENTRIES, entry, name);
}

export async function secureStoreGet(name: string): Promise<Uint8Array | null> {
  const db = await getDb();
  const entry = (await db.get(STORE_ENTRIES, name)) as StoredEntry | undefined;
  if (entry === undefined) return null;
  const key = await getWrappingKey();
  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(entry.iv) },
      key,
      toArrayBuffer(entry.ciphertext),
    );
    return new Uint8Array(plaintextBuffer);
  } catch {
    // Decrypt failed (wrapping key changed, ciphertext corrupted) — caller
    // should treat as missing and regenerate. Pas de log détaillé : pourrait
    // fuiter une donnée santé via le message d'erreur côté Sentry.
    return null;
  }
}

export async function secureStoreDelete(name: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_ENTRIES, name);
}

/**
 * Réinitialise les caches modules. **Tests uniquement.** Permet à chaque
 * test d'instancier sa propre DB IndexedDB sans contamination de cache.
 *
 * Ferme aussi toute connexion ouverte sur la DB pour qu'un
 * `indexedDB.deleteDatabase()` ultérieur ne soit pas bloqué (`onblocked`).
 */
export async function __resetSecureStoreForTests(): Promise<void> {
  if (dbPromise !== null) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
  }
  dbPromise = null;
  wrappingKeyPromise = null;
}
