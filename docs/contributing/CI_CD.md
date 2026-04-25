# CI/CD — guide de référence

> Pipeline GitHub Actions du monorepo Kinhale.
> Ticket de référence : **KIN-090 (E14-S04)**.
> Le déploiement réel staging/prod est suivi séparément par **KIN-091**
> (dépend de E14-S06, infra `ca-central-1`).

## Vue d'ensemble

| Workflow                            | Déclencheurs                       | Objectif                                                                                  |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`          | PR vers `main`/`develop`/`release/**`, push `develop`/`main` | format-check, lint, typecheck, test (+ coverage), build, smoke Alpine (musl) |
| `.github/workflows/e2e-web.yml`     | PR touchant le web, push `develop`/`main`         | Playwright (chromium + webkit) sur l'app Next.js                          |
| `.github/workflows/build-images.yml`| Push `develop`, tag `v*`, manuel                   | Build + push images Docker `kinhale-api` / `kinhale-web` vers ghcr.io + scan Trivy |
| `.github/workflows/security-scan.yml`| Daily 03:17 UTC, push `main`, manuel             | `pnpm audit` + Trivy filesystem + Trivy images publiées + Snyk (optionnel) |
| `.github/workflows/workflows-lint.yml`| PR touchant `.github/`                          | actionlint sur les workflows eux-mêmes                                    |

Le pipeline est **gating** :

- Les jobs `format-check`, `lint`, `typecheck`, `test`, `build` du workflow CI doivent être verts pour merger sur `develop`.
- Le job `playwright` doit être vert sur les PRs touchant le web.
- La règle de protection de branche correspondante est documentée dans `docs/contributing/GITFLOW.md` (à compléter côté repo settings — aujourd'hui géré par les mainteneurs).

## Composite action partagée

`.github/actions/setup` centralise :

- Installation de **pnpm 10.33.0**
- Installation de **Node 20** (via `.nvmrc`)
- Cache du store pnpm
- Cache Turborepo (`.turbo/`)
- `pnpm install --frozen-lockfile --prefer-offline`

Tout nouveau workflow qui dépend des dépendances doit l'utiliser :

```yaml
- name: Setup
  uses: ./.github/actions/setup
```

## Reproduire le CI en local

Avant tout `git push`, lancer la même séquence que la CI :

```bash
pnpm format:check
pnpm lint:root
pnpm lint
pnpm typecheck
pnpm test
pnpm build      # uniquement si tu touches `apps/api` ou `apps/web`
```

Pour les e2e web :

```bash
pnpm --filter @kinhale/web exec playwright install chromium webkit
pnpm e2e:web
```

Pour reproduire le smoke Alpine :

```bash
docker run --rm -v "$PWD:/ws:ro" node:20-alpine sh -c '
  cp -r /ws /tmp/work && cd /tmp/work
  corepack enable && corepack prepare pnpm@10.33.0 --activate
  pnpm install --frozen-lockfile --prefer-offline
  pnpm format:check && pnpm lint:root && pnpm typecheck && pnpm lint && pnpm test
'
```

## Builds Docker prod

Deux Dockerfiles `*.prod` multi-stage produisent des images runtime minimales :

- `apps/api/Dockerfile.prod` — image Fastify 5, runtime `tsx` + `tini`, utilisateur non-root `kinhale` (uid 1001), healthcheck HTTP `/health`.
- `apps/web/Dockerfile.prod` — exploite le mode `output: 'standalone'` de Next.js 15, copie `.next/standalone` + `.next/static` + `public/`, utilisateur non-root, healthcheck HTTP `/`.

Build local :

```bash
docker build -f apps/api/Dockerfile.prod -t kinhale-api:local .
docker build -f apps/web/Dockerfile.prod -t kinhale-web:local .
```

Smoke local :

```bash
docker run --rm -p 3002:3002 \
  -e DATABASE_URL=postgres://kinhale:dev@host.docker.internal:5432/kinhale \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e JWT_SECRET=devsecretdevsecretdevsecretdevse \
  -e SMTP_HOST=smtp.example.com -e MAIL_FROM=dev@example.com \
  -e WEB_URL=http://localhost:3000 -e STORAGE_BUCKET=kinhale-dev \
  -e STORAGE_ACCESS_KEY_ID=dev -e STORAGE_SECRET_ACCESS_KEY=dev \
  kinhale-api:local
```

## Tags d'image

Les tags sont calculés par `docker/metadata-action@v5` :

| Événement                | Tags poussés                                   |
| ------------------------ | ---------------------------------------------- |
| Push `develop`           | `develop`, `sha-<short>`                       |
| Tag `vX.Y.Z`             | `vX.Y.Z`, `sha-<short>`, `latest`              |
| `workflow_dispatch`      | `sha-<short>` uniquement                       |

Architectures : **linux/amd64 + linux/arm64** (Apple Silicon, Graviton).

## Coverage

Chaque package critique (`packages/crypto`, `packages/sync`, `packages/domain`, `apps/api`)
émet un `coverage/lcov.info`. Le job `test` agrège ces fichiers dans
`coverage-artifacts/<package>.lcov.info` et :

1. les publie comme artefact `coverage-<run-id>` (rétention 14 jours)
2. les pousse vers Codecov si `CODECOV_TOKEN` est configuré

> Le repo étant public, Codecov accepte des uploads sans token, mais on
> garde la branche conditionnelle pour ne pas casser les forks.

## Comment debug un échec CI

1. **Lire le job rouge en premier.** GitHub liste les jobs par ordre de
   déclenchement, l'erreur racine est souvent le premier job rouge.
2. **Re-run failed jobs only** : bouton _Re-run failed jobs_ après avoir
   inspecté les logs (utile pour les flaps réseau e2e).
3. **Reproduire localement** avec la séquence ci-dessus. Si ça passe en
   local mais échoue en CI :
   - Différence libc (glibc local vs musl Alpine) → vérifier le job `docker-alpine-verify`.
   - Différence d'horloge / locale → tests qui dépendent de `TZ` ou `LC_ALL`.
   - Cache Turborepo corrompu → cliquer _Re-run all jobs_ purge le cache (clé sha-spécifique).
4. **Pour les builds Docker** : `docker buildx build --progress=plain ...`
   en local reproduit la sortie exacte. Buildx en CI utilise le driver
   `docker-container` ; en local, ajoute `--builder default` si besoin.

## Comment ajouter un nouveau job

1. Créer le job dans `ci.yml` ou un workflow dédié (préférable s'il a un
   trigger spécifique).
2. **Toujours** déclarer `permissions:` au plus juste (lecture par défaut,
   écriture uniquement sur les jobs qui poussent quelque chose).
3. Réutiliser `.github/actions/setup` plutôt que dupliquer pnpm/Node/cache.
4. Ajouter un `timeout-minutes` réaliste (max ~ 2× la durée habituelle).
5. Si le job est gating, l'ajouter à la branch protection rule sur `develop`.

## Pinning des actions

Politique :

- Actions **GitHub officielles** (`actions/*`, `github/*`) : pinnées sur
  une majeure stable (`@v4`, `@v3`). GitHub maintient ces tags.
- Actions **Docker officielles** (`docker/*`) : idem, majeure stable.
- Actions **tierces sensibles** (Snyk, Codecov, Trivy) : pinnées sur une
  version SemVer mineure (`@v5`, `@0.28.0`) ou par SHA pour Snyk
  (`cdb760004ba9ea4d525f2e043745dfe85bb9077e`). À ré-évaluer chaque
  trimestre via Renovate ou Dependabot.

## Hors scope KIN-090 (suivi KIN-091)

- Déploiement automatique vers staging / prod (dépend de E14-S06)
- Migration DB automatique en CD (Drizzle migrate sur ECS task)
- Smoke tests post-déploiement
- Rollback automatique sur health-check fail
- Signature Cosign keyless des images (la permission `id-token: write` est
  déjà allouée pour préparer le terrain ; l'étape effective viendra avec
  KIN-091)
