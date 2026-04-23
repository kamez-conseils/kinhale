import { describe, expect, it } from 'vitest';
import { blake2bHex, BLAKE2B_DEFAULT_BYTES } from './blake2b.js';

/**
 * Tests de conformité BLAKE2b via libsodium (`crypto_generichash`).
 *
 * Inclut :
 * - 1 test vector officiel RFC 7693 Appendix A (BLAKE2b-512 de "abc") ;
 * - 1 test vector d'ancrage BLAKE2b-256 (sortie 32 bytes, non-keyed) généré
 *   depuis l'implémentation courante pour bloquer toute régression ;
 * - la structure (longueur, format hex minuscule) ;
 * - le déterminisme ;
 * - la dépendance à la clé (non-clé ≠ clé) ;
 * - la sensibilité au message (chaque octet modifié change la sortie).
 *
 * Refs: KIN-040, RFC 7693.
 */
describe('blake2bHex', () => {
  it('expose une longueur par défaut de 8 octets', () => {
    expect(BLAKE2B_DEFAULT_BYTES).toBe(8);
  });

  it('correspond au test vector RFC 7693 Appendix A (BLAKE2b-512 de "abc", non-keyed)', async () => {
    // Source : RFC 7693, Appendix A.
    // https://www.rfc-editor.org/rfc/rfc7693#appendix-A
    // Input: "abc" (UTF-8, 3 bytes) ; Key: aucune ; outputLen: 64 bytes.
    const expected =
      'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1' +
      '7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923';
    const digest = await blake2bHex('abc', null, 64);
    expect(digest).toBe(expected);
  });

  it('correspond au test d\'ancrage BLAKE2b-256 de "abc" (non-keyed, sortie 32 bytes)', async () => {
    // Ancre de régression : BLAKE2b-256 natif (pas tronqué du 512) via
    // `crypto_generichash(32, ...)`. Valeur générée depuis l'implémentation
    // libsodium-wrappers-sumo courante ; toute divergence signale une
    // régression de primitive.
    const expected = 'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319';
    const digest = await blake2bHex('abc', null, 32);
    expect(digest).toBe(expected);
  });

  it('retourne un hex minuscule de 16 caractères par défaut', async () => {
    const digest = await blake2bHex('household-abc', 'app-secret');
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
  });

  it('retourne un hex de longueur configurable (32 octets → 64 chars)', async () => {
    const digest = await blake2bHex('household-abc', 'app-secret', 32);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('est déterministe (même message + même clé → même digest)', async () => {
    const a = await blake2bHex('household-xyz', 'secret-v1');
    const b = await blake2bHex('household-xyz', 'secret-v1');
    expect(a).toBe(b);
  });

  it('produit un digest différent si la clé change (rôle de sel)', async () => {
    const withKeyA = await blake2bHex('household-xyz', 'secret-A');
    const withKeyB = await blake2bHex('household-xyz', 'secret-B');
    expect(withKeyA).not.toBe(withKeyB);
  });

  it('produit un digest différent si le message change (collision-resistance)', async () => {
    const a = await blake2bHex('household-aaa', 'secret');
    const b = await blake2bHex('household-bbb', 'secret');
    expect(a).not.toBe(b);
  });

  it('accepte une clé null (hash sans clé)', async () => {
    const digest = await blake2bHex('household-abc', null);
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
  });

  it('accepte un message Uint8Array', async () => {
    const msg = new Uint8Array([1, 2, 3, 4]);
    const digest = await blake2bHex(msg, 'secret');
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
  });

  it('accepte une clé Uint8Array', async () => {
    const key = new Uint8Array(16).fill(0x42);
    const digest = await blake2bHex('household-abc', key);
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
  });
});
