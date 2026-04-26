/**
 * Tests du module `device.ts` après refacto WebCrypto KIN-095.
 *
 * Vérifie :
 *   - `getOrCreateDevice` : génère, persiste (chiffré), réutilise.
 *   - `localStorage` reste vide (anti-régression critique B2).
 *   - `getGroupKey` throws si pas de clé locale (B1 — pas de dérivation).
 *   - `createGroupKey` : génère 32B aléatoires distincts par appel sur
 *     householdIds différents, idempotent sur le même.
 *   - `setGroupKey` : persiste correctement et `getGroupKey` la retrouve.
 */

const mockGenerateSigningKeypair = jest.fn();

// On mocke uniquement `generateSigningKeypair` pour éviter de tirer libsodium
// dans le sandbox jest. `randomBytes` est gardé via le polyfill jsdom (le
// stockage chiffré utilise `crypto.getRandomValues`, donc randomBytes() de
// libsodium n'est pas nécessaire ici — on substitue par un fallback
// déterministe pour rester reproductible et indépendant du chargement
// asynchrone de WASM).
jest.mock('@kinhale/crypto', () => {
  let counter = 0;
  return {
    generateSigningKeypair: (...args: unknown[]): Promise<unknown> =>
      mockGenerateSigningKeypair(...args),
    randomBytes: (n: number): Promise<Uint8Array> => {
      // Source pseudo-aléatoire incrémentale par appel pour des clés
      // distinctes entre tests sans dépendre de libsodium.
      const out = new Uint8Array(n);
      counter++;
      for (let i = 0; i < n; i++) out[i] = (counter * 31 + i * 17) & 0xff;
      return Promise.resolve(out);
    },
    toHex: (bytes: Uint8Array): string => {
      let h = '';
      for (const b of bytes) h += b.toString(16).padStart(2, '0');
      return h;
    },
    fromHex: (hex: string): Uint8Array => {
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    },
  };
});

import {
  getOrCreateDevice,
  getGroupKey,
  createGroupKey,
  setGroupKey,
  __resetDeviceForTests,
} from '../device';
import { __resetSecureStoreForTests } from '../secure-store';

const DB_NAME = 'kinhale-secure-v1';
const LEGACY_DEVICE_KEY_STORAGE = 'kinhale-device-key';

async function dropDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = (): void => resolve();
    req.onerror = (): void => reject(new Error('deleteDatabase failed'));
    req.onblocked = (): void => resolve();
  });
}

describe('device (KIN-095 — WebCrypto + IndexedDB)', () => {
  beforeEach(async () => {
    localStorage.clear();
    __resetDeviceForTests();
    await __resetSecureStoreForTests();
    await dropDb();
    jest.clearAllMocks();
    mockGenerateSigningKeypair.mockResolvedValue({
      publicKey: new Uint8Array(32).fill(1),
      secretKey: new Uint8Array(64).fill(2),
    });
  });

  afterAll(async () => {
    __resetDeviceForTests();
    await __resetSecureStoreForTests();
    await dropDb();
  });

  describe('getOrCreateDevice', () => {
    it('génère un nouveau keypair si rien en stockage chiffré', async () => {
      const result = await getOrCreateDevice();
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(result.publicKey.length).toBe(32);
      expect(result.secretKey.length).toBe(64);
      expect(result.publicKeyHex).toHaveLength(64);
    });

    it("ne stocke RIEN dans localStorage (anti-régression B2 — clé n'est plus en clair)", async () => {
      await getOrCreateDevice();
      expect(localStorage.getItem(LEGACY_DEVICE_KEY_STORAGE)).toBeNull();
      // Aucune clé localStorage ne doit contenir la matière secrète.
      expect(localStorage.length).toBe(0);
    });

    it('réutilise le keypair persisté entre deux appels (cache module)', async () => {
      const first = await getOrCreateDevice();
      const second = await getOrCreateDevice();
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(first.publicKeyHex).toBe(second.publicKeyHex);
    });

    it('réutilise le keypair persisté après réinitialisation du cache module (même session)', async () => {
      // Note: ce test reset uniquement le cache module ; il ne ferme PAS
      // la wrapping key WebCrypto (la `CryptoKey` reste vivante côté
      // secure-store). En environnement test, `structuredClone(CryptoKey)`
      // n'est pas supporté par le polyfill Node — cf. note dans
      // secure-store.test.ts. Ici on vérifie que dans la même session,
      // un reset du cache `device.ts` lit bien le blob déjà chiffré.
      const first = await getOrCreateDevice();
      __resetDeviceForTests(); // reset uniquement device, pas secure-store
      const second = await getOrCreateDevice();
      // generateSigningKeypair n'est appelé qu'une fois (la 2e lecture
      // déchiffre depuis IndexedDB via secure-store).
      expect(mockGenerateSigningKeypair).toHaveBeenCalledTimes(1);
      expect(first.publicKeyHex).toBe(second.publicKeyHex);
      expect(Array.from(first.secretKey)).toEqual(Array.from(second.secretKey));
    });
  });

  describe('getGroupKey', () => {
    it('throw si aucune clé locale (anti-régression B1 — pas de dérivation publique)', async () => {
      await expect(getGroupKey('hh-123')).rejects.toThrow(/Group key not found/);
    });

    it('retourne la clé persistée par createGroupKey', async () => {
      const created = await createGroupKey('hh-abc');
      const retrieved = await getGroupKey('hh-abc');
      expect(Array.from(retrieved)).toEqual(Array.from(created));
    });
  });

  describe('createGroupKey', () => {
    it('retourne 32 bytes aléatoires', async () => {
      const key = await createGroupKey('hh-xyz');
      expect(key).toBeInstanceOf(Uint8Array);
      expect(key.length).toBe(32);
    });

    it('produit des clés distinctes pour deux foyers différents', async () => {
      const k1 = await createGroupKey('hh-1');
      const k2 = await createGroupKey('hh-2');
      expect(Array.from(k1)).not.toEqual(Array.from(k2));
    });

    it("est idempotente (n'écrase pas une clé existante)", async () => {
      const k1 = await createGroupKey('hh-stable');
      const k2 = await createGroupKey('hh-stable');
      expect(Array.from(k1)).toEqual(Array.from(k2));
    });

    it('persiste la clé entre deux lectures avec cache device flushé', async () => {
      // Cf. note dans secure-store.test.ts : reset secure-store impossible
      // en env Jest. Ici on flush uniquement le cache device et on vérifie
      // que getGroupKey lit la valeur précédente depuis secure-store.
      const k1 = await createGroupKey('hh-persist');
      __resetDeviceForTests();
      const k2 = await getGroupKey('hh-persist');
      expect(Array.from(k1)).toEqual(Array.from(k2));
    });
  });

  describe('setGroupKey', () => {
    it('persiste une clé fournie (cas: réception via QR invite)', async () => {
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) key[i] = i;
      await setGroupKey('hh-invited', key);
      const retrieved = await getGroupKey('hh-invited');
      expect(Array.from(retrieved)).toEqual(Array.from(key));
    });

    it("rejette une clé d'une longueur incorrecte", async () => {
      await expect(setGroupKey('hh', new Uint8Array(16))).rejects.toThrow(/32 bytes/);
      await expect(setGroupKey('hh', new Uint8Array(64))).rejects.toThrow(/32 bytes/);
    });
  });
});
