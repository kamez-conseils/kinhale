/**
 * Événement domaine stocké dans le document Automerge.
 * Les Uint8Array (clé publique, signature) sont encodés en hex pour
 * compatibilité native avec le CRDT Automerge.
 */
export interface SignedEventRecord {
  readonly id: string
  readonly type: string
  /** JSON.stringify du payload domaine (DoseAdministeredPayload, etc.) */
  readonly payloadJson: string
  /** Clé publique Ed25519 du device émetteur (hex 64 chars) */
  readonly signerPublicKeyHex: string
  /** Signature Ed25519 du canonical bytes (hex 128 chars) */
  readonly signatureHex: string
  readonly deviceId: string
  /** Timestamp UTC en millisecondes */
  readonly occurredAtMs: number
}

/**
 * Document Automerge d'un foyer Kinhale.
 * Un foyer = un document. Les entités (pompes, plans, historique)
 * sont des projections calculées à la lecture depuis la liste d'événements.
 */
export interface KinhaleDoc {
  householdId: string
  events: SignedEventRecord[]
}
