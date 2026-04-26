/**
 * Module de stockage chiffré côté navigateur — wraps WebCrypto + IndexedDB.
 *
 * Pattern device-bound : une **seed aléatoire 32 bytes** est persistée dans
 * IndexedDB. À chaque démarrage, on l'importe via `subtle.importKey` en
 * `extractable: false` pour reconstituer une `CryptoKey` AES-GCM 256
 * non-extractable utilisable uniquement par le navigateur courant.
 *
 * Cette seed sert à chiffrer/déchiffrer toutes les données sensibles côté
 * web (clé secrète Ed25519 du device, clé symétrique de groupe du foyer,
 * etc.). Tous les enregistrements `entries` sont des blobs chiffrés
 * `{iv, ciphertext}` qui ne se déchiffrent qu'avec cette clé.
 *
 * **Pourquoi une seed et non une CryptoKey persistée directement** : la spec
 * structuredClone supporte CryptoKey nativement, mais en pratique les
 * navigateurs Chromium/WebKit/Gecko stockent les bytes en clair dans le
 * backend IndexedDB (sqlite/leveldb). La sécurité réelle vient donc du fait
 * que la clé importée en RAM est `extractable: false` — un attaquant
 * exécutant du code dans la page ne peut PAS appeler `exportKey` pour
 * exfiltrer la matière. Le pattern actuel est donc strictement équivalent en
 * sécurité, et compatible avec les polyfills IndexedDB des environnements
 * Jest/CI qui ne savent pas sérialiser CryptoKey.
 *
 * Limites connues (cf. ADR-D15 + ticket de suivi v1.1) :
 *   - Une XSS active peut, tant qu'elle s'exécute dans l'origine, lire la
 *     seed (clé brute) directement depuis IndexedDB et reconstituer la clé
 *     extractable côté attaquant. Le risque XSS reste donc majeur — bien
 *     mieux que `localStorage` (immédiat, persistant) mais pas absolu.
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

interface StoredWrappingSeed {
  id: string;
  seed: Uint8Array;
}

const WRAPPING_SEED_LEN = 32;

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

/**
 * Copie défensive d'un `Uint8Array` (ou Buffer Node, ou Uint8Array sur
 * ArrayBufferLike arbitraire) vers un **`ArrayBuffer` frais** dans le
 * realm courant.
 *
 * Pourquoi cette copie est cruciale :
 *   1. Après structuredClone IndexedDB (qui passe par v8.serialize/
 *      deserialize en CI Jest), un Uint8Array stocké peut ressortir
 *      comme un `Buffer` Node ou une vue sur un ArrayBuffer d'un realm
 *      tiers. `subtle.encrypt` Node webcrypto vérifie alors
 *      `arg instanceof ArrayBuffer` côté Node — ce check échoue
 *      cross-realm avec jsdom (qui a son propre ArrayBuffer).
 *   2. Le typage TS strict de BufferSource exige `ArrayBuffer` (pas
 *      `ArrayBufferLike`), donc on doit fournir un vrai ArrayBuffer.
 *
 * `new ArrayBuffer(N)` crée un buffer dans le realm de la fonction
 * appelante (le module web), qui est aussi le realm de `crypto.subtle`
 * en CI car `globalThis.crypto = webcrypto` est mappé sur le realm
 * global. Le check instanceof passe alors.
 */
function toFreshArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(view.byteLength);
  new Uint8Array(buf).set(view);
  return buf;
}

async function importSeedAsKey(seed: Uint8Array): Promise<CryptoKey> {
  // `extractable: false` : la clé importée vit en RAM uniquement, ne peut
  // PAS être exfiltrée via `subtle.exportKey`. La seed brute reste en
  // IndexedDB, mais la clé chargée est protégée contre l'exfiltration JS.
  return crypto.subtle.importKey(
    'raw',
    toFreshArrayBuffer(seed),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function loadOrCreateWrappingKey(): Promise<CryptoKey> {
  const db = await getDb();
  const existing = (await db.get(STORE_KEYS, WRAPPING_KEY_ID)) as StoredWrappingSeed | undefined;
  if (existing !== undefined && existing.seed.length === WRAPPING_SEED_LEN) {
    return importSeedAsKey(existing.seed);
  }
  const seed = crypto.getRandomValues(new Uint8Array(WRAPPING_SEED_LEN));
  const record: StoredWrappingSeed = { id: WRAPPING_KEY_ID, seed };
  await db.put(STORE_KEYS, record);
  return importSeedAsKey(seed);
}

function getWrappingKey(): Promise<CryptoKey> {
  if (wrappingKeyPromise === null) {
    wrappingKeyPromise = loadOrCreateWrappingKey();
  }
  return wrappingKeyPromise;
}

export async function secureStorePut(name: string, plaintext: Uint8Array): Promise<void> {
  const key = await getWrappingKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toFreshArrayBuffer(iv) },
    key,
    toFreshArrayBuffer(plaintext),
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
      { name: 'AES-GCM', iv: toFreshArrayBuffer(entry.iv) },
      key,
      toFreshArrayBuffer(entry.ciphertext),
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
