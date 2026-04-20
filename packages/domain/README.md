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

| Règle   | Description                                                        | Source specs |
| ------- | ------------------------------------------------------------------ | ------------ |
| **RM1** | Un foyer a au moins un Admin en permanence                         | §4, RM1      |
| **RM2** | Fenêtre de confirmation \[10-120 min\] + rattrapage borné à 24 h    | §4, RM2      |
| **RM3** | Pas de plan de traitement sur une pompe `rescue`                   | §4, RM3      |
| **RM4** | Prise `rescue` exige symptôme, circonstance ou tag libre           | §4, RM4      |
| **RM6** | Détection double saisie : même pompe + type à moins de 2 min       | §4, RM6      |
| **RM7** | Décompte doses pompe + alertes `pump_low` / `pump_emptied`         | §4, RM7      |
| **RM14**| Horodatage serveur autoritaire (`recordedAtUtc`) + flag sync tardive | §4, RM14     |
| **RM15**| Idempotence des saisies via `clientEventId` (UUID v4)              | §4, RM15     |
| **RM17**| Rattrapage borné : backfill ≤ 24 h, futur refusé, confirmation au-delà | §4, RM17 |
| **RM18**| Annulation : 30 min libres pour l'auteur ou un Admin, puis Admin + raison | §4, RM18 |

Les règles RM5, RM8, RM9 arrivent dans les PRs suivantes.

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
