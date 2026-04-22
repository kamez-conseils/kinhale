# Sprint 0 — Plan 1 : Foundation (crypto + docker + test-utils)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre `packages/crypto` avec les primitives libsodium (Ed25519, X25519, XChaCha20-Poly1305, Argon2id), créer `infra/docker/docker-compose.yml` pour le dev local, et créer `packages/test-utils` avec les helpers partagés.

**Architecture:** `packages/crypto` wrap libsodium-wrappers (API Web Crypto-compatible, zéro import direct de libsodium dans les autres packages). `infra/docker` fournit Postgres 16, Redis 7, Mailpit et MinIO (compatible R2). `packages/test-utils` expose des factories de données de test et des helpers crypto pour les tests des autres packages.

**Tech Stack:** libsodium-wrappers 0.7+, libsodium-wrappers-sumo (pour Argon2id), Docker Compose v2, Vitest, pnpm workspaces, TypeScript 5.7 strict.

---

## Fichiers créés ou modifiés

```
packages/crypto/
  package.json                          ← ajouter libsodium-wrappers + types
  src/index.ts                          ← exporter toutes les primitives
  src/sign/                             ← Ed25519 sign/verify/keygen
    ed25519.ts
    ed25519.test.ts
  src/box/                              ← X25519 + XChaCha20-Poly1305
    xchacha20.ts
    xchacha20.test.ts
  src/kdf/                              ← Argon2id key derivation
    argon2id.ts
    argon2id.test.ts
  src/random/                           ← randombytes sécurisé
    random.ts
    random.test.ts
  src/sodium.ts                         ← init singleton libsodium

packages/test-utils/
  package.json
  tsconfig.json
  vitest.config.ts
  eslint.config.js
  src/index.ts
  src/factories/
    household.ts                        ← createTestHousehold()
    caregiver.ts                        ← createTestCaregiver()
    dose.ts                             ← createTestDose()
    pump.ts                             ← createTestPump()
  src/crypto/
    test-keys.ts                        ← paires de clés déterministes pour tests

infra/docker/
  docker-compose.yml                    ← postgres, redis, mailpit, minio
  .env.docker                           ← variables d'environnement docker
  README.md                             ← guide démarrage dev local

.env.example                            ← créer à la racine
```

---

## Task 1 : Initialiser libsodium dans packages/crypto

**Files:**
- Modify: `packages/crypto/package.json`
- Create: `packages/crypto/src/sodium.ts`

- [ ] **Step 1 : Ajouter libsodium-wrappers aux dépendances**

```bash
cd packages/crypto
pnpm add libsodium-wrappers libsodium-wrappers-sumo
pnpm add -D @types/libsodium-wrappers @types/libsodium-wrappers-sumo
```

- [ ] **Step 2 : Vérifier que les types sont présents**

```bash
ls node_modules/@types/libsodium-wrappers/index.d.ts
```

Expected : le fichier existe.

- [ ] **Step 3 : Créer le singleton d'initialisation**

Créer `packages/crypto/src/sodium.ts` :

```typescript
import _sodium from 'libsodium-wrappers-sumo'

let _ready = false

export async function getSodium(): Promise<typeof _sodium> {
  if (!_ready) {
    await _sodium.ready
    _ready = true
  }
  return _sodium
}
```

> libsodium-wrappers-sumo inclut Argon2id (absent de la version de base). On utilise sumo partout pour cohérence.

- [ ] **Step 4 : Écrire le test de smoke**

Créer `packages/crypto/src/sodium.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { getSodium } from './sodium.js'

describe('getSodium', () => {
  it('retourne une instance libsodium initialisée', async () => {
    const sodium = await getSodium()
    expect(sodium.SODIUM_VERSION_STRING).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('retourne la même instance au second appel', async () => {
    const a = await getSodium()
    const b = await getSodium()
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 5 : Lancer le test et vérifier qu'il passe**

```bash
cd packages/crypto
pnpm test
```

Expected : 2 tests passent.

- [ ] **Step 6 : Commit**

```bash
git add packages/crypto/
git commit -m "feat(crypto): initialise libsodium-wrappers-sumo singleton"
```

---

## Task 2 : Ed25519 — signature et vérification

**Files:**
- Create: `packages/crypto/src/sign/ed25519.ts`
- Create: `packages/crypto/src/sign/ed25519.test.ts`

- [ ] **Step 1 : Écrire les tests Ed25519 (rouge)**

Créer `packages/crypto/src/sign/ed25519.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  generateSigningKeypair,
  sign,
  verify,
} from './ed25519.js'

describe('Ed25519', () => {
  it('génère une paire de clés valide (32 + 64 octets)', async () => {
    const kp = await generateSigningKeypair()
    expect(kp.publicKey).toHaveLength(32)
    expect(kp.secretKey).toHaveLength(64)
  })

  it('signe un message et le vérifie correctement', async () => {
    const kp = await generateSigningKeypair()
    const message = new TextEncoder().encode('événement:dose_administered')
    const sig = await sign(message, kp.secretKey)
    expect(sig).toHaveLength(64)
    const ok = await verify(message, sig, kp.publicKey)
    expect(ok).toBe(true)
  })

  it('rejette une signature modifiée', async () => {
    const kp = await generateSigningKeypair()
    const message = new TextEncoder().encode('événement:dose_administered')
    const sig = await sign(message, kp.secretKey)
    sig[0] ^= 0xff // corrompt le premier octet
    const ok = await verify(message, sig, kp.publicKey)
    expect(ok).toBe(false)
  })

  it('rejette une signature avec la mauvaise clé publique', async () => {
    const kp1 = await generateSigningKeypair()
    const kp2 = await generateSigningKeypair()
    const message = new TextEncoder().encode('événement:dose_administered')
    const sig = await sign(message, kp1.secretKey)
    const ok = await verify(message, sig, kp2.publicKey)
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd packages/crypto && pnpm test src/sign/ed25519.test.ts
```

Expected : FAIL — module non trouvé.

- [ ] **Step 3 : Implémenter ed25519.ts**

Créer `packages/crypto/src/sign/ed25519.ts` :

```typescript
import { getSodium } from '../sodium.js'

export interface SigningKeypair {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export async function generateSigningKeypair(): Promise<SigningKeypair> {
  const sodium = await getSodium()
  const kp = sodium.crypto_sign_keypair()
  return { publicKey: kp.publicKey, secretKey: kp.privateKey }
}

export async function sign(
  message: Uint8Array,
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.crypto_sign_detached(message, secretKey)
}

export async function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  const sodium = await getSodium()
  try {
    return sodium.crypto_sign_verify_detached(signature, message, publicKey)
  } catch {
    return false
  }
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd packages/crypto && pnpm test src/sign/ed25519.test.ts
```

Expected : 4 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add packages/crypto/src/sign/
git commit -m "feat(crypto): Ed25519 sign/verify/keygen via libsodium"
```

---

## Task 3 : XChaCha20-Poly1305 — chiffrement symétrique authentifié

**Files:**
- Create: `packages/crypto/src/box/xchacha20.ts`
- Create: `packages/crypto/src/box/xchacha20.test.ts`

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/crypto/src/box/xchacha20.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  secretboxKeygen,
  secretboxNonce,
  secretbox,
  secretboxOpen,
} from './xchacha20.js'

describe('XChaCha20-Poly1305', () => {
  it('génère une clé de 32 octets', async () => {
    const key = await secretboxKeygen()
    expect(key).toHaveLength(32)
  })

  it('génère un nonce de 24 octets', async () => {
    const nonce = await secretboxNonce()
    expect(nonce).toHaveLength(24)
  })

  it('chiffre et déchiffre un blob', async () => {
    const key = await secretboxKeygen()
    const nonce = await secretboxNonce()
    const plaintext = new TextEncoder().encode('données santé chiffrées')
    const ciphertext = await secretbox(plaintext, nonce, key)
    expect(ciphertext.length).toBeGreaterThan(plaintext.length)
    const decrypted = await secretboxOpen(ciphertext, nonce, key)
    expect(new TextDecoder().decode(decrypted)).toBe('données santé chiffrées')
  })

  it('rejette un ciphertext altéré', async () => {
    const key = await secretboxKeygen()
    const nonce = await secretboxNonce()
    const plaintext = new TextEncoder().encode('données santé chiffrées')
    const ciphertext = await secretbox(plaintext, nonce, key)
    ciphertext[0] ^= 0xff
    await expect(secretboxOpen(ciphertext, nonce, key)).rejects.toThrow()
  })

  it('deux nonces différents produisent deux ciphertexts différents', async () => {
    const key = await secretboxKeygen()
    const n1 = await secretboxNonce()
    const n2 = await secretboxNonce()
    const msg = new TextEncoder().encode('test')
    const c1 = await secretbox(msg, n1, key)
    const c2 = await secretbox(msg, n2, key)
    expect(Buffer.from(c1).toString('hex')).not.toBe(Buffer.from(c2).toString('hex'))
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd packages/crypto && pnpm test src/box/xchacha20.test.ts
```

Expected : FAIL.

- [ ] **Step 3 : Implémenter xchacha20.ts**

Créer `packages/crypto/src/box/xchacha20.ts` :

```typescript
import { getSodium } from '../sodium.js'

export async function secretboxKeygen(): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.crypto_secretbox_keygen()
}

export async function secretboxNonce(): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
}

export async function secretbox(
  plaintext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.crypto_secretbox_easy(plaintext, nonce, key)
}

export async function secretboxOpen(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Promise<Uint8Array> {
  const sodium = await getSodium()
  const result = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key)
  if (!result) throw new Error('crypto: déchiffrement échoué — MAC invalide')
  return result
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd packages/crypto && pnpm test src/box/xchacha20.test.ts
```

Expected : 5 tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add packages/crypto/src/box/
git commit -m "feat(crypto): XChaCha20-Poly1305 secretbox via libsodium"
```

---

## Task 4 : Argon2id — dérivation de clé depuis la recovery seed

**Files:**
- Create: `packages/crypto/src/kdf/argon2id.ts`
- Create: `packages/crypto/src/kdf/argon2id.test.ts`

- [ ] **Step 1 : Écrire les tests (rouge)**

Créer `packages/crypto/src/kdf/argon2id.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { deriveKey, generateSalt, ARGON2ID_PARAMS } from './argon2id.js'

describe('Argon2id', () => {
  it('dérive une clé de longueur demandée', async () => {
    const salt = await generateSalt()
    const key = await deriveKey('recovery seed mnemonic 24 words', salt, 32)
    expect(key).toHaveLength(32)
  }, 15_000) // Argon2id est intentionnellement lent

  it('deux appels identiques produisent la même clé', async () => {
    const salt = await generateSalt()
    const password = 'correct horse battery staple'
    const k1 = await deriveKey(password, salt, 32)
    const k2 = await deriveKey(password, salt, 32)
    expect(Buffer.from(k1).toString('hex')).toBe(Buffer.from(k2).toString('hex'))
  }, 30_000)

  it('un salt différent produit une clé différente', async () => {
    const s1 = await generateSalt()
    const s2 = await generateSalt()
    const password = 'correct horse battery staple'
    const k1 = await deriveKey(password, s1, 32)
    const k2 = await deriveKey(password, s2, 32)
    expect(Buffer.from(k1).toString('hex')).not.toBe(Buffer.from(k2).toString('hex'))
  }, 30_000)

  it('expose les paramètres Argon2id conformes OWASP 2024', () => {
    // OWASP recommande m>=64MB, t>=3, p=1 minimum
    expect(ARGON2ID_PARAMS.memoryCost).toBeGreaterThanOrEqual(65536) // 64 Mio en KiB
    expect(ARGON2ID_PARAMS.timeCost).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd packages/crypto && pnpm test src/kdf/argon2id.test.ts
```

Expected : FAIL.

- [ ] **Step 3 : Implémenter argon2id.ts**

Créer `packages/crypto/src/kdf/argon2id.ts` :

```typescript
import { getSodium } from '../sodium.js'

// Paramètres OWASP 2024 — intentionnellement lents pour résister aux attaques bruteforce
export const ARGON2ID_PARAMS = {
  memoryCost: 65536, // 64 Mio en KiB
  timeCost: 3,       // 3 passes
  parallelism: 1,    // 1 thread (mobile single-core compatible)
} as const

export async function generateSalt(): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES)
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  outputLen: number,
): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.crypto_pwhash(
    outputLen,
    password,
    salt,
    ARGON2ID_PARAMS.timeCost,
    ARGON2ID_PARAMS.memoryCost * 1024, // libsodium attend des octets
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd packages/crypto && pnpm test src/kdf/argon2id.test.ts
```

Expected : 4 tests PASS. Les tests Argon2id sont lents (5-10s) — c'est normal et attendu.

- [ ] **Step 5 : Commit**

```bash
git add packages/crypto/src/kdf/
git commit -m "feat(crypto): Argon2id KDF (OWASP 2024) via libsodium-sumo"
```

---

## Task 5 : randomBytes + mise à jour de l'index

**Files:**
- Create: `packages/crypto/src/random/random.ts`
- Create: `packages/crypto/src/random/random.test.ts`
- Modify: `packages/crypto/src/index.ts`

- [ ] **Step 1 : Écrire le test random (rouge)**

Créer `packages/crypto/src/random/random.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { randomBytes } from './random.js'

describe('randomBytes', () => {
  it('génère N octets aléatoires', async () => {
    const bytes = await randomBytes(32)
    expect(bytes).toHaveLength(32)
  })

  it('deux appels produisent des valeurs différentes', async () => {
    const a = await randomBytes(32)
    const b = await randomBytes(32)
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'))
  })
})
```

- [ ] **Step 2 : Implémenter random.ts**

Créer `packages/crypto/src/random/random.ts` :

```typescript
import { getSodium } from '../sodium.js'

export async function randomBytes(n: number): Promise<Uint8Array> {
  const sodium = await getSodium()
  return sodium.randombytes_buf(n)
}
```

- [ ] **Step 3 : Mettre à jour l'index principal**

Modifier `packages/crypto/src/index.ts` :

```typescript
// Existant
export { sha256Hex, sha256HexFromString } from './hash/sha256.js'

// Nouveau — libsodium primitives
export { getSodium } from './sodium.js'
export { generateSigningKeypair, sign, verify } from './sign/ed25519.js'
export type { SigningKeypair } from './sign/ed25519.js'
export { secretboxKeygen, secretboxNonce, secretbox, secretboxOpen } from './box/xchacha20.js'
export { deriveKey, generateSalt, ARGON2ID_PARAMS } from './kdf/argon2id.js'
export { randomBytes } from './random/random.js'
```

- [ ] **Step 4 : Lancer tous les tests crypto**

```bash
cd packages/crypto && pnpm test
```

Expected : tous les tests passent (y compris les anciens SHA-256).

- [ ] **Step 5 : Lancer typecheck**

```bash
cd packages/crypto && pnpm typecheck
```

Expected : 0 erreurs.

- [ ] **Step 6 : Commit**

```bash
git add packages/crypto/src/random/ packages/crypto/src/index.ts
git commit -m "feat(crypto): randomBytes + exporte toutes les primitives libsodium"
```

---

## Task 6 : packages/test-utils — factories partagées

**Files:**
- Create: `packages/test-utils/package.json`
- Create: `packages/test-utils/tsconfig.json`
- Create: `packages/test-utils/vitest.config.ts`
- Create: `packages/test-utils/eslint.config.js`
- Create: `packages/test-utils/src/index.ts`
- Create: `packages/test-utils/src/factories/household.ts`
- Create: `packages/test-utils/src/factories/caregiver.ts`
- Create: `packages/test-utils/src/factories/dose.ts`
- Create: `packages/test-utils/src/crypto/test-keys.ts`

- [ ] **Step 1 : Créer package.json**

Créer `packages/test-utils/package.json` :

```json
{
  "name": "@kinhale/test-utils",
  "version": "0.1.0",
  "description": "Helpers de test partagés pour Kinhale (factories, fixtures, crypto deterministe)",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@kinhale/crypto": "workspace:*",
    "@kinhale/domain": "workspace:*"
  },
  "devDependencies": {
    "@kinhale/eslint-config": "workspace:*",
    "@kinhale/tsconfig": "workspace:*",
    "typescript": "^5.7.3",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2 : Créer tsconfig.json**

Créer `packages/test-utils/tsconfig.json` :

```json
{
  "extends": "@kinhale/tsconfig/library.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3 : Créer eslint.config.js**

Créer `packages/test-utils/eslint.config.js` :

```js
import config from '@kinhale/eslint-config'
export default config
```

- [ ] **Step 4 : Créer les clés de test déterministes**

Créer `packages/test-utils/src/crypto/test-keys.ts` :

```typescript
import { generateSigningKeypair } from '@kinhale/crypto'

// Clés déterministes pour les tests — NE JAMAIS utiliser en production
// Générées une fois et réutilisées via le cache Vitest

let _adminKeypair: Awaited<ReturnType<typeof generateSigningKeypair>> | null = null
let _caregiverKeypair: Awaited<ReturnType<typeof generateSigningKeypair>> | null = null

export async function getAdminTestKeypair() {
  if (!_adminKeypair) _adminKeypair = await generateSigningKeypair()
  return _adminKeypair
}

export async function getCaregiverTestKeypair() {
  if (!_caregiverKeypair) _caregiverKeypair = await generateSigningKeypair()
  return _caregiverKeypair
}
```

- [ ] **Step 5 : Créer les factories**

Créer `packages/test-utils/src/factories/household.ts` :

```typescript
import type { Household } from '@kinhale/domain'

let _counter = 0

export function createTestHousehold(overrides: Partial<Household> = {}): Household {
  const id = `household-test-${++_counter}`
  return {
    id,
    name: `Foyer Test ${_counter}`,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
```

Créer `packages/test-utils/src/factories/caregiver.ts` :

```typescript
import type { Caregiver } from '@kinhale/domain'
import { Role } from '@kinhale/domain'

let _counter = 0

export function createTestCaregiver(overrides: Partial<Caregiver> = {}): Caregiver {
  const id = `caregiver-test-${++_counter}`
  return {
    id,
    householdId: 'household-test-1',
    role: Role.Admin,
    deviceId: `device-test-${_counter}`,
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
```

Créer `packages/test-utils/src/factories/dose.ts` :

```typescript
import type { Dose } from '@kinhale/domain'
import { PumpType } from '@kinhale/domain'

let _counter = 0

export function createTestDose(overrides: Partial<Dose> = {}): Dose {
  const id = `dose-test-${++_counter}`
  return {
    id,
    householdId: 'household-test-1',
    pumpId: 'pump-test-1',
    pumpType: PumpType.Controller,
    administeredAt: new Date('2026-01-01T08:00:00Z'),
    recordedAt: new Date('2026-01-01T08:00:05Z'),
    caregiverId: 'caregiver-test-1',
    voided: false,
    ...overrides,
  }
}
```

- [ ] **Step 6 : Créer l'index**

Créer `packages/test-utils/src/index.ts` :

```typescript
export { createTestHousehold } from './factories/household.js'
export { createTestCaregiver } from './factories/caregiver.js'
export { createTestDose } from './factories/dose.js'
export { getAdminTestKeypair, getCaregiverTestKeypair } from './crypto/test-keys.js'
```

- [ ] **Step 7 : Installer les dépendances et vérifier**

```bash
pnpm install
cd packages/test-utils && pnpm typecheck
```

Expected : 0 erreurs TypeScript.

> **Note** : si les types `Household`, `Caregiver`, `Dose`, `PumpType`, `Role` ne sont pas encore exportés depuis `@kinhale/domain`, ajuster les imports ou les ajouter à `packages/domain/src/index.ts` avant de continuer.

- [ ] **Step 8 : Commit**

```bash
git add packages/test-utils/
git commit -m "feat(test-utils): factories partagées household/caregiver/dose + clés crypto test"
```

---

## Task 7 : infra/docker — environnement de développement local

**Files:**
- Create: `infra/docker/docker-compose.yml`
- Create: `infra/docker/.env.docker`
- Create: `infra/docker/README.md`
- Create: `.env.example` (racine)

- [ ] **Step 1 : Créer docker-compose.yml**

Créer `infra/docker/docker-compose.yml` :

```yaml
# Environnement de développement local Kinhale
# Usage : docker compose -f infra/docker/docker-compose.yml up -d
# Compatible Coolify (production)

services:
  postgres:
    image: postgres:16-alpine
    container_name: kinhale_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: kinhale_dev
      POSTGRES_USER: kinhale
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-kinhale_dev_secret}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kinhale -d kinhale_dev"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: kinhale_redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:-kinhale_redis_dev}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD:-kinhale_redis_dev}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mailpit:
    image: axllent/mailpit:latest
    container_name: kinhale_mailpit
    restart: unless-stopped
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # UI web (http://localhost:8025)
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1

  minio:
    image: minio/minio:latest
    container_name: kinhale_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-kinhale}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-kinhale_minio_dev}
    ports:
      - "9000:9000"   # API S3-compatible (équivalent R2)
      - "9001:9001"   # Console web (http://localhost:9001)
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  default:
    name: kinhale_dev
```

- [ ] **Step 2 : Créer .env.docker**

Créer `infra/docker/.env.docker` :

```bash
# Variables docker-compose développement local
# NE PAS COMMITTER de vraies valeurs de production ici
POSTGRES_PASSWORD=kinhale_dev_secret
REDIS_PASSWORD=kinhale_redis_dev
MINIO_ROOT_USER=kinhale
MINIO_ROOT_PASSWORD=kinhale_minio_dev
```

- [ ] **Step 3 : Créer .env.example à la racine**

Créer `.env.example` :

```bash
# Copier vers .env et remplir les valeurs
# cp .env.example .env

# Base de données
DATABASE_URL=postgresql://kinhale:kinhale_dev_secret@localhost:5432/kinhale_dev

# Redis
REDIS_URL=redis://:kinhale_redis_dev@localhost:6379

# Stockage blobs (MinIO local = équivalent Cloudflare R2)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=kinhale-relay-blobs
STORAGE_ACCESS_KEY_ID=kinhale
STORAGE_SECRET_ACCESS_KEY=kinhale_minio_dev
STORAGE_REGION=us-east-1

# Email (Mailpit local = équivalent Resend)
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=noreply@kinhale.health

# JWT
JWT_SECRET=dev_jwt_secret_change_in_production_minimum_32_chars

# App
NODE_ENV=development
PORT=3000
```

- [ ] **Step 4 : Créer infra/docker/README.md**

Créer `infra/docker/README.md` :

```markdown
# Environnement de développement local Kinhale

## Démarrage

```bash
# Depuis la racine du projet
docker compose -f infra/docker/docker-compose.yml up -d

# Vérifier que tout est healthy
docker compose -f infra/docker/docker-compose.yml ps
```

## Services disponibles

| Service | Port | UI |
|---|---|---|
| PostgreSQL 16 | 5432 | — |
| Redis 7 | 6379 | — |
| Mailpit (SMTP + UI) | 1025 / 8025 | http://localhost:8025 |
| MinIO (S3-compatible / R2) | 9000 / 9001 | http://localhost:9001 |

## Initialiser MinIO (premier démarrage)

```bash
# Créer le bucket kinhale-relay-blobs
docker exec kinhale_minio mc alias set local http://localhost:9000 kinhale kinhale_minio_dev
docker exec kinhale_minio mc mb local/kinhale-relay-blobs
```

## Arrêt

```bash
docker compose -f infra/docker/docker-compose.yml down
# Pour supprimer les volumes (reset complet) :
docker compose -f infra/docker/docker-compose.yml down -v
```
```

- [ ] **Step 5 : Vérifier que docker-compose démarre correctement**

```bash
docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml ps
```

Expected : 4 services en état `healthy` ou `running`.

- [ ] **Step 6 : Vérifier la connexion PostgreSQL**

```bash
docker exec kinhale_postgres psql -U kinhale -d kinhale_dev -c "SELECT version();"
```

Expected : affiche la version PostgreSQL 16.x.

- [ ] **Step 7 : Vérifier MinIO**

```bash
docker exec kinhale_minio mc alias set local http://localhost:9000 kinhale kinhale_minio_dev
docker exec kinhale_minio mc mb local/kinhale-relay-blobs
docker exec kinhale_minio mc ls local/
```

Expected : `[DATE] kinhale-relay-blobs/`

- [ ] **Step 8 : Ajouter .env.example et docker au .gitignore si nécessaire**

Vérifier que `.env` (pas `.env.example`) est bien dans `.gitignore` :

```bash
grep "^\.env$" .gitignore || echo ".env" >> .gitignore
```

- [ ] **Step 9 : Commit**

```bash
git add infra/docker/ .env.example .gitignore
git commit -m "feat(infra): docker-compose dev local (postgres, redis, mailpit, minio)"
```

---

## Task 8 : Vérification finale et CI

- [ ] **Step 1 : Lancer la suite complète depuis la racine**

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

Expected : 0 erreurs lint, 0 erreurs TypeScript, tous les tests passent.

- [ ] **Step 2 : Vérifier la couverture crypto**

```bash
cd packages/crypto && pnpm test --coverage
```

Expected : couverture > 80% sur toutes les métriques.

- [ ] **Step 3 : Vérifier que la CI passe**

```bash
git push origin feature/KIN-017-rm23-geolocation-opt-in
```

Vérifier que le workflow `.github/workflows/ci.yml` passe sur GitHub Actions.

- [ ] **Step 4 : Commit de synthèse si nécessaire**

```bash
git add .
git commit -m "chore(sprint0): Plan 1 Foundation — crypto libsodium + docker + test-utils"
```

---

## Notes importantes

**Argon2id en tests :** les tests Argon2id sont volontairement lents (5-10s chacun). Ne pas réduire les paramètres dans les tests — cela invaliderait la validation des paramètres OWASP. Si le timeout Vitest est trop court, augmenter dans `vitest.config.ts` : `testTimeout: 30_000`.

**libsodium-wrappers-sumo vs standard :** on utilise `-sumo` qui inclut Argon2id. La version standard ne l'a pas. Ne pas substituer par `libsodium-wrappers` sans sumo.

**Types domain dans test-utils :** les factories dépendent des types exportés par `@kinhale/domain`. Si un type (`Household`, `Caregiver`, etc.) n'est pas encore exporté, l'ajouter à `packages/domain/src/index.ts` plutôt que de contourner dans test-utils.

**MinIO ↔ Cloudflare R2 :** MinIO expose une API S3-compatible. Le code applicatif utilise `@aws-sdk/client-s3` avec l'endpoint configuré via `STORAGE_ENDPOINT`. En production, changer `STORAGE_ENDPOINT` vers l'endpoint R2 de Cloudflare. Zéro changement de code.
