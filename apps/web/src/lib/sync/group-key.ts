import { deriveKey } from '@kinhale/crypto';

/**
 * Sel fixe pour la dérivation de la groupKey v1.0.
 * ASCII : "kinhale-group-v1" suivi de zéros de padding jusqu'à 32 octets.
 *
 * AVERTISSEMENT DE SÉCURITÉ (v1.0 simplifié) :
 * La groupKey est dérivée deterministiquement du householdId. Cela signifie
 * que quiconque connaît le householdId peut dériver la même clé et déchiffrer
 * les messages mailbox. Ce compromis est acceptable pour la démo Sprint 4
 * (deux devices d'un même foyer retrouvent la même clé via leur DB commune),
 * mais n'est pas production-grade.
 *
 * Migration prévue post-v1.0 : utiliser MLS ou une enveloppe key-wrap
 * transmise via le protocole d'invitation E2EE (ADR à ouvrir, Refs: KIN-038).
 */
const GROUP_KEY_SALT = new Uint8Array([
  0x6b, 0x69, 0x6e, 0x68, 0x61, 0x6c, 0x65, 0x2d, 0x67, 0x72, 0x6f, 0x75, 0x70, 0x2d, 0x76, 0x31,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

let cache = new Map<string, Uint8Array>();

/**
 * Retourne la clé de groupe (32 octets) pour un foyer donné.
 * La clé est mise en cache en mémoire pour éviter le coût Argon2id répété.
 *
 * @param householdId - Identifiant du foyer (UUID).
 * @returns Clé de groupe 32 octets pour XChaCha20-Poly1305.
 */
export async function getGroupKey(householdId: string): Promise<Uint8Array> {
  const cached = cache.get(householdId);
  if (cached !== undefined) return cached;
  const key = await deriveKey(householdId, GROUP_KEY_SALT, 32);
  cache.set(householdId, key);
  return key;
}

/** Test helper — vide le cache entre les tests. Ne pas utiliser en production. */
export function _resetGroupKeyCache(): void {
  cache = new Map();
}
