import * as A from '@automerge/automerge'
import type { KinhaleDoc } from './schema.js'

export function createDoc(householdId: string): A.Doc<KinhaleDoc> {
  return A.change(A.init<KinhaleDoc>(), (d) => {
    d.householdId = householdId
    d.events = []
  })
}

export function saveDoc(doc: A.Doc<KinhaleDoc>): Uint8Array {
  return A.save(doc)
}

export function loadDoc(bytes: Uint8Array): A.Doc<KinhaleDoc> {
  return A.load<KinhaleDoc>(bytes)
}

/**
 * Retourne les changements delta entre before et after.
 * Pré-condition : before est un ancêtre de after (même acteur).
 */
export function getDocChanges(
  before: A.Doc<KinhaleDoc>,
  after: A.Doc<KinhaleDoc>,
): Uint8Array[] {
  return A.getChanges(before, after).map((c) => new Uint8Array(c))
}

/**
 * Retourne tous les changements du document depuis sa création.
 * Pour la synchronisation initiale avec un nouveau device.
 */
export function getAllDocChanges(doc: A.Doc<KinhaleDoc>): Uint8Array[] {
  return A.getAllChanges(doc).map((c) => new Uint8Array(c))
}

/**
 * Applique des changements reçus du relais sur un document local.
 * Automerge garantit la convergence CRDT (idempotent).
 */
export function mergeChanges(
  doc: A.Doc<KinhaleDoc>,
  changes: Uint8Array[],
): A.Doc<KinhaleDoc> {
  const [newDoc] = A.applyChanges(doc, changes as unknown as A.Change[])
  return newDoc
}
