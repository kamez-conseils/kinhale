# Développement local — Kinhale

Ce document décrit la procédure pour lancer Kinhale en local sur un poste de dev.

## Pré-requis

- Node 20 LTS
- pnpm 10+
- Docker Desktop (Postgres + Redis + Mailpit + Minio)

## Première installation

```bash
git clone git@github.com:kamez-conseils/kinhale.git
cd kinhale
pnpm install
```

## Démarrage 100% Docker (nouveau)

Pour lancer toute l'app (API + web + infra) sans installer Node en local :

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

Attendre ~1-2 min que les images se construisent et que les services soient prêts, puis ouvrir :

- **Web** : http://localhost:3000
- **API** : http://localhost:3002/health
- **Mailpit** (voir les magic links) : http://localhost:8027

Pour suivre les logs :
```bash
docker compose -f infra/docker/docker-compose.yml logs -f web api
```

Pour arrêter :
```bash
docker compose -f infra/docker/docker-compose.yml down
```

Pour tout reset (y compris volumes DB) :
```bash
docker compose -f infra/docker/docker-compose.yml down -v
```

---

## Démarrage classique (Node en local)

### 1. Lancer l'infrastructure (Postgres, Redis, Mailpit)

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Services exposés :
- Postgres : `localhost:5434` (user `kinhale`, password `kinhale_dev_secret`, db `kinhale_dev`)
- Redis : `localhost:6379` (password `kinhale_redis_dev`)
- Mailpit SMTP : `localhost:1027` ; UI : http://localhost:8027
- Minio : `localhost:9000` ; console : http://localhost:9001

### 2. Créer le fichier `.env` de l'API

```bash
cp apps/api/.env.example apps/api/.env
# Éditer apps/api/.env si besoin (par défaut les valeurs marchent avec docker-compose)
```

### 3. Synchroniser le schéma de la DB

```bash
pnpm --filter @kinhale/api db:push
```

Cette commande crée toutes les tables définies dans `apps/api/src/db/schema.ts`. À refaire après chaque modification du schéma en dev.

En production, on utilise plutôt `pnpm --filter @kinhale/api db:migrate` qui applique les fichiers de migration versionnés.

> **Note sur les migrations (post-v1.0)** : le répertoire `apps/api/src/db/migrations/` contient les fichiers SQL versionnés. Pour générer une nouvelle migration après avoir modifié `schema.ts`, lancer `pnpm --filter @kinhale/api db:generate`. Committer le fichier généré et le pousser avec le code. En déploiement, `db:migrate` (via `drizzle-kit migrate`) applique les fichiers SQL dans l'ordre. Ne jamais utiliser `db:push` en production — cette commande applique les changements sans trace versionnée.

### 4. Lancer l'API + le web

Dans deux terminaux séparés :

```bash
# Terminal 1 — API sur port 3002
pnpm --filter @kinhale/api dev

# Terminal 2 — Web sur port 3000
NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm --filter @kinhale/web dev
```

Ou pour tout lancer en parallèle :

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm dev
```

### 5. Lancer l'app mobile (optionnel)

```bash
pnpm dev:mobile
```

## Parcours de test manuel

1. Ouvrir http://localhost:3000/auth
2. Saisir un email quelconque (`test@example.com`)
3. Ouvrir http://localhost:8027 (Mailpit) pour récupérer le magic link
4. Cliquer le lien pour s'authentifier
5. Parcours onboarding : `/onboarding/child` → `/onboarding/pump` → `/onboarding/plan`
6. Journal : `/journal/add` pour ajouter une prise
7. Invitation aidant : `/caregivers/invite` → génère un QR + PIN

## Commandes utiles

- `pnpm test` — tests unitaires
- `pnpm e2e:web` — tests e2e Playwright
- `pnpm lint && pnpm typecheck && pnpm format:check` — checks qualité
- `pnpm lint:root` — ESLint avec les règles strictes racine (à lancer avant push)
- `docker compose -f infra/docker/docker-compose.yml logs -f` — logs infrastructure
- `docker compose -f infra/docker/docker-compose.yml down -v` — reset complet de la DB locale

## Ports utilisés

| Service | Port | Description |
|---|---|---|
| Web (Next.js) | 3000 | http://localhost:3000 |
| API (Fastify) | 3002 | http://localhost:3002 |
| Postgres | 5434 | DB dev |
| Redis | 6379 | Pub/sub + mailbox TTL |
| Mailpit SMTP | 1027 | Capture e-mails dev |
| Mailpit UI | 8027 | http://localhost:8027 |
| Minio | 9000 | Stockage S3-compatible |
| Minio console | 9001 | http://localhost:9001 |

## Dépannage

### Web renvoie 500 sur toutes les pages
Vérifier `next.config.ts` — les packages `@kinhale/*` doivent être dans `transpilePackages` et `resolve.extensionAlias` doit mapper `.js` vers `.ts`.

### API renvoie 500 "relation X does not exist"
La DB n'a pas été synchronisée. Lancer `pnpm --filter @kinhale/api db:push`.

### Erreur `EADDRINUSE` sur port 3001 ou 3002
Docker Desktop réserve parfois ces ports. Tuer le process ou changer le port via `PORT=3003 pnpm --filter @kinhale/api dev` et ajuster `NEXT_PUBLIC_API_URL` côté web.

### Tests Playwright échouent avec "timeout waiting for http://localhost:3000"
Augmenter `webServer.timeout` dans `apps/web/playwright.config.ts` — la première compilation Next.js peut prendre 2 min.
