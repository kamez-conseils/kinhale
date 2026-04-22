import { openDB, type IDBPDatabase } from 'idb';
import { generateStorageKey } from '@kinhale/crypto';

const DB_NAME = 'kinhale';
const DB_VERSION = 1;
const KEYS_STORE = 'keys';
const DOC_STORE = 'doc';
const SEK_SLOT = 'sek';

async function openKinhaleDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(KEYS_STORE)) db.createObjectStore(KEYS_STORE);
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE);
    },
  });
}

/**
 * Retourne la clé de stockage du device, créée si besoin et persistée
 * dans IndexedDB (object store `keys`). La clé ne quitte jamais le navigateur.
 *
 * NOTE v1 : la clé est lisible par tout script JS exécuté sur la page. Une
 * évolution future utilisera WebCrypto CryptoKey non-extractable pour
 * wrapper la SEK (ADR à ouvrir — voir KIN-035).
 */
export async function getOrCreateStorageKey(): Promise<Uint8Array> {
  const db = await openKinhaleDB();
  const existing: unknown = await db.get(KEYS_STORE, SEK_SLOT);
  // instanceof peut échouer en cas de contextes différents (tests JSDOM) —
  // on vérifie aussi ArrayBuffer.isView pour rester robuste.
  if (existing instanceof Uint8Array) return existing;
  if (ArrayBuffer.isView(existing))
    return new Uint8Array(existing.buffer, existing.byteOffset, existing.byteLength);
  const key = await generateStorageKey();
  await db.put(KEYS_STORE, key, SEK_SLOT);
  return key;
}

export async function readEncryptedDoc(): Promise<unknown | null> {
  const db = await openKinhaleDB();
  return ((await db.get(DOC_STORE, 'current')) as unknown) ?? null;
}

export async function writeEncryptedDoc(blob: unknown): Promise<void> {
  const db = await openKinhaleDB();
  await db.put(DOC_STORE, blob, 'current');
}
