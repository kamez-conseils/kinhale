import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import { generateStorageKey } from '@kinhale/crypto';

const SEK_KEYCHAIN_SLOT = 'kinhale-sek';

/**
 * Retourne la clé de stockage du device ; la crée et la persiste dans
 * Keychain/Keystore si elle n'existe pas encore. La clé ne quitte jamais
 * le device.
 */
export async function getOrCreateStorageKey(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(SEK_KEYCHAIN_SLOT);
  if (stored !== null) {
    return Uint8Array.from(Buffer.from(stored, 'hex'));
  }
  const key = await generateStorageKey();
  await SecureStore.setItemAsync(SEK_KEYCHAIN_SLOT, Buffer.from(key).toString('hex'));
  return key;
}
