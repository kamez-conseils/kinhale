import { describe, it, expect } from 'vitest';
import { toHex, fromHex, toBase64url, fromBase64url } from './index.js';

describe('encode/toHex', () => {
  it('convertit Uint8Array en hex minuscule', () => {
    const bytes = new Uint8Array([0x00, 0x0f, 0xff, 0xab]);
    expect(toHex(bytes)).toBe('000fffab');
  });

  it('Uint8Array vide → chaîne vide', () => {
    expect(toHex(new Uint8Array())).toBe('');
  });
});

describe('encode/fromHex', () => {
  it('décode hex en Uint8Array', () => {
    expect(fromHex('000fffab')).toEqual(new Uint8Array([0x00, 0x0f, 0xff, 0xab]));
  });

  it('round-trip : toHex → fromHex', () => {
    const original = new Uint8Array(32);
    crypto.getRandomValues(original);
    expect(fromHex(toHex(original))).toEqual(original);
  });

  it('lève sur longueur impaire', () => {
    expect(() => fromHex('abc')).toThrow();
  });

  it('lève sur caractère non-hex', () => {
    expect(() => fromHex('zz')).toThrow();
  });
});

describe('encode/base64url', () => {
  it('round-trip : toBase64url → fromBase64url', () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    expect(fromBase64url(toBase64url(bytes))).toEqual(bytes);
  });

  it('pas de +/=/ dans la sortie (URL-safe)', () => {
    const bytes = new Uint8Array(100);
    crypto.getRandomValues(bytes);
    const b64 = toBase64url(bytes);
    expect(b64).not.toMatch(/[+/=]/);
  });

  it('Uint8Array vide → chaîne vide', () => {
    expect(toBase64url(new Uint8Array())).toBe('');
    expect(fromBase64url('')).toEqual(new Uint8Array());
  });
});
