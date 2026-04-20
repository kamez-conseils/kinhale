# @kinhale/eslint-config

Configuration ESLint 9 (flat config) partagée du monorepo Kinhale.

## Règles non-négociables héritées

- Pas de `any` implicite.
- Pas de `console.log` (sauf `warn` / `error`).
- `Math.random` interdit dans tout le code applicatif (règle Semgrep additionnelle en CI sécurité).
- Imports interdits : `libsodium-wrappers`, `crypto-js` — tout passe par `@kinhale/crypto`.
- Imports de types forcés en `import type`.
- `===` / `!==` stricts (sauf comparaison à `null`).

## Usage

```js
// eslint.config.js d'un paquet ou d'une app
import kinhale from '@kinhale/eslint-config';

export default [
  ...kinhale,
  // règles spécifiques au paquet ici
];
```

Les paquets sensibles (`@kinhale/crypto`, `@kinhale/sync`) ajoutent leur propre surcharche plus stricte en sus.
