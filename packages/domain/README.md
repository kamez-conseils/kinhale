# @kinhale/domain

Entités métier et règles RM1-RM9 du projet Kinhale. **Pure TypeScript, aucun I/O** : ni réseau, ni base, ni fichier, ni date du système en argument implicite. Chaque règle est une fonction pure ou presque (horloge injectée quand nécessaire).

## Principes

- **Pureté** : tout est déterministe et testable sans infrastructure.
- **Immuabilité** : les fonctions renvoient de nouvelles instances, jamais de mutation in-place.
- **Erreurs typées** : `DomainError` avec `code` machine-readable pour mapping HTTP dans `apps/api`.
- **Coverage ≥ 80 %** (seuil CLAUDE.md pour les paquets critiques).

## Structure

```text
src/
├── entities/         Types purs : Household, Caregiver, Child, Pump, Role…
├── rules/            Règles RM1-RM9 (fonctions pures)
├── errors.ts         DomainError + codes d'erreur
└── index.ts          Barrel export
```

## Règles implémentées

| Règle   | Description                                | Source specs |
| ------- | ------------------------------------------ | ------------ |
| **RM1** | Un foyer a au moins un Admin en permanence | §4, RM1      |

Les règles RM2-RM9 arrivent dans les PRs suivantes (`KIN-005`+).

## Usage

```ts
import { ensureAtLeastOneAdmin, DomainError } from '@kinhale/domain';

try {
  ensureAtLeastOneAdmin(household, { removingCaregiverId: 'caregiver-42' });
} catch (err) {
  if (err instanceof DomainError && err.code === 'RM1_LAST_ADMIN_REMOVAL') {
    // UI propose : promouvoir un contributeur ou supprimer le foyer
  }
}
```
