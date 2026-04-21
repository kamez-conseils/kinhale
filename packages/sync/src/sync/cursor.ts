import * as A from '@automerge/automerge';
import type { KinhaleDoc } from '../doc/schema.js';
import { getDocChanges } from '../doc/lifecycle.js';

export interface SyncCursor {
  /** Snapshot Automerge après le dernier envoi réussi. Null = jamais envoyé. */
  readonly lastSentDoc: A.Doc<KinhaleDoc> | null;
  /** Têtes Automerge connues après le dernier envoi (pour comparaison rapide). */
  readonly knownHeads: A.Heads;
  /** Nombre cumulatif de changements reçus (compteur monotone). */
  readonly receivedCount: number;
}

/** Crée un cursor initialisé sur le document courant (jamais envoyé). */
export function createCursor(): SyncCursor {
  return {
    lastSentDoc: null,
    knownHeads: [],
    receivedCount: 0,
  };
}

/**
 * Enregistre que `doc` a été envoyé avec succès au relay.
 * Les prochains appels à `pendingChanges` calculeront le delta depuis ce point.
 */
export function recordSent(cursor: SyncCursor, doc: A.Doc<KinhaleDoc>): SyncCursor {
  return {
    ...cursor,
    lastSentDoc: doc,
    knownHeads: A.getHeads(doc),
  };
}

/**
 * Enregistre des changements reçus du relay.
 * Incrémente le compteur monotone pour journalisation.
 */
export function recordReceived(cursor: SyncCursor, changes: Uint8Array[]): SyncCursor {
  // Changes are applied to the doc outside the cursor (via mergeChanges); only count here.
  return {
    ...cursor,
    receivedCount: cursor.receivedCount + changes.length,
  };
}

/**
 * Retourne les changements Automerge à envoyer depuis la dernière tête connue.
 * Retourne tous les changements si jamais envoyé (full sync initial).
 */
export function pendingChanges(cursor: SyncCursor, current: A.Doc<KinhaleDoc>): Uint8Array[] {
  if (cursor.lastSentDoc === null) {
    return A.getAllChanges(current).map((c) => new Uint8Array(c));
  }
  return getDocChanges(cursor.lastSentDoc, current);
}
