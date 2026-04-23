/**
 * BLAKE2b via libsodium (`crypto_generichash`).
 *
 * Utilisé pour produire un **pseudonyme non réversible** d'un identifiant
 * stable (p. ex. `householdId`) avant émission d'un événement de télémétrie.
 * Ce n'est **pas** une primitive de confidentialité forte au sens crypto :
 * la clé `key` passée ici est un **sel applicatif** dont le seul but est
 * d'empêcher une collision de dictionnaire côté Sentry/CloudWatch si l'on
 * connaît l'ensemble des `householdId` possibles.
 *
 * La conformité zero-knowledge est maintenue par construction : le payload
 * émis côté télémétrie ne contient que le digest hex, jamais le pré-image.
 *
 * Ce module est le **seul point d'accès** autorisé à BLAKE2b dans le monorepo.
 *
 * Refs: KIN-040.
 */
import { getSodium } from '../sodium.js';

/** Longueur de sortie par défaut en octets (8 → 16 caractères hex). */
export const BLAKE2B_DEFAULT_BYTES = 8;

/**
 * Calcule `BLAKE2b(message, key)` avec un digest de `outputLen` octets, encodé
 * en hex minuscule.
 *
 * @param message - Donnée à hasher (string UTF-8 ou Uint8Array).
 * @param key - Clé / sel applicatif (string UTF-8 ou Uint8Array, ou `null`
 *   pour un hash sans clé). La clé n'est **jamais** loggée ni émise.
 *   Note : `key = null` donne un hash non-keyed, utile pour du hashing de
 *   déduplication mais **inadéquat pour la pseudonymisation** — un attaquant
 *   connaissant l'espace des pré-images peut rainbow-tabler un hash non-keyed.
 * @param outputLen - Longueur du digest en octets. Par défaut 8 octets
 *   (16 caractères hex) — suffisant pour corréler côté ops sans permettre
 *   d'énumération par rainbow table.
 * @returns Digest hex-encodé en minuscules.
 *
 * @remarks Entropie minimale conseillée de la pré-image : ≥ 64 bits (ex. UUID
 * v4, random 8+ bytes). En dessous, même avec une clé, la sortie reste
 * énumérable par force brute sur l'espace des pré-images possibles.
 */
export async function blake2bHex(
  message: Uint8Array | string,
  key: Uint8Array | string | null,
  outputLen: number = BLAKE2B_DEFAULT_BYTES,
): Promise<string> {
  const sodium = await getSodium();
  const digest = sodium.crypto_generichash(outputLen, message, key);
  return bytesToHex(digest);
}

/** Convertit un Uint8Array en string hex minuscule sans dépendance externe. */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}
