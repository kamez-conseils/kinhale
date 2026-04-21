import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToEntropy,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

export function generateSeedPhrase(): string {
  return generateMnemonic(wordlist, 256);
}

export function validateSeedPhrase(phrase: string): boolean {
  if (!phrase) return false;
  try {
    return validateMnemonic(phrase, wordlist);
  } catch {
    return false;
  }
}

export function seedPhraseToBytes(phrase: string): Uint8Array {
  if (!validateSeedPhrase(phrase)) {
    throw new Error(
      'bip39: phrase mnémonique invalide ou checksum incorrect'
    );
  }
  return mnemonicToEntropy(phrase, wordlist);
}
