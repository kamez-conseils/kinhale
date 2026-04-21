import * as A from '@automerge/automerge';
import type { KinhaleDoc, SignedEventRecord } from '../doc/schema.js';

/**
 * Ajoute un SignedEventRecord au document Automerge du foyer.
 * Retourne un nouveau document (Automerge est immutable).
 * L'appelant doit vérifier la signature avant d'appeler appendEvent.
 */
export function appendEvent(doc: A.Doc<KinhaleDoc>, record: SignedEventRecord): A.Doc<KinhaleDoc> {
  return A.change(doc, (d) => {
    d.events.push(record);
  });
}
