/**
 * SHA-256 via Web Crypto API native (`globalThis.crypto.subtle`).
 *
 * **Aucune dépendance externe.** Disponible en Node 20 LTS (globalement
 * depuis Node 19.0) et dans tous les navigateurs modernes. Aucun polyfill,
 * aucune ré-implémentation logicielle — si Web Crypto n'est pas disponible,
 * on lève `CRYPTO_UNAVAILABLE` au premier appel plutôt que de dégrader
 * silencieusement vers un algorithme plus faible (cf. CLAUDE.md).
 *
 * Ce module est le **seul point d'accès** autorisé au SHA-256 dans le
 * monorepo : `packages/domain`, `apps/api`, etc. doivent importer depuis
 * `@kinhale/crypto`, jamais depuis `node:crypto` ni `globalThis.crypto`
 * directement.
 */

/** Message d'erreur émis lorsque Web Crypto API n'est pas disponible. */
export const CRYPTO_UNAVAILABLE_MESSAGE =
  'Web Crypto API (globalThis.crypto.subtle) is not available in this runtime. ' +
  'Kinhale refuses to fall back to a software implementation; upgrade Node ≥ 20 ' +
  'or run in a modern browser.';

/**
 * Retourne l'implémentation SubtleCrypto disponible, ou lève si absente.
 * Centralisé ici pour que tout le package ait le même contrat runtime.
 * Le type de retour est inféré à partir de `globalThis.crypto.subtle` pour
 * rester compatible avec les lib `ES2022` (qui ne déclare pas `SubtleCrypto`
 * globalement) et les déclarations Web Crypto fournies par `@types/node`.
 */
function requireSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error(CRYPTO_UNAVAILABLE_MESSAGE);
  }
  return subtle;
}

/**
 * Convertit un `ArrayBuffer` en chaîne hex minuscule.
 * Longueur de sortie = 2 × longueur d'entrée.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Calcule le digest SHA-256 d'un buffer binaire.
 *
 * @param data - Buffer d'entrée. `Uint8Array` est recopié en `ArrayBuffer`
 *   avant appel à `subtle.digest` pour garantir un contrat stable sur
 *   toutes les plateformes (certains navigateurs refusent un view).
 * @returns Digest hex-encodé en minuscules, 64 caractères `[0-9a-f]`.
 * @throws `Error` avec `CRYPTO_UNAVAILABLE_MESSAGE` si Web Crypto absent.
 */
export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string> {
  const subtle = requireSubtleCrypto();
  const buffer: ArrayBuffer =
    data instanceof Uint8Array
      ? data.byteLength === data.buffer.byteLength && data.byteOffset === 0
        ? (data.buffer as ArrayBuffer)
        : (data.slice().buffer as ArrayBuffer)
      : data;
  const digest = await subtle.digest('SHA-256', buffer);
  return bufferToHex(digest);
}

/**
 * Variante pour texte UTF-8. Équivalent à
 * `sha256Hex(new TextEncoder().encode(text))`.
 */
export async function sha256HexFromString(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  return sha256Hex(encoded);
}
