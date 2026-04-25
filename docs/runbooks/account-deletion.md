# Runbook — Suppression de compte/foyer (KIN-086)

Ce runbook complète l'implémentation **E9-S03 + E9-S04** (KIN-086) avec les
points opérationnels qui dépassent le périmètre code (infra, backups,
incident).

## Vue d'ensemble du flux

1. **Déclenchement (J0)** : l'utilisateur saisit le mot de confirmation
   (`SUPPRIMER` / `DELETE`) + son adresse e-mail dans
   `Paramètres → Confidentialité`.
2. **Step-up auth** : un e-mail magic link spécifique (TTL 5 min, scope
   `account_deletion`) est envoyé.
3. **Confirmation** : l'utilisateur clique le lien → `POST /me/account/deletion-confirm`
   bascule le compte en `pending_deletion`,
   `deletion_scheduled_at_ms = now + 7 jours`. Audit
   `account_deletion_requested` créé.
4. **Période de grâce 7 jours** : le compte reste fonctionnel mais affiche
   un bandeau d'avertissement permanent. L'utilisateur peut annuler à tout
   moment depuis Settings ou via l'e-mail T0.
5. **Purge automatique (J+7)** : le worker `account-purge` (intervalle 1 h)
   sélectionne tous les comptes échus, exécute en transaction :
   - INSERT `deleted_accounts(pseudo_id, deleted_at_ms, household_id)`
     (idempotent via PK).
   - INSERT audit `account_deleted` (FK SET NULL après cascade).
   - DELETE `mailbox_messages` du foyer.
   - DELETE `accounts` → cascade automatique sur `devices`, `push_tokens`,
     `user_notification_preferences`, `user_quiet_hours`,
     `account_deletion_step_up_tokens`.
6. **Backups rotatifs (J+30)** : voir section ci-dessous.

## Backups rotatifs J+30

**État v1.0** : la rotation des backups Postgres ECS / RDS n'est pas encore
configurée — c'est un sujet **infra/CDK** qui sortira dans une story dédiée
(suivi via issue infra). En attendant :

- Les backups RDS automatiques (point-in-time recovery) sont conservés 7 j
  par défaut sur `ca-central-1`.
- Pour atteindre la promesse RM10 (purge sous 30 j max y compris backups),
  il faut configurer `BackupRetentionPeriod = 30` (CDK) puis s'assurer
  qu'aucun snapshot manuel ne déborde.
- Une fois v1.1 stable, ajouter un cron `aws rds delete-db-snapshot` pour
  purger explicitement les snapshots manuels antérieurs au compte purgé,
  filtré par tag.

## Incident — corruption / rollback

Si une purge a été déclenchée par erreur (ex. bug client compromis) **avant**
J+7 :
- Annuler depuis l'UI ou via `POST /me/account/deletion-cancel`.

Si la purge est passée **après J+7** (compte physiquement absent de
`accounts`) :
- **Restauration backup** est la seule option. Cf. runbook `infra/restore.md`
  (à créer — v1.1).
- Communiquer avec l'utilisateur : la purge est conforme au design, pas un
  incident.

## Surveillance

Logs structurés émis par le worker (CloudWatch / Sentry) :

- `event=account_purge.tick` — un tick a tourné, `purged=N` comptes purgés.
- `event=account_purge.ok` — un compte particulier purgé (avec `pseudoId`
  uniquement, jamais `accountId` en clair).
- `event=account_purge.error` — échec sur un compte (continue avec les
  autres).

Alarme recommandée : déclencher un PagerDuty si > 5 erreurs / heure (signe
d'un problème DB).

## Sécurité

- **Step-up auth obligatoire** : aucun endpoint critique ne peut être
  appelé sans le token TTL 5 min reçu par e-mail.
- **Anti-replay** : `used_at` empêche la réutilisation du token.
- **Pseudonymisation** : `pseudo_id = SHA-256(account_id || pepper)` —
  pepper = `JWT_SECRET`. Rotation périodique non v1.0.
- **Cascades DB** : tester en intégration que la cascade ne laisse pas de
  FK orpheline.

## Issues de suivi

- **KIN-086-FU1** : configurer la rétention RDS 30 j + script de purge
  manuelle des snapshots (infra/CDK).
- **KIN-086-FU2** : passer en revue `kz-conformite` la stratégie de
  pseudonymisation 12 mois (table `deleted_accounts`).
- **KIN-086-FU3** : ajouter une vraie 2FA (TOTP / passkey) sur le step-up
  v1.1, en remplacement du magic link 5 min.

## Références

- `apps/api/src/account-deletion/` — service de purge + pseudo-id
- `apps/api/src/routes/account-deletion.ts` — endpoints
- `apps/api/src/workers/account-purge.ts` — worker périodique
- ADR-D14 — zero-knowledge & pseudonymisation
- RM10 — droit à l'oubli
- RGPD art. 17 / Loi 25 art. 28
