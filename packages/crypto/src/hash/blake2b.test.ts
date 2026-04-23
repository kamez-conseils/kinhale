import { describe, expect, it } from 'vitest';
import { blake2bHex, BLAKE2B_DEFAULT_BYTES } from './blake2b.js';

/**
 * Tests de conformité BLAKE2b via libsodium (`crypto_generichash`).
 *
 * Pas de vecteur RFC 7693 officiel ici — on teste :
 * - la structure (longueur, format hex minuscule) ;
 * - le déterminisme ;
 * - la dépendance à la clé (non-clé ≠ clé) ;
 * - la sensibilité au message (chaque octet modifié change la sortie).
 *
 * Refs: KIN-040.
 */
describe('blake2bHex', () => {
  it('expose une longueur par défaut de 8 octets', () => {
    expect(BLAKE2B_DEFAULT_BYTES).toBe(8);
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
