import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateSigningKeypair, sha256Hex, toHex } from '@kinhale/crypto';

const DEVICE_KEY = 'kinhale-device';

interface StoredDevice {
  publicKeyHex: string;
  secretKeyB64: string;
}

export interface DeviceKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  publicKeyHex: string;
}

let cached: DeviceKeypair | null = null;

export async function getOrCreateDevice(): Promise<DeviceKeypair> {
  if (cached !== null) return cached;
  const stored = await AsyncStorage.getItem(DEVICE_KEY);
  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as StoredDevice).publicKeyHex === 'string' &&
        typeof (parsed as StoredDevice).secretKeyB64 === 'string'
      ) {
        const p = parsed as StoredDevice;
        const secretKey = new Uint8Array(Buffer.from(p.secretKeyB64, 'base64'));
        const publicKey = new Uint8Array(Buffer.from(p.publicKeyHex, 'hex'));
        cached = { publicKey, secretKey, publicKeyHex: p.publicKeyHex };
        return cached;
      }
    } catch {
      // corrupted — regenerate
    }
  }
  // TODO KIN-024: migrate to expo-secure-store (iOS Keychain / Android Keystore)
  const kp = await generateSigningKeypair();
  const publicKeyHex = toHex(kp.publicKey);
  const toStore: StoredDevice = {
    publicKeyHex,
    secretKeyB64: Buffer.from(kp.secretKey).toString('base64'),
  };
  await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(toStore));
  cached = { publicKey: kp.publicKey, secretKey: kp.secretKey, publicKeyHex };
  return cached;
}

const groupKeyCache = new Map<string, Uint8Array>();

export async function getGroupKey(householdId: string): Promise<Uint8Array> {
  const hit = groupKeyCache.get(householdId);
  if (hit !== undefined) return hit;
  // TODO KIN-023: replace SHA-256 derivation with HKDF + random salt
  const hex = await sha256Hex(new TextEncoder().encode(householdId));
  const key = new Uint8Array(Buffer.from(hex, 'hex'));
  groupKeyCache.set(householdId, key);
  return key;
}
