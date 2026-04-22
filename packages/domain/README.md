# @kinhale/domain

Entités métier et règles RMx du projet Kinhale. **Pure TypeScript, aucun I/O** : ni réseau, ni base, ni fichier, ni date du système en argument implicite. Chaque règle est une fonction pure ou presque (horloge injectée quand nécessaire).

## Principes

- **Pureté** : tout est déterministe et testable sans infrastructure.
- **Immuabilité** : les fonctions renvoient de nouvelles instances, jamais de mutation in-place.
- **Erreurs typées** : `DomainError` avec `code` machine-readable pour mapping HTTP dans `apps/api`.
- **Coverage ≥ 80 %** (seuil CLAUDE.md pour les paquets critiques).

## Structure

```text
src/
├── entities/         Types purs : Household, Caregiver, Child, Pump, Role…
├── rules/            Règles RMx (fonctions pures)
├── errors.ts         DomainError + codes d'erreur
└── index.ts          Barrel export
```

## Règles implémentées

| Règle   | Description                                                        | Source specs |
| ------- | ------------------------------------------------------------------ | ------------ |
| **RM1**  | Un foyer a au moins un Admin en permanence                                  | §4, RM1  |
| **RM2**  | Fenêtre de confirmation \[10-120 min\] + rattrapage borné à 24 h            | §4, RM2  |
| **RM3**  | Pas de plan de traitement sur une pompe `rescue`                            | §4, RM3  |
| **RM4**  | Prise `rescue` exige symptôme, circonstance ou tag libre                    | §4, RM4  |
| **RM5**  | Notification croisée aux autres aidants actifs non-restricted               | §4, RM5  |
| **RM6**  | Détection double saisie : même pompe + type à moins de 2 min                | §4, RM6  |
| **RM7**  | Décompte doses pompe + alertes `pump_low` / `pump_emptied`                  | §4, RM7  |
| **RM8**  | Rapport médecin : agrégation confirmed/voided, fréquence rescue hebdomadaire | §4, RM8 |
| **RM9**  | Acceptation CGU / Politique : version semver, tolérance NTP, majeurs cohérents | §4, RM9 |
| **RM10** | Suppression foyer : grâce 7 j, portabilité, pseudonymisation audit          | §4, RM10 |
| **RM11** | Multi-tenant : anti-IDOR tenant + caregiver (token vs requête)              | §4, RM11 |
| **RM12** | Session restreinte : TTL 8 h, révocation Admin, idempotente                 | §4, RM12 |
| **RM13** | Un seul enfant par foyer en v1.0 (1:1, 1:N en v1.1)                         | §4, RM13 |
| **RM14** | Horodatage serveur autoritaire (`recordedAtUtc`) + flag sync tardive        | §4, RM14 |
| **RM15** | Idempotence des saisies via `clientEventId` (UUID v4)                       | §4, RM15 |
| **RM16** | Push opaque : titre/corps génériques, zéro donnée santé dans le payload     | §4, RM16 |
| **RM17** | Rattrapage borné : backfill ≤ 24 h, futur refusé, confirmation au-delà      | §4, RM17 |
| **RM18** | Annulation : 30 min libres pour l'auteur ou un Admin, puis Admin + raison   | §4, RM18 |
| **RM19** | Expiration pompe : warning J-30, blocage à échéance sauf override Admin     | §4, RM19 |
| **RM20** | Hors-ligne : lecture 30 j + écriture toujours autorisée                     | §4, RM20 |
| **RM21** | Limite anti-spam : max 10 invitations actives simultanées par foyer         | §4, RM21 |
| **RM22** | Consentement aidant invité : propres données uniquement, pas l'enfant       | §4, RM22 |
| **RM23** | Opt-in géoloc par aidant, jamais pour `restricted_contributor`              | §4, RM23 |
| **RM24** | Intégrité rapport : SHA-256 du contenu + timestamp + générateur (pied PDF)  | §4, RM24 |
| **RM25** | Rappels bornés : 2 relances max (push T+15 min, e-mail T+30 min)            | §4, RM25 |
| **RM26** | Regroupement notifications peer : ≥ 3 prises/h + cap 15 notif/jour          | §4, RM26 |
| **RM27** | Disclaimer omniprésent aux 4 surfaces (onboarding, CGU, rapport, À propos)  | §4, RM27 |
| **RM28** | Purge invitations : `expired > 30 j`, `consumed > 90 j`, `revoked > 30 j`   | §4, RM28 |

La v1.0 du domaine est **complète à 28/28** : toutes les règles métier définies dans SPECS §4 sont implémentées, testées (`packages/domain/src/rules/`) et exportées par `@kinhale/domain`.

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
