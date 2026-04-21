# Sprint 0 — Plan 2 : packages/sync (Automerge 2 + E2EE)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer `packages/sync` — le moteur local-first de Kinhale : document CRDT Automerge 2 par foyer, événements domaine signés Ed25519, chiffrement des deltas pour le relais opaque.

**Architecture:** Un document Automerge par foyer contient une liste append-only d'événements domaine signés Ed25519. Les deltas (Automerge `getChanges`) sont chiffrés XChaCha20-Poly1305 avec la clé de groupe avant d'être envoyés au relais — qui ne voit que des blobs opaques. Le relais ne détient jamais la clé de groupe (MLS le gèrera dans un sprint futur ; pour l'instant la clé de groupe est un `Uint8Array` passé explicitement).

**Tech Stack:** `@automerge/automerge` 2.2+, `@kinhale/crypto` (Ed25519 + XChaCha20-Poly1305 + randomBytes), TypeScript strict, Vitest.

---

## Fichiers créés

```
packages/sync/
  package.json
  tsconfig.json
  vitest.config.ts
  eslint.config.js
  src/
    index.ts                        ← exporte tout
    doc/
      schema.ts                     ← KinhaleDoc + SignedEventRecord (types Automerge)
      schema.test.ts
      lifecycle.ts                  ← createDoc, loadDoc, saveDoc, getDocChanges, mergeChanges
      lifecycle.test.ts
    events/
      types.ts                      ← DomainEventType + payload union
      sign.ts                       ← signEvent(), verifySignedEvent()
      sign.test.ts
      append.ts                     ← appendEvent()
      append.test.ts
    mailbox/
      encrypt.ts                    ← encryptChanges(), decryptChanges(), EncryptedBlob
      encrypt.test.ts
      message.ts                    ← SyncMessage + encodeSyncMessage(), decodeSyncMessage()
      message.test.ts
```

---

## Task 1 : Package scaffold

**Files:**
- Create: `packages/sync/package.json`
- Create: `packages/sync/tsconfig.json`
- Create: `packages/sync/vitest.config.ts`
- Create: `packages/sync/eslint.config.js`

- [ ] **Step 1 : Créer package.json**

Créer `packages/sync/package.json` :

```json
{
  "name": "@kinhale/sync",
  "version": "0.1.0",
  "private": true,
  "license": "AGPL-3.0-only",
  "description": "Moteur de synchronisation local-first Kinhale (Automerge 2 + E2EE mailbox)",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint --max-warnings=0 .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@automerge/automerge": "^2.2.0",
    "@kinhale/crypto": "workspace:*"
  },
  "devDependencies": {
    "@kinhale/eslint-config": "workspace:*",
    "@kinhale/tsconfig": "workspace:*",
    "@kinhale/test-utils": "workspace:*",
    "@types/node": "^22.10.5",
    "@vitest/coverage-v8": "^3.0.0",
    "eslint": "^9.18.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.2"
  }
}
```

- [ ] **Step 2 : Créer tsconfig.json**

Créer `packages/sync/tsconfig.json` :

```json
{
  "extends": "@kinhale/tsconfig/library.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3 : Créer vitest.config.ts**

Créer `packages/sync/vitest.config.ts` :

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
```

- [ ] **Step 4 : Créer eslint.config.js**

Créer `packages/sync/eslint.config.js` :

```js
import kinhale from '@kinhale/eslint-config'

export default [
  ...kinhale,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]
```

- [ ] **Step 5 : Installer les dépendances**

```bash
cd /Users/martial/development/asthma-tracker && pnpm install
```

Expected : `@automerge/automerge` installé dans `packages/sync/node_modules`.

- [ ] **Step 6 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/
git -C /Users/martial/development/asthma-tracker commit -m "chore(sync): scaffold package @kinhale/sync

Package vide : package.json, tsconfig, vitest.config, eslint.config.
Dépendances : @automerge/automerge ^2.2.0 + @kinhale/crypto.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2 : KinhaleDoc — schéma Automerge

**Files:**
- Create: `packages/sync/src/doc/schema.ts`
- Create: `packages/sync/src/doc/schema.test.ts`

Le document Automerge d'un foyer. Les `Uint8Array` (clés, signatures) sont stockés en hex dans le CRDT car Automerge gère les strings nativement. La couche sign/verify ré-encode en `Uint8Array` à la demande.

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/sync/src/doc/schema.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import type { KinhaleDoc, SignedEventRecord } from './schema.js'

describe('KinhaleDoc schema', () => {
  it('SignedEventRecord a toutes les propriétés requises', () => {
    const record: SignedEventRecord = {
      id: 'evt-001',
      type: 'DoseAdministered',
      payloadJson: JSON.stringify({ doseId: 'd1' }),
      signerPublicKeyHex: 'aabbcc',
      signatureHex: 'ddeeff',
      deviceId: 'device-001',
      occurredAtMs: 1_700_000_000_000,
    }
    expect(record.id).toBe('evt-001')
    expect(record.type).toBe('DoseAdministered')
    expect(record.occurredAtMs).toBeGreaterThan(0)
  })

  it('KinhaleDoc a householdId et events', () => {
    const doc: KinhaleDoc = {
      householdId: 'hh-001',
      events: [],
    }
    expect(doc.householdId).toBe('hh-001')
    expect(doc.events).toHaveLength(0)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/doc/schema.test.ts
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Créer schema.ts**

Créer `packages/sync/src/doc/schema.ts` :

```typescript
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
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/doc/schema.test.ts
```

Expected : 2 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/doc/schema.ts packages/sync/src/doc/schema.test.ts
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): KinhaleDoc schema — document Automerge du foyer

SignedEventRecord : id, type, payloadJson, signerPublicKeyHex (hex),
signatureHex (hex), deviceId, occurredAtMs.
KinhaleDoc : householdId + events append-only.
Hex encoding des Uint8Array pour compatibilité native Automerge.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3 : Cycle de vie du document

**Files:**
- Create: `packages/sync/src/doc/lifecycle.ts`
- Create: `packages/sync/src/doc/lifecycle.test.ts`

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/sync/src/doc/lifecycle.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  createDoc,
  loadDoc,
  saveDoc,
  getDocChanges,
  getAllDocChanges,
  mergeChanges,
} from './lifecycle.js'

describe('Document lifecycle', () => {
  it('createDoc initialise un document avec householdId', () => {
    const doc = createDoc('hh-test-1')
    expect(doc.householdId).toBe('hh-test-1')
    expect(doc.events).toHaveLength(0)
  })

  it('saveDoc + loadDoc : aller-retour binaire', () => {
    const doc = createDoc('hh-test-2')
    const bytes = saveDoc(doc)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
    const loaded = loadDoc(bytes)
    expect(loaded.householdId).toBe('hh-test-2')
    expect(loaded.events).toHaveLength(0)
  })

  it('getAllDocChanges retourne des Uint8Array[]', () => {
    const doc = createDoc('hh-test-3')
    const changes = getAllDocChanges(doc)
    expect(Array.isArray(changes)).toBe(true)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0]).toBeInstanceOf(Uint8Array)
  })

  it('getDocChanges retourne 0 changements si doc identique', () => {
    const doc = createDoc('hh-test-4')
    const changes = getDocChanges(doc, doc)
    expect(changes).toHaveLength(0)
  })

  it('mergeChanges applique des changements et préserve les données', () => {
    import * as A from '@automerge/automerge'
    const doc = createDoc('hh-test-5')
    const doc2 = A.change(doc, (d) => {
      d.events.push({
        id: 'evt-merge-1',
        type: 'DoseAdministered',
        payloadJson: '{}',
        signerPublicKeyHex: 'aa',
        signatureHex: 'bb',
        deviceId: 'dev-1',
        occurredAtMs: 1_700_000_000_000,
      })
    })
    const changes = getDocChanges(doc, doc2)
    const fresh = createDoc('hh-test-5')
    const merged = mergeChanges(fresh, changes)
    expect(merged.events).toHaveLength(0) // fresh n'a pas l'historique de doc
    // Correct behavior: mergeChanges applique les changements delta
    // entre doc et doc2 sur fresh — ce delta contient l'ajout de l'événement
    // seulement si fresh est déjà à l'état de doc (même base).
    // Test réaliste : même base, même foyer
    const base = createDoc('hh-test-5b')
    const copy = loadDoc(saveDoc(base))
    const updated = A.change(base, (d) => {
      d.events.push({
        id: 'evt-merge-2',
        type: 'PumpReplaced',
        payloadJson: '{}',
        signerPublicKeyHex: 'cc',
        signatureHex: 'dd',
        deviceId: 'dev-2',
        occurredAtMs: 1_700_000_000_001,
      })
    })
    const delta = getDocChanges(base, updated)
    const mergedCopy = mergeChanges(copy, delta)
    expect(mergedCopy.events).toHaveLength(1)
    expect(mergedCopy.events[0]!.id).toBe('evt-merge-2')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/doc/lifecycle.test.ts
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Implémenter lifecycle.ts**

Créer `packages/sync/src/doc/lifecycle.ts` :

```typescript
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
 * Utilisation : calculer le delta à envoyer au relais après une mutation locale.
 */
export function getDocChanges(
  before: A.Doc<KinhaleDoc>,
  after: A.Doc<KinhaleDoc>,
): Uint8Array[] {
  return A.getChanges(before, after).map((c) => new Uint8Array(c))
}

/**
 * Retourne tous les changements du document depuis sa création.
 * Utilisation : synchronisation initiale avec un nouveau device.
 */
export function getAllDocChanges(doc: A.Doc<KinhaleDoc>): Uint8Array[] {
  return A.getAllChanges(doc).map((c) => new Uint8Array(c))
}

/**
 * Applique des changements reçus du relais sur un document local.
 * Automerge garantit la convergence CRDT : l'ordre d'application n'importe pas.
 */
export function mergeChanges(
  doc: A.Doc<KinhaleDoc>,
  changes: Uint8Array[],
): A.Doc<KinhaleDoc> {
  const [newDoc] = A.applyChanges(doc, changes as unknown as A.Change[])
  return newDoc
}
```

- [ ] **Step 4 : Corriger le test (import inline invalide)**

Le test contient un `import * as A from '@automerge/automerge'` inline dans un `it()` — c'est invalide. Remplacer le contenu de `lifecycle.test.ts` par :

```typescript
import { describe, it, expect } from 'vitest'
import * as A from '@automerge/automerge'
import {
  createDoc,
  loadDoc,
  saveDoc,
  getDocChanges,
  getAllDocChanges,
  mergeChanges,
} from './lifecycle.js'
import type { SignedEventRecord } from './schema.js'

const makeRecord = (id: string): SignedEventRecord => ({
  id,
  type: 'DoseAdministered',
  payloadJson: '{}',
  signerPublicKeyHex: 'aa',
  signatureHex: 'bb',
  deviceId: 'dev-1',
  occurredAtMs: 1_700_000_000_000,
})

describe('Document lifecycle', () => {
  it('createDoc initialise un document avec householdId', () => {
    const doc = createDoc('hh-test-1')
    expect(doc.householdId).toBe('hh-test-1')
    expect(doc.events).toHaveLength(0)
  })

  it('saveDoc + loadDoc : aller-retour binaire', () => {
    const doc = createDoc('hh-test-2')
    const bytes = saveDoc(doc)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
    const loaded = loadDoc(bytes)
    expect(loaded.householdId).toBe('hh-test-2')
    expect(loaded.events).toHaveLength(0)
  })

  it('getAllDocChanges retourne des Uint8Array non vides', () => {
    const doc = createDoc('hh-test-3')
    const changes = getAllDocChanges(doc)
    expect(Array.isArray(changes)).toBe(true)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0]).toBeInstanceOf(Uint8Array)
  })

  it('getDocChanges retourne 0 changements si doc identique', () => {
    const doc = createDoc('hh-test-4')
    const changes = getDocChanges(doc, doc)
    expect(changes).toHaveLength(0)
  })

  it('mergeChanges applique un delta sur une copie du document', () => {
    const base = createDoc('hh-merge-1')
    const copy = loadDoc(saveDoc(base))
    const updated = A.change(base, (d) => {
      d.events.push(makeRecord('evt-1'))
    })
    const delta = getDocChanges(base, updated)
    const merged = mergeChanges(copy, delta)
    expect(merged.events).toHaveLength(1)
    expect(merged.events[0]!.id).toBe('evt-1')
  })

  it('mergeChanges est idempotent (double application)', () => {
    const base = createDoc('hh-merge-2')
    const copy = loadDoc(saveDoc(base))
    const updated = A.change(base, (d) => {
      d.events.push(makeRecord('evt-2'))
    })
    const delta = getDocChanges(base, updated)
    const merged1 = mergeChanges(copy, delta)
    const merged2 = mergeChanges(merged1, delta)
    expect(merged2.events).toHaveLength(1)
  })
})
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/doc/lifecycle.test.ts
```

Expected : 6 tests PASS.

- [ ] **Step 6 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/doc/
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): cycle de vie du document Automerge (create/save/load/merge)

createDoc, saveDoc, loadDoc, getDocChanges, getAllDocChanges, mergeChanges.
getDocChanges : delta entre before et after (même acteur).
getAllDocChanges : tous les changements depuis la création (sync initiale).
mergeChanges : applique changes reçus du relais, idempotent (CRDT).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4 : Types d'événements domaine

**Files:**
- Create: `packages/sync/src/events/types.ts`

Types uniquement — pas de tests (file de types purs, validée par typecheck).

- [ ] **Step 1 : Créer types.ts**

Créer `packages/sync/src/events/types.ts` :

```typescript
/** Types d'événements domaine persistés dans le document Automerge. */
export type DomainEventType =
  | 'DoseAdministered'
  | 'PumpReplaced'
  | 'PlanUpdated'
  | 'CaregiverInvited'
  | 'CaregiverRevoked'

/** Payload pour DoseAdministered */
export interface DoseAdministeredPayload {
  doseId: string
  pumpId: string
  childId: string
  caregiverId: string
  /** UTC ms */
  administeredAtMs: number
  /** 'maintenance' | 'rescue' */
  doseType: string
  dosesAdministered: number
  symptoms: string[]
  circumstances: string[]
  freeFormTag: string | null
}

/** Payload pour PumpReplaced */
export interface PumpReplacedPayload {
  pumpId: string
  name: string
  /** 'maintenance' | 'rescue' */
  pumpType: string
  totalDoses: number
  /** UTC ms, null si pas de date d'expiration connue */
  expiresAtMs: number | null
}

/** Payload pour PlanUpdated */
export interface PlanUpdatedPayload {
  planId: string
  pumpId: string
  /** Heures cibles en UTC (ex : [8, 20]) */
  scheduledHoursUtc: number[]
  /** UTC ms */
  startAtMs: number
  /** UTC ms, null si durée indéfinie */
  endAtMs: number | null
}

/** Payload pour CaregiverInvited */
export interface CaregiverInvitedPayload {
  caregiverId: string
  /** 'admin' | 'contributor' | 'restricted_contributor' */
  role: string
  displayName: string
}

/** Payload pour CaregiverRevoked */
export interface CaregiverRevokedPayload {
  caregiverId: string
}

/** Union discriminée des payloads */
export type DomainEventPayload =
  | { type: 'DoseAdministered'; payload: DoseAdministeredPayload }
  | { type: 'PumpReplaced'; payload: PumpReplacedPayload }
  | { type: 'PlanUpdated'; payload: PlanUpdatedPayload }
  | { type: 'CaregiverInvited'; payload: CaregiverInvitedPayload }
  | { type: 'CaregiverRevoked'; payload: CaregiverRevokedPayload }

/**
 * Événement non signé : données à signer avant insertion dans le document.
 * L'id et l'occurredAtMs sont générés par l'appelant.
 */
export interface UnsignedEvent {
  id: string
  deviceId: string
  occurredAtMs: number
  event: DomainEventPayload
}
```

- [ ] **Step 2 : Vérifier typecheck**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm typecheck
```

Expected : 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/events/types.ts
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): types d'événements domaine (DoseAdministered, PumpReplaced, etc.)

Union discriminée DomainEventPayload + UnsignedEvent.
5 types : DoseAdministered, PumpReplaced, PlanUpdated, CaregiverInvited,
CaregiverRevoked. Payloads sans Uint8Array (compatibilité JSON/CRDT).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5 : Signature des événements (Ed25519)

**Files:**
- Create: `packages/sync/src/events/sign.ts`
- Create: `packages/sync/src/events/sign.test.ts`

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/sync/src/events/sign.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { generateSigningKeypair } from '@kinhale/crypto'
import { signEvent, verifySignedEvent, canonicalBytes } from './sign.js'
import type { UnsignedEvent } from './types.js'

const makeUnsigned = (): UnsignedEvent => ({
  id: 'evt-sign-1',
  deviceId: 'device-001',
  occurredAtMs: 1_700_000_000_000,
  event: {
    type: 'DoseAdministered',
    payload: {
      doseId: 'd1',
      pumpId: 'p1',
      childId: 'c1',
      caregiverId: 'cg1',
      administeredAtMs: 1_700_000_000_000,
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
    },
  },
})

describe('Event signing', () => {
  it('signEvent produit un SignedEventRecord avec signatureHex non vide', async () => {
    const kp = await generateSigningKeypair()
    const record = await signEvent(makeUnsigned(), kp.secretKey)
    expect(record.id).toBe('evt-sign-1')
    expect(record.type).toBe('DoseAdministered')
    expect(record.signatureHex).toHaveLength(128) // 64 bytes Ed25519 → 128 hex chars
    expect(record.signerPublicKeyHex).toHaveLength(64) // 32 bytes → 64 hex chars
    expect(record.deviceId).toBe('device-001')
  })

  it('verifySignedEvent retourne true pour une signature valide', async () => {
    const kp = await generateSigningKeypair()
    const record = await signEvent(makeUnsigned(), kp.secretKey)
    const valid = await verifySignedEvent(record)
    expect(valid).toBe(true)
  })

  it('verifySignedEvent retourne false si le payload est altéré', async () => {
    const kp = await generateSigningKeypair()
    const record = await signEvent(makeUnsigned(), kp.secretKey)
    const tampered = { ...record, payloadJson: JSON.stringify({ doseId: 'HACKED' }) }
    const valid = await verifySignedEvent(tampered)
    expect(valid).toBe(false)
  })

  it('verifySignedEvent retourne false si la signature est corrompue', async () => {
    const kp = await generateSigningKeypair()
    const record = await signEvent(makeUnsigned(), kp.secretKey)
    const corrupted = { ...record, signatureHex: 'a'.repeat(128) }
    const valid = await verifySignedEvent(corrupted)
    expect(valid).toBe(false)
  })

  it('deux signEvent sur le même UnsignedEvent produisent la même signature', async () => {
    const kp = await generateSigningKeypair()
    const unsigned = makeUnsigned()
    const r1 = await signEvent(unsigned, kp.secretKey)
    const r2 = await signEvent(unsigned, kp.secretKey)
    expect(r1.signatureHex).toBe(r2.signatureHex)
  })

  it('canonicalBytes est déterministe', () => {
    const unsigned = makeUnsigned()
    const b1 = canonicalBytes(unsigned)
    const b2 = canonicalBytes(unsigned)
    expect(Buffer.from(b1).toString('hex')).toBe(Buffer.from(b2).toString('hex'))
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/events/sign.test.ts
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Créer sign.ts**

Créer `packages/sync/src/events/sign.ts` :

```typescript
import { sign, verify } from '@kinhale/crypto'
import type { SignedEventRecord } from '../doc/schema.js'
import type { UnsignedEvent } from './types.js'

/**
 * Retourne les bytes canoniques à signer pour un UnsignedEvent.
 * Le payload est inclus via payloadJson pour éviter les ambiguités de
 * sérialisation (order des clés JSON).
 */
export function canonicalBytes(unsigned: UnsignedEvent): Uint8Array {
  const canonical = JSON.stringify({
    id: unsigned.id,
    type: unsigned.event.type,
    payloadJson: JSON.stringify(unsigned.event.payload),
    deviceId: unsigned.deviceId,
    occurredAtMs: unsigned.occurredAtMs,
  })
  return new TextEncoder().encode(canonical)
}

/**
 * Signe un événement domaine avec la clé Ed25519 du device.
 * Retourne un SignedEventRecord prêt à être inséré dans le document Automerge.
 */
export async function signEvent(
  unsigned: UnsignedEvent,
  secretKey: Uint8Array,
): Promise<SignedEventRecord> {
  // Dériver la clé publique depuis secretKey (libsodium : secretKey = privateKey || publicKey)
  // La clé secrète libsodium Ed25519 fait 64 bytes : [32 bytes seed][32 bytes publicKey]
  const signerPublicKey = secretKey.slice(32, 64)
  const payloadJson = JSON.stringify(unsigned.event.payload)
  const bytes = canonicalBytes(unsigned)
  const signature = await sign(bytes, secretKey)

  return {
    id: unsigned.id,
    type: unsigned.event.type,
    payloadJson,
    signerPublicKeyHex: Buffer.from(signerPublicKey).toString('hex'),
    signatureHex: Buffer.from(signature).toString('hex'),
    deviceId: unsigned.deviceId,
    occurredAtMs: unsigned.occurredAtMs,
  }
}

/**
 * Vérifie la signature Ed25519 d'un SignedEventRecord.
 * Retourne false (jamais throw) si la signature est invalide ou corrompue.
 */
export async function verifySignedEvent(record: SignedEventRecord): Promise<boolean> {
  try {
    const unsigned: UnsignedEvent = {
      id: record.id,
      deviceId: record.deviceId,
      occurredAtMs: record.occurredAtMs,
      event: {
        type: record.type as UnsignedEvent['event']['type'],
        payload: JSON.parse(record.payloadJson) as UnsignedEvent['event']['payload'],
      },
    }
    const bytes = canonicalBytes(unsigned)
    const signature = Buffer.from(record.signatureHex, 'hex')
    const publicKey = Buffer.from(record.signerPublicKeyHex, 'hex')
    return await verify(bytes, signature, publicKey)
  } catch {
    return false
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/events/sign.test.ts
```

Expected : 6 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/events/sign.ts packages/sync/src/events/sign.test.ts
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): signature Ed25519 des événements domaine

signEvent() : signe les canonical bytes (id+type+payloadJson+deviceId+ms).
verifySignedEvent() : vérifie sans throw (retourne false si invalide).
canonicalBytes() : sérialisation déterministe JSON.stringify ordonnée.
Clé publique extraite des 32 derniers bytes de la secretKey libsodium.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6 : appendEvent — mutation du document CRDT

**Files:**
- Create: `packages/sync/src/events/append.ts`
- Create: `packages/sync/src/events/append.test.ts`

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/sync/src/events/append.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { generateSigningKeypair } from '@kinhale/crypto'
import { createDoc } from '../doc/lifecycle.js'
import { signEvent } from './sign.js'
import { appendEvent } from './append.js'
import type { UnsignedEvent } from './types.js'

const makeUnsigned = (id: string): UnsignedEvent => ({
  id,
  deviceId: 'device-001',
  occurredAtMs: 1_700_000_000_000 + parseInt(id.slice(-1), 10),
  event: {
    type: 'DoseAdministered',
    payload: {
      doseId: id,
      pumpId: 'p1',
      childId: 'c1',
      caregiverId: 'cg1',
      administeredAtMs: 1_700_000_000_000,
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
    },
  },
})

describe('appendEvent', () => {
  it('ajoute un SignedEventRecord au document', async () => {
    const kp = await generateSigningKeypair()
    const doc = createDoc('hh-append-1')
    const record = await signEvent(makeUnsigned('evt-1'), kp.secretKey)
    const doc2 = appendEvent(doc, record)
    expect(doc2.events).toHaveLength(1)
    expect(doc2.events[0]!.id).toBe('evt-1')
  })

  it('ne modifie pas le document original (immutabilité Automerge)', async () => {
    const kp = await generateSigningKeypair()
    const doc = createDoc('hh-append-2')
    const record = await signEvent(makeUnsigned('evt-2'), kp.secretKey)
    const doc2 = appendEvent(doc, record)
    expect(doc.events).toHaveLength(0)
    expect(doc2.events).toHaveLength(1)
  })

  it('plusieurs appendEvent préservent l\'ordre d\'insertion', async () => {
    const kp = await generateSigningKeypair()
    let doc = createDoc('hh-append-3')
    for (let i = 1; i <= 3; i++) {
      const record = await signEvent(makeUnsigned(`evt-${i}`), kp.secretKey)
      doc = appendEvent(doc, record)
    }
    expect(doc.events).toHaveLength(3)
    expect(doc.events[0]!.id).toBe('evt-1')
    expect(doc.events[2]!.id).toBe('evt-3')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/events/append.test.ts
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Créer append.ts**

Créer `packages/sync/src/events/append.ts` :

```typescript
import * as A from '@automerge/automerge'
import type { KinhaleDoc } from '../doc/schema.js'
import type { SignedEventRecord } from '../doc/schema.js'

/**
 * Ajoute un SignedEventRecord au document Automerge du foyer.
 * Retourne un nouveau document (Automerge est immutable).
 * L'appelant doit vérifier la signature avant d'appeler appendEvent.
 */
export function appendEvent(
  doc: A.Doc<KinhaleDoc>,
  record: SignedEventRecord,
): A.Doc<KinhaleDoc> {
  return A.change(doc, (d) => {
    d.events.push(record)
  })
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/events/append.test.ts
```

Expected : 3 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/events/append.ts packages/sync/src/events/append.test.ts
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): appendEvent — insertion signée dans le document CRDT

Wrapper Automerge.change() : append-only, immutable, ordre préservé.
L'appelant doit vérifier la signature avant l'appel (séparation claire).

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7 : Chiffrement des changes pour la mailbox

**Files:**
- Create: `packages/sync/src/mailbox/encrypt.ts`
- Create: `packages/sync/src/mailbox/encrypt.test.ts`

Les deltas Automerge (tableaux de `Uint8Array`) sont sérialisés en JSON de hex, puis chiffrés XChaCha20-Poly1305 avec la clé de groupe du foyer. Le relais ne voit que le blob chiffré.

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/sync/src/mailbox/encrypt.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { secretboxKeygen } from '@kinhale/crypto'
import { encryptChanges, decryptChanges } from './encrypt.js'
import type { EncryptedBlob } from './encrypt.js'

describe('encryptChanges / decryptChanges', () => {
  it('encryptChanges retourne un EncryptedBlob avec nonce et ciphertext hex', async () => {
    const key = await secretboxKeygen()
    const changes = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]
    const blob = await encryptChanges(changes, key)
    expect(typeof blob.nonce).toBe('string')
    expect(typeof blob.ciphertext).toBe('string')
    expect(blob.nonce).toHaveLength(48) // 24 bytes × 2 hex chars
    expect(blob.ciphertext.length).toBeGreaterThan(0)
  })

  it('decryptChanges restitue les Uint8Array originaux', async () => {
    const key = await secretboxKeygen()
    const original = [new Uint8Array([10, 20, 30]), new Uint8Array([40, 50])]
    const blob = await encryptChanges(original, key)
    const restored = await decryptChanges(blob, key)
    expect(restored).toHaveLength(2)
    expect(Array.from(restored[0]!)).toEqual([10, 20, 30])
    expect(Array.from(restored[1]!)).toEqual([40, 50])
  })

  it('deux encryptChanges du même plaintext → nonces différents', async () => {
    const key = await secretboxKeygen()
    const changes = [new Uint8Array([1, 2, 3])]
    const b1 = await encryptChanges(changes, key)
    const b2 = await encryptChanges(changes, key)
    expect(b1.nonce).not.toBe(b2.nonce)
    expect(b1.ciphertext).not.toBe(b2.ciphertext)
  })

  it('decryptChanges throw si la clé est incorrecte', async () => {
    const key1 = await secretboxKeygen()
    const key2 = await secretboxKeygen()
    const blob = await encryptChanges([new Uint8Array([1, 2, 3])], key1)
    await expect(decryptChanges(blob, key2)).rejects.toThrow()
  })

  it('decryptChanges fonctionne sur liste vide', async () => {
    const key = await secretboxKeygen()
    const blob = await encryptChanges([], key)
    const restored = await decryptChanges(blob, key)
    expect(restored).toHaveLength(0)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/mailbox/encrypt.test.ts
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Créer encrypt.ts**

Créer `packages/sync/src/mailbox/encrypt.ts` :

```typescript
import { secretbox, secretboxOpen, secretboxNonce } from '@kinhale/crypto'

/**
 * Blob chiffré à envoyer au relais.
 * Nonce et ciphertext sont encodés en hex pour sérialisation JSON.
 */
export interface EncryptedBlob {
  /** Hex, 24 bytes XChaCha20 nonce (48 chars) */
  readonly nonce: string
  /** Hex, plaintext chiffré + MAC Poly1305 */
  readonly ciphertext: string
}

/**
 * Chiffre un tableau de Uint8Array (changes Automerge) avec la clé de groupe.
 * Sérialisation : JSON d'un tableau de hex strings, puis XChaCha20-Poly1305.
 */
export async function encryptChanges(
  changes: Uint8Array[],
  groupKey: Uint8Array,
): Promise<EncryptedBlob> {
  const serialized = JSON.stringify(
    changes.map((c) => Buffer.from(c).toString('hex')),
  )
  const plaintext = new TextEncoder().encode(serialized)
  const nonce = await secretboxNonce()
  const ciphertext = await secretbox(plaintext, nonce, groupKey)
  return {
    nonce: Buffer.from(nonce).toString('hex'),
    ciphertext: Buffer.from(ciphertext).toString('hex'),
  }
}

/**
 * Déchiffre un EncryptedBlob et restitue le tableau de Uint8Array d'origine.
 * Throws si le MAC est invalide (clé incorrecte ou blob corrompu).
 */
export async function decryptChanges(
  blob: EncryptedBlob,
  groupKey: Uint8Array,
): Promise<Uint8Array[]> {
  const nonce = Buffer.from(blob.nonce, 'hex')
  const ciphertext = Buffer.from(blob.ciphertext, 'hex')
  const plaintext = await secretboxOpen(ciphertext, nonce, groupKey)
  const hexArray = JSON.parse(new TextDecoder().decode(plaintext)) as string[]
  return hexArray.map((h) => Buffer.from(h, 'hex'))
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/mailbox/encrypt.test.ts
```

Expected : 5 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/mailbox/encrypt.ts packages/sync/src/mailbox/encrypt.test.ts
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): chiffrement XChaCha20 des changes Automerge pour la mailbox

encryptChanges : JSON(hex[]) → XChaCha20-Poly1305 → EncryptedBlob.
decryptChanges : EncryptedBlob → JSON(hex[]) → Uint8Array[].
Nonce aléatoire par appel (secretboxNonce). Throw si MAC invalide.
Le relais reçoit uniquement l'EncryptedBlob opaque.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8 : SyncMessage + index + CI

**Files:**
- Create: `packages/sync/src/mailbox/message.ts`
- Create: `packages/sync/src/mailbox/message.test.ts`
- Create: `packages/sync/src/index.ts`

- [ ] **Step 1 : Écrire les tests pour SyncMessage (rouge)**

Créer `packages/sync/src/mailbox/message.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { encodeSyncMessage, decodeSyncMessage } from './message.js'
import type { SyncMessage } from './message.js'

const makeMsg = (): SyncMessage => ({
  mailboxId: 'mailbox-opaque-001',
  deviceId: 'device-001',
  blob: { nonce: 'a'.repeat(48), ciphertext: 'b'.repeat(64) },
  seq: 1,
  sentAtMs: 1_700_000_000_000,
})

describe('SyncMessage encode/decode', () => {
  it('encodeSyncMessage retourne une string JSON valide', () => {
    const json = encodeSyncMessage(makeMsg())
    expect(typeof json).toBe('string')
    const parsed = JSON.parse(json)
    expect(parsed.mailboxId).toBe('mailbox-opaque-001')
    expect(parsed.seq).toBe(1)
  })

  it('decodeSyncMessage restitue le message original', () => {
    const original = makeMsg()
    const json = encodeSyncMessage(original)
    const decoded = decodeSyncMessage(json)
    expect(decoded.mailboxId).toBe(original.mailboxId)
    expect(decoded.deviceId).toBe(original.deviceId)
    expect(decoded.seq).toBe(original.seq)
    expect(decoded.blob.nonce).toBe(original.blob.nonce)
  })

  it('decodeSyncMessage throw sur JSON invalide', () => {
    expect(() => decodeSyncMessage('not json')).toThrow()
  })

  it('decodeSyncMessage throw si champ obligatoire manquant', () => {
    const incomplete = JSON.stringify({ mailboxId: 'x', deviceId: 'y' })
    expect(() => decodeSyncMessage(incomplete)).toThrow('sync: message invalide')
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/mailbox/message.test.ts
```

Expected : FAIL (module not found).

- [ ] **Step 3 : Créer message.ts**

Créer `packages/sync/src/mailbox/message.ts` :

```typescript
import type { EncryptedBlob } from './encrypt.js'

/**
 * Enveloppe de synchronisation envoyée au relais (WebSocket ou HTTP).
 * Le relais indexe par mailboxId + seq mais ne peut jamais lire blob.
 */
export interface SyncMessage {
  /** Identifiant opaque du groupe/foyer (ne doit pas révéler l'householdId) */
  readonly mailboxId: string
  /** Device émetteur */
  readonly deviceId: string
  /** Contenu chiffré : changes Automerge chiffrés XChaCha20 */
  readonly blob: EncryptedBlob
  /** Numéro de séquence monotone côté émetteur (pour déduplication relais) */
  readonly seq: number
  /** Timestamp d'émission UTC ms */
  readonly sentAtMs: number
}

export function encodeSyncMessage(msg: SyncMessage): string {
  return JSON.stringify(msg)
}

export function decodeSyncMessage(json: string): SyncMessage {
  const parsed: unknown = JSON.parse(json)
  if (!isSyncMessage(parsed)) {
    throw new Error('sync: message invalide')
  }
  return parsed
}

function isSyncMessage(v: unknown): v is SyncMessage {
  if (typeof v !== 'object' || v === null) return false
  const m = v as Record<string, unknown>
  return (
    typeof m['mailboxId'] === 'string' &&
    typeof m['deviceId'] === 'string' &&
    typeof m['seq'] === 'number' &&
    typeof m['sentAtMs'] === 'number' &&
    isEncryptedBlob(m['blob'])
  )
}

function isEncryptedBlob(v: unknown): v is EncryptedBlob {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Record<string, unknown>
  return typeof b['nonce'] === 'string' && typeof b['ciphertext'] === 'string'
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test src/mailbox/message.test.ts
```

Expected : 4 tests PASS.

- [ ] **Step 5 : Créer index.ts**

Créer `packages/sync/src/index.ts` :

```typescript
// Document Automerge
export type { KinhaleDoc, SignedEventRecord } from './doc/schema.js'
export { createDoc, loadDoc, saveDoc, getDocChanges, getAllDocChanges, mergeChanges } from './doc/lifecycle.js'

// Événements domaine
export type {
  DomainEventType,
  DomainEventPayload,
  UnsignedEvent,
  DoseAdministeredPayload,
  PumpReplacedPayload,
  PlanUpdatedPayload,
  CaregiverInvitedPayload,
  CaregiverRevokedPayload,
} from './events/types.js'
export { canonicalBytes, signEvent, verifySignedEvent } from './events/sign.js'
export { appendEvent } from './events/append.js'

// Mailbox E2EE
export type { EncryptedBlob } from './mailbox/encrypt.js'
export { encryptChanges, decryptChanges } from './mailbox/encrypt.js'
export type { SyncMessage } from './mailbox/message.js'
export { encodeSyncMessage, decodeSyncMessage } from './mailbox/message.js'
```

- [ ] **Step 6 : Lancer la suite complète**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm test
```

Expected : tous les tests passent (schema + lifecycle + sign + append + encrypt + message).

- [ ] **Step 7 : Typecheck**

```bash
cd /Users/martial/development/asthma-tracker/packages/sync && pnpm typecheck
```

Expected : 0 erreurs.

- [ ] **Step 8 : CI racine**

```bash
cd /Users/martial/development/asthma-tracker && pnpm lint && pnpm typecheck && pnpm test
```

Expected : 0 erreurs lint, 0 erreurs TypeScript, tous les tests passent.

- [ ] **Step 9 : Commit**

```bash
git -C /Users/martial/development/asthma-tracker add packages/sync/src/mailbox/message.ts packages/sync/src/mailbox/message.test.ts packages/sync/src/index.ts
git -C /Users/martial/development/asthma-tracker commit -m "feat(sync): SyncMessage + index — Plan 2 complet

SyncMessage : enveloppe mailbox (mailboxId, deviceId, blob, seq, sentAtMs).
encodeSyncMessage / decodeSyncMessage avec validation de structure.
src/index.ts : exporte tout le package @kinhale/sync.
CI racine verte : lint + typecheck + tests.

Co-Authored-By: Claude <noreply@anthropic.com>"
```
