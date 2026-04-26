/**
 * Tests du stockage chiffré IndexedDB + WebCrypto.
 *
 * Le polyfill `fake-indexeddb/auto` est chargé via `jest.setup.ts` et
 * réinitialisé entre tests via `indexedDB.deleteDatabase()`. Le polyfill
 * `webcrypto` (Node) fournit `crypto.subtle` côté jsdom.
 *
 * Refs: KIN-095, ADR-D15, kz-securite-AUDIT-TRANSVERSE B1+B2.
 */

import {
  secureStorePut,
  secureStoreGet,
  secureStoreDelete,
  __resetSecureStoreForTests,
} from '../secure-store';

const DB_NAME = 'kinhale-secure-v1';

async function dropDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(new Error('deleteDatabase failed'));
    req.onblocked = (): void => resolve(); // Test isolation : on tolère blocked.
  });
}

async function readRawEntry(name: string): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = (): void => {
      const db = req.result;
      const tx = db.transaction('entries', 'readonly');
      const store = tx.objectStore('entries');
      const getReq = store.get(name);
      getReq.onsuccess = (): void => {
        db.close();
        resolve(getReq.result as { iv: Uint8Array; ciphertext: Uint8Array });
      };
      getReq.onerror = (): void => {
        db.close();
        reject(new Error('get failed'));
      };
    };
    req.onerror = (): void => reject(new Error('open failed'));
  });
}

describe('secure-store', () => {
  beforeEach(async () => {
    await __resetSecureStoreForTests();
    await dropDb();
  });

  afterAll(async () => {
    await __resetSecureStoreForTests();
    await dropDb();
  });

  describe('round-trip', () => {
    it('chiffre puis déchiffre une valeur correctement', async () => {
      const plaintext = new Uint8Array([1, 2, 3, 4, 5, 42, 200, 255]);
      await secureStorePut('test-entry', plaintext);
      const result = await secureStoreGet('test-entry');
      expect(result).not.toBeNull();
      expect(Array.from(result!)).toEqual(Array.from(plaintext));
    });

    it('retourne null pour une entrée inexistante', async () => {
      const result = await secureStoreGet('inexistant');
      expect(result).toBeNull();
    });

    it('supporte des plaintexts de tailles diverses', async () => {
      const sizes = [1, 16, 32, 96, 1024];
      for (const size of sizes) {
        const plaintext = new Uint8Array(size);
        for (let i = 0; i < size; i++) plaintext[i] = (i * 7) & 0xff;
        await secureStorePut(`entry-${String(size)}`, plaintext);
        const result = await secureStoreGet(`entry-${String(size)}`);
        expect(result).not.toBeNull();
        expect(Array.from(result!)).toEqual(Array.from(plaintext));
      }
    });
  });

  describe('confidentialité (anti-régression critique)', () => {
    it('le ciphertext stocké en IndexedDB ne contient PAS les bytes du plaintext', async () => {
      // Plaintext distinctif (motif aléatoire 64B suffisant pour un test
      // statistique : la probabilité que ce motif apparaisse par hasard
      // dans 80B de ciphertext est négligeable).
      const plaintext = new Uint8Array(64);
      for (let i = 0; i < 64; i++) plaintext[i] = (i * 13 + 7) & 0xff;

      await secureStorePut('secret-blob', plaintext);
      const raw = await readRawEntry('secret-blob');

      // Le ciphertext doit contenir AES-GCM tag (16B) + ciphertext
      // (≥ plaintext.length). On cherche une fenêtre exacte du plaintext
      // dans le blob — elle ne doit pas exister.
      const found = containsSubsequence(raw.ciphertext, plaintext);
      expect(found).toBe(false);

      // Le iv doit être de 12 bytes (GCM standard).
      expect(raw.iv.length).toBe(12);

      // Le ciphertext doit être strictement plus long que le plaintext
      // (overhead du tag d'authentification = 16 bytes).
      expect(raw.ciphertext.length).toBeGreaterThan(plaintext.length);
    });

    it('génère un IV différent à chaque écriture (anti-réutilisation nonce)', async () => {
      const plaintext = new Uint8Array([1, 2, 3, 4]);
      await secureStorePut('entry-1', plaintext);
      const e1 = await readRawEntry('entry-1');
      await secureStorePut('entry-2', plaintext);
      const e2 = await readRawEntry('entry-2');
      // Probabilité de collision sur 12B aléatoires = 2^-96 → négligeable.
      expect(Array.from(e1.iv)).not.toEqual(Array.from(e2.iv));
    });

    it('génère un ciphertext différent pour le même plaintext (sémantique IND-CPA)', async () => {
      const plaintext = new Uint8Array(32).fill(0xaa);
      await secureStorePut('entry-a', plaintext);
      const ea = await readRawEntry('entry-a');
      await secureStorePut('entry-b', plaintext);
      const eb = await readRawEntry('entry-b');
      expect(Array.from(ea.ciphertext)).not.toEqual(Array.from(eb.ciphertext));
    });
  });

  describe('isolation entre entrées', () => {
    it('deux noms distincts retournent des valeurs distinctes', async () => {
      const a = new Uint8Array([10, 20, 30]);
      const b = new Uint8Array([40, 50, 60]);
      await secureStorePut('a', a);
      await secureStorePut('b', b);
      const ra = await secureStoreGet('a');
      const rb = await secureStoreGet('b');
      expect(Array.from(ra!)).toEqual(Array.from(a));
      expect(Array.from(rb!)).toEqual(Array.from(b));
    });

    it("la suppression d'une entrée n'affecte pas les autres", async () => {
      await secureStorePut('keep', new Uint8Array([1]));
      await secureStorePut('delete', new Uint8Array([2]));
      await secureStoreDelete('delete');
      expect(await secureStoreGet('delete')).toBeNull();
      const kept = await secureStoreGet('keep');
      expect(Array.from(kept!)).toEqual([1]);
    });

    it('écrire sur le même nom remplace la valeur précédente', async () => {
      await secureStorePut('mut', new Uint8Array([1, 2, 3]));
      await secureStorePut('mut', new Uint8Array([4, 5, 6, 7]));
      const result = await secureStoreGet('mut');
      expect(Array.from(result!)).toEqual([4, 5, 6, 7]);
    });
  });

  describe('persistance de la wrapping key', () => {
    /**
     * Note environnement de test : `fake-indexeddb` (polyfill) clone les
     * valeurs persistées via `structuredClone`. Le `structuredClone` Node
     * polyfill (v8.serialize/deserialize) **ne préserve PAS les CryptoKey
     * AES-GCM non-extractables** (Node webcrypto ne les supporte pas via
     * cette voie). Les vrais navigateurs (Chrome 80+, Firefox, Safari) le
     * supportent nativement — vérification cross-session laissée à un test
     * Playwright e2e (futur ticket de suivi).
     *
     * Ce test vérifie le comportement local : plusieurs put/get successifs
     * sur la même instance lisent bien les valeurs précédentes.
     */
    it('lit correctement plusieurs entrées sur la même instance', async () => {
      await secureStorePut('a', new Uint8Array([1]));
      await secureStorePut('b', new Uint8Array([2]));
      await secureStorePut('c', new Uint8Array([3]));
      const a = await secureStoreGet('a');
      const b = await secureStoreGet('b');
      const c = await secureStoreGet('c');
      expect(Array.from(a!)).toEqual([1]);
      expect(Array.from(b!)).toEqual([2]);
      expect(Array.from(c!)).toEqual([3]);
    });
  });
});

function containsSubsequence(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || haystack.length < needle.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}
