/**
 * Wrapper libsodium `crypto_box_seal` / `crypto_box_seal_open`.
 *
 * **Cas d'usage** — chiffrement asymétrique anonyme (sealed box) :
 * un expéditeur connaît la clé publique X25519 du destinataire et chiffre
 * un message déchiffrable uniquement par le détenteur de la clé privée
 * correspondante. L'expéditeur n'est pas authentifié — c'est le pattern
 * "boîte aux lettres anonyme" de NaCl/libsodium.
 *
 * Format du ciphertext (cf. doc libsodium) :
 *   `ephemeral_public_key (32B) || box(M, ephemeral_sk, recipient_pk, nonce)`
 * où `nonce = blake2b(ephemeral_pk || recipient_pk)`.
 *
 * Le surcout est de `crypto_box_SEALBYTES` = 48 octets (32 ephemeral + 16 MAC)
 * indépendamment de la taille du plaintext.
 *
 * **Usage Kinhale** — partage de la `groupKey` 32B vers un device invité :
 * 1. L'invité génère sa keypair X25519 (déjà fait au démarrage du device).
 * 2. L'admin reçoit `recipientPublicKey` via le backend après acceptation.
 * 3. Admin : `sealedBoxEncrypt(groupKey, recipientPublicKey)` → 80B opaques.
 * 4. Backend stocke ces 80B liés au token d'invitation (zero-knowledge).
 * 5. Invité poll, récupère le sealed, fait `sealedBoxDecrypt(...)`.
 *
 * Le relais ne voit **jamais** la `groupKey` en clair.
 *
 * Refs: KIN-096 issue #352, ADR pivot E2EE multi-aidant, libsodium spec
 *       https://doc.libsodium.org/public-key_cryptography/sealed_boxes
 */

import { getSodium } from '../sodium.js';
import type { KeyExchangeKeypair } from '../kx/x25519.js';

/** Longueur d'une clé publique X25519 (octets). */
export const SEALED_BOX_PUBLIC_KEY_BYTES = 32;
/** Longueur d'une clé privée X25519 (octets). */
export const SEALED_BOX_PRIVATE_KEY_BYTES = 32;
/** Surcoût constant d'un sealed box : 32 (ephemeral pk) + 16 (MAC) = 48 octets. */
export const SEALED_BOX_OVERHEAD_BYTES = 48;

/**
 * Chiffre `plaintext` pour la clé publique X25519 du destinataire.
 *
 * Le ciphertext retourné (`plaintext.length + 48` octets) ne révèle ni
 * l'identité de l'expéditeur, ni le contenu, ni même la longueur exacte
 * du plaintext (le ciphertext a une longueur déterministe par rapport à
 * celle du plaintext, mais aucune info n'est encodée hors de l'enveloppe
 * standard). Une nouvelle keypair éphémère est générée à chaque appel —
 * deux chiffrements du même plaintext produisent deux ciphertexts distincts.
 *
 * @param plaintext   Données à chiffrer (longueur arbitraire).
 * @param recipientPublicKey  Clé publique X25519 du destinataire (32B).
 * @throws Error si `recipientPublicKey` n'a pas exactement 32 octets.
 */
export async function sealedBoxEncrypt(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
): Promise<Uint8Array> {
  if (recipientPublicKey.length !== SEALED_BOX_PUBLIC_KEY_BYTES) {
    throw new Error(
      `sealedBoxEncrypt: recipientPublicKey doit faire ${String(SEALED_BOX_PUBLIC_KEY_BYTES)} octets, reçu ${String(recipientPublicKey.length)}`,
    );
  }
  const sodium = await getSodium();
  return sodium.crypto_box_seal(plaintext, recipientPublicKey);
}

/**
 * Déchiffre un ciphertext sealed box avec la keypair X25519 du destinataire.
 *
 * Retourne `null` si le déchiffrement échoue (ciphertext altéré, mauvaise
 * keypair, ciphertext trop court). Aucune exception n'est levée pour les
 * erreurs cryptographiques — le caller doit traiter `null` comme un échec
 * d'authentification du payload (anti-oracle de timing/format).
 *
 * @param ciphertext  Sortie d'un `sealedBoxEncrypt` (≥ 48 octets).
 * @param recipientKeypair  Keypair X25519 du destinataire.
 */
export async function sealedBoxDecrypt(
  ciphertext: Uint8Array,
  recipientKeypair: KeyExchangeKeypair,
): Promise<Uint8Array | null> {
  if (ciphertext.length < SEALED_BOX_OVERHEAD_BYTES) {
    return null;
  }
  if (recipientKeypair.publicKey.length !== SEALED_BOX_PUBLIC_KEY_BYTES) {
    return null;
  }
  if (recipientKeypair.privateKey.length !== SEALED_BOX_PRIVATE_KEY_BYTES) {
    return null;
  }
  const sodium = await getSodium();
  try {
    return sodium.crypto_box_seal_open(
      ciphertext,
      recipientKeypair.publicKey,
      recipientKeypair.privateKey,
    );
  } catch {
    // libsodium throws on tampered ciphertext / wrong key — convert to null
    // for a uniform API (cf. doc §sealed_boxes — failure is constant time).
    return null;
  }
}
