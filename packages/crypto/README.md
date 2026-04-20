# @kinhale/crypto

Primitives cryptographiques du projet Kinhale. **Web Crypto API native, zéro dépendance externe.** Aucun polyfill, aucune implémentation logicielle : si l'environnement ne fournit pas `globalThis.crypto.subtle`, le package lève `CRYPTO_UNAVAILABLE` plutôt que de dégrader vers un algorithme plus faible.

## Règle d'usage dans le monorepo

> **Toutes les opérations cryptographiques du projet passent par `@kinhale/crypto`.**
> Aucun autre package ne doit importer `libsodium-wrappers`, `crypto-js`, `js-sha256`, ni accéder directement à `globalThis.crypto` ou `node:crypto`. La règle ESLint `no-restricted-imports` bloque les premières ; la revue (`kz-securite`) bloque les secondes.

Motivation : auditabilité. Une fuite de primitive crypto faible ou une mauvaise utilisation d'un AEAD est un incident P0 — cf. `CLAUDE.md`. Concentrer toutes les opérations sensibles ici permet de cibler l'audit et de tester collectivement les cas limites (déterminisme, encodage, tolérances NTP).

## Runtime supporté

- **Node 20 LTS** : `globalThis.crypto` est globalement exposé depuis Node 19.0. Aucun import de `node:crypto` requis.
- **Navigateurs modernes** : Chrome 67+, Firefox 57+, Safari 11+.
- **React Native 0.74+ / Expo SDK 52** : fourni via polyfill du runtime Hermes (à vérifier côté `apps/mobile`).

## Structure

```text
src/
├── hash/
│   └── sha256.ts     SHA-256 via SubtleCrypto
└── index.ts          Barrel export
```

## API actuelle (v0.1.0)

```ts
import { sha256Hex, sha256HexFromString } from '@kinhale/crypto';

await sha256HexFromString(''); // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
await sha256Hex(new Uint8Array([0xff])); // "a8100ae6..."
```

Les digests sont retournés en **hex minuscule, 64 caractères** (format stable, testable par regex `^[0-9a-f]{64}$`).

## Extensions à venir

Ce scaffold minimal cible RM24 (intégrité rapport). Les primitives suivantes seront ajoutées dans des PRs dédiées, toujours via ce package :

- Argon2id (KDF recovery seed)
- XChaCha20-Poly1305 AEAD
- Ed25519 / X25519 (libsodium)
- MLS (openmls) + fallback Double Ratchet

## Licence

AGPL-3.0-only — voir `LICENSE` à la racine du monorepo.
