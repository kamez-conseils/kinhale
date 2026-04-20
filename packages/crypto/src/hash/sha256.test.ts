import { describe, expect, it } from 'vitest';
import { sha256Hex, sha256HexFromString } from './sha256';

/**
 * Vecteurs officiels SHA-256 (FIPS 180-4 / RFC 6234) utilisés pour
 * verrouiller la conformité de l'implémentation. Toute régression ici
 * signifie que @kinhale/crypto n'est plus aligné avec la norme —
 * incident de confiance P0.
 */
const HEX_REGEX = /^[0-9a-f]{64}$/;

describe('sha256Hex — vecteurs officiels FIPS 180-4', () => {
  it('retourne le digest de la chaîne vide', async () => {
    const digest = await sha256HexFromString('');
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('retourne le digest de "abc"', async () => {
    const digest = await sha256HexFromString('abc');
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('retourne le digest de "The quick brown fox jumps over the lazy dog"', async () => {
    const digest = await sha256HexFromString('The quick brown fox jumps over the lazy dog');
    expect(digest).toBe('d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
  });

  it("retourne le digest connu d'un octet 0xff", async () => {
    // Vecteur : SHA-256(0xff) = a8100ae6...
    const digest = await sha256Hex(new Uint8Array([0xff]));
    expect(digest).toBe('a8100ae6aa1940d0b663bb31cd466142ebbdbd5187131b92d93818987832eb89');
  });

  it('accepte un ArrayBuffer en entrée', async () => {
    const buffer = new ArrayBuffer(0);
    const digest = await sha256Hex(buffer);
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('sha256Hex — format et déterminisme', () => {
  it('retourne toujours un hex minuscule de 64 caractères', async () => {
    const digest = await sha256HexFromString('kinhale');
    expect(digest).toMatch(HEX_REGEX);
    expect(digest).toHaveLength(64);
  });

  it('produit la même valeur pour deux appels identiques (déterminisme)', async () => {
    const first = await sha256HexFromString('kinhale-report-v1');
    const second = await sha256HexFromString('kinhale-report-v1');
    expect(first).toBe(second);
  });

  it('produit des digests différents pour des entrées différentes (collision-resistance)', async () => {
    const a = await sha256HexFromString('a');
    const b = await sha256HexFromString('b');
    expect(a).not.toBe(b);
  });

  it('encode UTF-8 — les caractères multi-octets changent le digest', async () => {
    const ascii = await sha256HexFromString('e');
    const accent = await sha256HexFromString('é');
    expect(ascii).not.toBe(accent);
  });
});
