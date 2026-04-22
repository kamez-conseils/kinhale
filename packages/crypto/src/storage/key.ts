import { secretboxKeygen } from '../box/xchacha20.js';

/**
 * Clé symétrique 32 bytes pour chiffrer le doc Automerge local.
 * Générée au premier lancement, persistée dans Keychain (mobile) ou
 * IndexedDB (web). Ne quitte jamais le device.
 */
export async function generateStorageKey(): Promise<Uint8Array> {
  return secretboxKeygen();
}
