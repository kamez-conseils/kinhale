# Runbook — Migrations DB et rollback

> **Tracking** : KIN-092 / E14-S05.
> **Périmètre** : relais Kinhale (`apps/api`) — base PostgreSQL 16 sur RDS
> en prod, container local en dev.
> **Audience** : opérateurs SRE, mainteneurs API, on-call.

Ce runbook décrit la convention `up.sql` / `down.sql`, le script de
rollback, la procédure pour annuler une migration en prod / dev, et les
limites connues (cas où un `down.sql` ne suffit pas).

---

## 1. Convention de nommage

Chaque migration Drizzle est un couple de fichiers co-localisés dans
`apps/api/src/db/migrations/` :

```
NNNN_<tag>.sql            # up — généré par drizzle-kit
NNNN_<tag>.down.sql       # down — écrit MANUELLEMENT, jamais généré
NNNN_<tag>.sql            # …
NNNN_<tag>.down.sql
```

Le journal `meta/_journal.json` ne référence que la « up » : les
fichiers `.down.sql` sont découverts par convention de nom.

**Bloquant CI** : la suite `rollback.unit.test.ts` charge le journal et
échoue si un `down.sql` est manquant. Toute PR qui ajoute une migration
sans son rollback est rejetée par la CI.

---

## 2. Écrire un `down.sql`

Inverser exactement la « up », dans l'ordre inverse, avec des clauses
**idempotentes** (le test `chaque down.sql est idempotent` enforce cette
règle en l'appliquant deux fois) :

| Up                          | Down idempotent                                            |
| --------------------------- | ---------------------------------------------------------- |
| `CREATE TABLE x (...)`      | `DROP TABLE IF EXISTS "x"` (ajouter `CASCADE` si FK)       |
| `ALTER TABLE x ADD COLUMN y`| `ALTER TABLE IF EXISTS "x" DROP COLUMN IF EXISTS "y"`      |
| `CREATE INDEX ix ON x ...`  | `DROP INDEX IF EXISTS "ix"`                                |
| `ALTER TABLE x ADD CONSTRAINT cn ...` | `ALTER TABLE x DROP CONSTRAINT IF EXISTS "cn"`     |
| `ALTER COLUMN ... SET NOT NULL` | `ALTER COLUMN ... DROP NOT NULL`                       |

Pour les opérations **conditionnelles** (par exemple restaurer une FK
sur une table qui a pu être supprimée par un rollback précédent),
encapsuler dans un `DO $$ … $$` plpgsql :

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_events'
  ) THEN
    ALTER TABLE "audit_events" ALTER COLUMN "account_id" SET NOT NULL;
  END IF;
END
$$;
```

Le séparateur de statements **doit** être `--> statement-breakpoint`
(même convention que la « up » Drizzle) — le runtime de rollback split
sur cette balise.

---

## 3. Script de rollback

Commande :

```bash
DATABASE_URL=postgres://… pnpm --filter @kinhale/api db:rollback
```

Comportement :

1. Charge `meta/_journal.json` et vérifie que **tous** les couples
   up/down existent (échec sinon).
2. Lit `drizzle.__drizzle_migrations` et identifie la dernière
   migration appliquée (par hash SHA-256, identique à celui calculé par
   le runtime Drizzle).
3. Ouvre une transaction, exécute chaque statement du `down.sql`,
   supprime la ligne correspondante de `__drizzle_migrations`, commit.
4. Imprime le tag rollé sur stdout.

Codes de retour :

- `0` — succès, le tag est sur stdout
- `1` — erreur (DB injoignable, journal incohérent, dernier hash absent
  du journal, statement SQL échoué) — message sur stderr

**Le script rollback UNIQUEMENT la dernière migration**. Pour rollback
plusieurs migrations, exécuter la commande N fois (chaque appel relit
l'état frais de la DB).

---

## 4. Procédure rollback — Production

> Ces étapes nécessitent un **incident commander** désigné. Aucun
> rollback prod ne se fait en solo.

1. **Drainer le trafic d'écriture** sur l'API :
   - Activer le mode read-only via le feature flag `RELAY_READ_ONLY=1`
     (ou couper le scaling à 0 et router le trafic vers une page de
     maintenance le temps du rollback).
   - Attendre la fin des transactions en cours (≤ 30 s en régime
     normal, cf. dashboard Grafana « API · in-flight requests »).
2. **Snapshot RDS** : déclencher un snapshot manuel
   (`aws rds create-db-snapshot --db-instance-identifier kinhale-prod
   --db-snapshot-identifier rollback-pre-NNNN-<timestamp>`).
   Conservation : 30 j (cf. follow-up issue #290 — rétention RDS).
3. **Vérifier** quelle migration sera rollée (sécurité) :
   ```sql
   SELECT hash, to_timestamp(created_at/1000) AS at
   FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 1;
   ```
   Croiser avec `meta/_journal.json` sur la branche déployée.
4. **Lancer le rollback** depuis un bastion :
   ```bash
   DATABASE_URL=$(aws secretsmanager get-secret-value \
     --secret-id kinhale/prod/db-url --query SecretString --output text) \
     pnpm --filter @kinhale/api db:rollback
   ```
5. **Redéployer la version applicative précédente** (rollback du
   conteneur ECS/Coolify, taggé `vX.Y.Z-1`). Le code applicatif doit
   correspondre au schéma rollé — sinon les requêtes ORM tomberont sur
   des colonnes manquantes.
6. **Vérifier l'intégrité** :
   - Healthcheck `/health` passant ;
   - Smoke tests synthétiques (login + sync batch) ;
   - Pas d'erreur SQL dans les logs CloudWatch sur 5 min.
7. **Réouvrir le trafic** : désactiver le feature flag, scale up.
8. **Post-mortem** : ouvrir un incident dans Linear, lien vers le tag
   rollé, snapshot RDS conservé, RCA dans les 48 h.

---

## 5. Procédure rollback — Développement

```bash
# 1. Vérifier l'état :
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U kinhale -d kinhale_dev \
  -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 5;"

# 2. Rollback :
DATABASE_URL=postgresql://kinhale:kinhale_dev_secret@localhost:5434/kinhale_dev \
  pnpm --filter @kinhale/api db:rollback

# 3. Re-migrer si besoin :
DATABASE_URL=… pnpm --filter @kinhale/api db:migrate
```

Pour repartir d'une base **vide** sans toucher au volume Docker :

```bash
docker compose -f infra/docker/docker-compose.yml exec postgres \
  psql -U kinhale -d kinhale_dev \
  -c "DROP SCHEMA drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
DATABASE_URL=… pnpm --filter @kinhale/api db:migrate
```

---

## 6. Cas particuliers et limites

### 6.1. Données perdues lors d'un `DROP COLUMN`

Un `down.sql` qui supprime une colonne **détruit** ses données. Le
backup RDS reste l'unique recours en prod. En dev, la consigne reste la
même : le rollback n'est **pas** une opération réversible côté données.

**Mitigation prévue dans la « up »** : pour les colonnes critiques,
préférer une migration en deux temps :
1. PR n : ajout de la colonne + double-write applicatif ;
2. PR n+1 (après stabilisation) : retrait de l'ancienne colonne.

Cela permet un rollback sans perte tant qu'on rollback uniquement la
PR n+1.

### 6.2. FK en CASCADE

`DROP TABLE … CASCADE` dans un `down.sql` peut supprimer en cascade des
lignes dans des tables enfants (ex : `push_tokens` quand on rollback
`devices`). C'est **voulu** pour les tables purement applicatives, mais
**à vérifier** sur chaque nouveau `down.sql` :

- `0000_*.down.sql` — DROP CASCADE sur les 5 tables initiales.
- `0004_*.down.sql` — pas de CASCADE direct, mais la FK
  `audit_events.account_id` repasse en `ON DELETE CASCADE` (au lieu de
  `SET NULL`). Si des lignes audit ont déjà des `account_id NULL` (cas
  post-purge effective), l'ALTER `SET NOT NULL` échoue et le rollback
  est bloqué — il faut alors purger ou restaurer ces lignes manuellement.

### 6.3. Migration de données vs migration de schéma

Drizzle ne génère que des migrations de **schéma**. Une migration qui
inclurait des `INSERT` / `UPDATE` (backfill) doit être documentée
inline dans la « up » et **toujours** être réversible — sinon la
migration sort du périmètre `db:rollback` et nécessite un script
`docs/runbooks/data-migrations/<NNNN>-rollback.sql` dédié.

À la date de KIN-092, **aucune migration data-only** n'existe ; la
règle est préventive.

### 6.4. Quand un `down.sql` ne suffit pas

Cas connus où l'opérateur doit **intervenir manuellement** :

| Cas                                                           | Action                                                         |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| Lignes orphelines (`account_id NULL` dans `audit_events`)     | Purge ciblée avant rollback : `DELETE WHERE account_id IS NULL` |
| Migration appliquée hors-bande (pas via Drizzle)              | Restaurer depuis snapshot RDS                                  |
| `down.sql` plante en milieu de transaction                    | La transaction roll back automatiquement ; analyser l'erreur, corriger le `down.sql`, redéployer |
| Plusieurs migrations à rollback en chaîne après partial failure | Exécuter `db:rollback` une fois par migration, dans l'ordre   |

---

## 7. Tests automatisés

`apps/api/src/db/__tests__/rollback.unit.test.ts` :

- Charge le journal réel et vérifie la présence de chaque `down.sql`.
- Vérifie le découpage et le hash.

`apps/api/src/db/__tests__/rollback.integration.test.ts` (gated par
`KINHALE_DB_TEST_URL`) :

- Round-trip up → down → up sur l'ensemble des migrations.
- Idempotence : applique chaque `down.sql` deux fois.
- Vérifie que le hash applicatif matche celui que Drizzle stocke.

Le job CI `db-rollback-test` (workflow `ci.yml`) provisionne un service
Postgres 16 et set `KINHALE_DB_TEST_URL=postgres://…@postgres:5432/…`.

---

## 8. Checklist PR migration

Pour chaque PR qui ajoute / modifie une migration :

- [ ] Le `up.sql` a été généré par `pnpm --filter @kinhale/api db:generate`.
- [ ] Le `down.sql` correspondant est écrit, idempotent, dans l'ordre inverse.
- [ ] La suite `rollback.unit.test.ts` passe localement.
- [ ] Le job CI `db-rollback-test` passe (round-trip vert).
- [ ] Si la migration **détruit ou transforme des données** existantes,
      la PR contient un paragraphe « impact rollback » dans la description
      et un lien vers ce runbook.
- [ ] Si la migration n'est pas réversible automatiquement, une section
      « Procédure manuelle » est ajoutée dans ce runbook (§6.4).
