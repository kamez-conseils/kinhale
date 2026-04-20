# @kinhale/tsconfig

Configurations TypeScript partagées du monorepo Kinhale. Toutes étendent `tsconfig.base.json` à la racine, qui fixe les invariants stricts du projet (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## Presets

| Preset              | Cible                                      | Usage         |
| ------------------- | ------------------------------------------ | ------------- |
| `library.json`      | Paquets internes (crypto, sync, domain, …) | `packages/*`  |
| `fastify.json`      | API Fastify 5 (Node 20 LTS, ESM)           | `apps/api`    |
| `next.json`         | Next.js 15 (app router, React 19)          | `apps/web`    |
| `react-native.json` | React Native / Expo SDK 52 (iOS + Android) | `apps/mobile` |

## Utilisation

Dans un paquet :

```jsonc
// packages/crypto/tsconfig.json
{
  "extends": "@kinhale/tsconfig/library.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
  },
  "include": ["src"],
}
```

Dans une app Fastify :

```jsonc
// apps/api/tsconfig.json
{
  "extends": "@kinhale/tsconfig/fastify.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
  },
  "include": ["src"],
}
```
