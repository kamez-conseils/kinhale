import { describe, it, expect } from 'vitest';
import { generateSeedPhrase, validateSeedPhrase, seedPhraseToBytes } from './bip39.js';

describe('BIP39/generateSeedPhrase', () => {
  it('génère une phrase de 24 mots', () => {
    const phrase = generateSeedPhrase();
    expect(phrase.split(' ')).toHaveLength(24);
  });

  it('deux appels produisent des phrases différentes', () => {
    const p1 = generateSeedPhrase();
    const p2 = generateSeedPhrase();
    expect(p1).not.toBe(p2);
  });

  it('la phrase générée est valide (checksum BIP39 correct)', () => {
    const phrase = generateSeedPhrase();
    expect(validateSeedPhrase(phrase)).toBe(true);
  });
});

describe('BIP39/validateSeedPhrase', () => {
  it('accepte une phrase BIP39 valide connue', () => {
    // Vecteur de test BIP39 officiel (test vector #1 de trezor/python-mnemonic)
    const knownValid =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    // 12 mots = 128 bits, aussi valide en BIP39
    expect(validateSeedPhrase(knownValid)).toBe(true);
  });

  it('rejette une phrase avec un mot non-BIP39', () => {
    const invalid = 'invalid word not in list ' + 'abandon '.repeat(19).trim();
    expect(validateSeedPhrase(invalid)).toBe(false);
  });

  it('rejette une phrase avec checksum incorrect', () => {
    // Échange les deux derniers mots d'une phrase valide → checksum cassé
    const phrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon zoo';
    expect(validateSeedPhrase(phrase)).toBe(false);
  });

  it('rejette une chaîne vide', () => {
    expect(validateSeedPhrase('')).toBe(false);
  });
});

describe('BIP39/seedPhraseToBytes', () => {
  it('retourne 32 octets pour une phrase 24 mots (256 bits)', () => {
    const phrase = generateSeedPhrase();
    const bytes = seedPhraseToBytes(phrase);
    expect(bytes).toHaveLength(32);
  });

  it('déterministe : même phrase → mêmes octets', () => {
    const phrase = generateSeedPhrase();
    const b1 = seedPhraseToBytes(phrase);
    const b2 = seedPhraseToBytes(phrase);
    expect(Buffer.from(b1).toString('hex')).toBe(Buffer.from(b2).toString('hex'));
  });

  it('round-trip : génère → octets → phrase → octets identiques', async () => {
    const phrase1 = generateSeedPhrase();
    const bytes1 = seedPhraseToBytes(phrase1);
    // Reconvertir bytes → phrase via entropyToMnemonic
    const { entropyToMnemonic } = await import('@scure/bip39');
    const { wordlist } = await import('@scure/bip39/wordlists/english');
    const phrase2 = entropyToMnemonic(bytes1, wordlist);
    const bytes2 = seedPhraseToBytes(phrase2);
    expect(Buffer.from(bytes1).toString('hex')).toBe(Buffer.from(bytes2).toString('hex'));
  });

  it('vecteur officiel BIP39 256 bits — entropie zéro (abandon×23 + art)', () => {
    const phrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    expect(validateSeedPhrase(phrase)).toBe(true);
    const bytes = seedPhraseToBytes(phrase);
    expect(bytes).toHaveLength(32);
    expect(Buffer.from(bytes).toString('hex')).toBe(
      '0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  it('lève si la phrase est invalide', () => {
    expect(() => seedPhraseToBytes('mots invalides')).toThrow();
  });
});
