# Kinhale — Guide Claude Code

## Contexte projet

**Kinhale** est une application multi-plateforme (web + iOS + Android) **open source, gratuite, sous licence AGPL v3** qui permet à tous les aidants d'un enfant asthmatique — parents, grands-parents, garderie, nounou — de coordonner, tracer et partager en temps réel les prises de pompes de fond et de secours. Le produit est un **journal + rappels + partage**, **jamais un dispositif médical** : il ne recommande pas de dose, ne diagnostique pas, ne génère pas d'alerte de crise.

L'architecture est **local-first avec partage E2EE zero-knowledge** : les données de santé restent chiffrées sur les appareils des utilisateurs ; Kamez Conseils opère un **relais opaque** qui n'a jamais accès au contenu santé, même en cas de réquisition. Cette promesse — « même nous, les créateurs, ne pouvons pas lire les données de votre enfant » — est le pilier différenciateur du produit.

Le projet est personnel pour Martial, fondateur de Kamez : sa fille de 5 ans est asthmatique. Cette charge émotionnelle rend la fiabilité **non-négociable** — une notification manquée, un bug de crypto, une fuite de données sont des incidents de confiance irréparables. La v1.0 est financée à hauteur de ~260 k$ CAD sur 13 semaines.

## Principes non négociables

1. **Local-first + E2EE zero-knowledge.** Aucune donnée santé en clair ne doit jamais quitter les appareils des utilisateurs. Le relais Kamez ne voit que des blobs chiffrés opaques. Toute régression sur ce point est un incident P0.
2. **Pas de statut dispositif médical.** L'app est journal + rappel + partage. Jamais de recommandation de dose, jamais de diagnostic, jamais de message automatique du type « appelez votre médecin ». Toute proposition allant dans ce sens doit repasser par `kz-conformite`.
3. **Fiabilité critique des notifications.** Une notification manquée = perte de confiance. Redondance obligatoire : push + notification locale + e-mail fallback.
4. **Accessibilité WCAG 2.1 AA** dès la v1.0. Contrastes, tailles, VoiceOver/TalkBack, navigation clavier, touch targets ≥ 44×44 pt.
5. **i18n FR + EN dès le commit #1.** Aucune chaîne hardcodée en code applicatif — toute nouvelle chaîne passe par `packages/i18n/locales/{fr,en}/*.json`.

## Stack

- **Frontend** : React Native 0.74+ (Expo SDK 52, bare workflow, EAS Build) + React Native Web + **Next.js 15** pour le wrap web.
- **State** : Zustand (UI) + TanStack Query v5 (réseau). Source de vérité métier = document **Automerge 2** local.
- **Design system** : Tamagui + tokens partagés.
- **i18n** : i18next + react-i18next.
- **Backend** : **Node.js 20 LTS + Fastify 5** en TypeScript strict. Drizzle ORM sur PostgreSQL 16. Redis 7 pour pub/sub WS. WebSocket via `ws`.
- **Crypto** : libsodium (Ed25519, X25519, XChaCha20-Poly1305, Argon2id), MLS (via openmls, fallback Double Ratchet), recovery seed BIP39.
- **Stockage local chiffré** : op-sqlite + SQLCipher (mobile), Keychain iOS / Android Keystore (clés), IndexedDB chiffré applicatif (web).
- **Infra** : AWS `ca-central-1` via CDK (TypeScript). ECS Fargate, RDS Postgres, ElastiCache Redis, S3, CloudFront, WAF, Secrets Manager, KMS.
- **Observabilité** : CloudWatch + Sentry (scrubbing agressif) + OpenTelemetry.
- **Push / email** : APNs + FCM (payload opaque) + Postmark (magic link).

## Structure monorepo

```
kinhale/
├── apps/
│   ├── mobile/         # React Native (iOS + Android)
│   ├── web/            # Next.js 15 + React Native Web
│   └── api/            # Fastify (relais E2EE + auth)
├── packages/
│   ├── crypto/         # Wrappers libsodium, MLS, recovery seed
│   ├── sync/           # Moteur Automerge + mailbox + signatures
│   ├── domain/         # Entités métier, règles RM1-RM9
│   ├── ui/             # Design system (Tamagui)
│   ├── i18n/           # i18next + locales fr/en
│   ├── eslint-config/
│   ├── tsconfig/
│   └── test-utils/
├── infra/
│   ├── cdk/            # AWS CDK stacks
│   └── docker/         # docker-compose local
├── docs/
│   ├── product/
│   ├── architecture/   # ADRs
│   ├── contributing/   # Guide Gitflow
│   └── user/           # Self-hosting, FAQ
├── .github/workflows/
├── .agents/            # Runs kz-* (hors publication)
├── CLAUDE.md
├── README.md
├── LICENSE             # AGPL v3
├── pnpm-workspace.yaml
└── turbo.json
```

## Commandes essentielles

Package manager : **pnpm**. Tâches orchestrées par **Turborepo**.

- `pnpm install` — installation des dépendances du monorepo
- `pnpm dev` — lance l'API + le web en parallèle (docker-compose en arrière-plan)
- `pnpm dev:mobile` — lance l'app mobile (Expo dev client)
- `pnpm dev:api` — lance uniquement l'API
- `pnpm dev:web` — lance uniquement le web
- `pnpm test` — tests unitaires (Vitest backend / libs, Jest mobile + web)
- `pnpm test:watch` — tests en mode watch
- `pnpm e2e:web` — tests end-to-end web (Playwright)
- `pnpm e2e:mobile` — tests end-to-end mobile (Maestro, émulateurs iOS + Android)
- `pnpm lint` — ESLint sur tout le monorepo
- `pnpm typecheck` — vérification TypeScript stricte
- `pnpm build` — builds de production (api + web + mobile release)
- `pnpm infra:deploy:dev` — déploiement CDK vers l'environnement dev
- `pnpm changeset` — prépare un changelog pour release

## Conventions Git (Gitflow)

Résumé — détails complets dans `docs/contributing/GITFLOW.md`.

- **`main`** : production, protégée, tag semver à chaque release.
- **`develop`** : intégration continue, protégée.
- **`feature/<ticket-id>-<kebab-case>`** : basée sur `develop`, mergée dans `develop`.
- **`release/vX.Y.Z`** : stabilisation, basée sur `develop`, mergée dans `main` **et** `develop`.
- **`hotfix/<ticket-id>-<kebab-case>`** : urgence prod, basée sur `main`, mergée dans `main` **et** `develop`.
- **`support/vX.Y.x`** : maintenance long terme (post v1.0).

**Règles** :
- Aucun commit direct sur `main` ni `develop` (branch protection).
- Minimum 1 review approuvée + CI verte avant merge.
- Squash-merge sur `feature/*` → `develop` ; merge-commit sur `release/*` → `main`.
- Linear history forcée sur `main`.
- Signatures GPG/SSH obligatoires.
- PR > 400 lignes modifiées = justification ou découpage.

## Méthodologie

- Tests avant merge. Pas de merge sans CI verte.
- Review d'au moins 1 pair ; **2 reviews obligatoires** si la PR touche `packages/crypto`, `packages/sync`, ou tout code de sécurité.
- Aucune PR ne touche plus de ~400 lignes modifiées sauf exception justifiée.
- Pas de commit direct sur `main` ou `develop`.
- Un ADR (`docs/architecture/adr/`) pour toute décision architecturale structurante.

### Workflow de revue assistée (obligatoire avant toute PR)

Avant d'ouvrir une PR vers `develop`, le workflow suivant est obligatoire :

1. **Implémentation TDD** — tests rouges d'abord, puis code minimal, puis refactor.
2. **Passage `kz-review` systématique** — revue automatisée du diff : fit fonctionnel, qualité TypeScript strict, pureté, couverture et granularité des tests, conventions, gestion d'erreurs, risques de régression, anti-patterns. Le rapport est intégré au corps de la PR ou mentionné dans un commentaire.
3. **Passage `kz-securite` systématique** dès que la zone touchée est sensible : `packages/crypto`, `packages/sync`, authentification, I/O, secrets, données santé, payloads push/email, dépendances. En cas de doute, invoquer plutôt que d'omettre.
4. **Correction** des points MAJEURS relevés avant ouverture de PR. Les points MINEURS sont traités soit dans la même PR, soit dans un ticket de suivi explicite.
5. **Push + PR** vers `develop` : la revue humaine ne voit que du code déjà auto-filtré.
6. **Revue humaine + squash-merge** (seul mode autorisé par les settings repo).

Ce workflow n'est pas optionnel. Il a été adopté le 2026-04-20 après constat que les 3 premières PRs du domaine (KIN-005, KIN-007, KIN-008) s'étaient reposées uniquement sur la revue humaine GitHub.

## Format des messages de commit

Chaque commit comporte **obligatoirement** une ligne de description (sujet) **et** un corps (body). Conforme à [Conventional Commits 1.0](https://www.conventionalcommits.org/fr/v1.0.0/).

### Ligne de description (sujet)

Une seule ligne, **≤ 72 caractères**, à l'impératif présent, sans point final, structure :

```text
<type>(<scope>): <description>
```

- **`type`** (obligatoire) : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `security`, `revert`.
- **`scope`** (optionnel, recommandé) : module ou package touché — `crypto`, `sync`, `domain`, `api`, `mobile`, `web`, `ui`, `i18n`, `infra`, `ci`, `auth`, `push`, `offline`, …
- **`description`** : verbe à l'impératif + contexte minimal, en minuscules, sans ponctuation finale.

Exemples de sujets valides :

```text
fix(sync): corrige la perte d'événements lors d'une reconnexion WS
feat(auth): ajoute la connexion via passkey WebAuthn
docs(compliance): met à jour la matrice Loi 25 / RGPD
security(crypto): active l'Argon2id params OWASP 2024
```

### Corps (body)

Séparé du sujet par **une ligne vide**. Obligatoire pour tout commit non trivial (≥ quelques lignes modifiées ou toute modification métier / sécurité / infra).

Le corps explique **pourquoi** le changement est fait, pas quoi (le diff le montre) :

- Contexte et motivation du changement.
- Impacts (migrations DB, breaking changes, dépendances, feature flags, ADR liée).
- Références ticket / issue (`Refs: KIN-042`, `Closes: #137`).
- Signature `Co-Authored-By:` si pair-programming ou assistance IA.

### Exemple complet

```text
fix(sync): corrige la perte d'événements lors d'une reconnexion WS

Lorsque le client se reconnecte après une perte réseau, le serveur
renvoyait le cursor `lastSeq` avant de confirmer la souscription.
Résultat : les événements arrivés pendant la fenêtre de reconnexion
étaient perdus silencieusement.

La séquence est désormais : ack subscribe -> replay depuis lastSeq.
Test de reconnexion avec latence simulée ajouté.

Refs: KIN-042
Closes: #73
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Cas particuliers

- **Breaking change** : ajouter `!` après le type / scope (`feat(api)!: …`) **et** un footer `BREAKING CHANGE: <description>` dans le body.
- **Hotfix prod** : toujours `fix(<scope>): …` + référence incident + ticket dans le body.
- **Revert** : `revert: <sujet du commit reverté>` + dans le body la raison et le SHA reverté (`Reverts: <sha>`).
- **Changements crypto ou sécurité** : type `security(<scope>)` obligatoire ; body mentionne l'ADR, le test vector ajouté et l'auditeur informé.

## Règles de code

- **TypeScript strict** : `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- Pas de `any` implicite. `// @ts-ignore` interdit ; `// @ts-expect-error <raison + ticket>` toléré.
- Pas de `console.log` hors `packages/test-utils` — utiliser le logger pseudonymisé.
- **Aucune donnée santé dans les logs, nulle part.** Le logger pseudonymise automatiquement ; toute extension doit passer par la whitelist de champs.
- **Aucune donnée santé dans les payloads push ou e-mail.** Payload push = `{title: "Kinhale", body: "Nouvelle activité"}`.
- **Aucune chaîne UI hardcodée** : chaque nouvelle chaîne → entrée dans `packages/i18n/locales/fr/*.json` **et** `packages/i18n/locales/en/*.json`.
- Primitives crypto : uniquement via `packages/crypto`. Jamais d'import direct de `libsodium-wrappers` ailleurs.
- `Math.random` interdit pour tout usage sécurité (règle Semgrep active).

## Tests obligatoires avant merge

- `pnpm lint && pnpm typecheck && pnpm test` doivent tous passer.
- Couverture test sur modules critiques : **> 80 %** sur `packages/crypto`, `packages/sync`, `packages/domain`.
- Toute modification de protocole crypto ou de format de payload E2EE → test vector RFC ajouté + validation par le lead + auditeur crypto informé.
- Toute modification de parcours J1-J7 → e2e Maestro et/ou Playwright mis à jour.
- Tests axe-core en CI Playwright : bloquent sur critiques WCAG HAUTS.

## Liens utiles

- PRD : `.agents/current-run/00-kz-product.md` (copie dans `docs/product/PRD.md` après init)
- Specs : `.agents/current-run/00-kz-specs.md` (copie dans `docs/product/SPECS.md`)
- Architecture : `.agents/current-run/00-kz-architecture.md` (copie dans `docs/architecture/ARCHITECTURE.md`)
- Conformité : `.agents/current-run/00-kz-conformite.md` (copie dans `docs/product/COMPLIANCE.md`)
- Pivot architectural : `.agents/current-run/01-pivot-architectural.md`
- Estimation v2 : `.agents/current-run/00-kz-estimator-v2.md`
- ADRs : `docs/architecture/adr/`
- Gitflow détaillé : `docs/contributing/GITFLOW.md`
- Guide self-hosting : `docs/user/SELF_HOSTING.md`

## À ne jamais faire

- Commit de secrets (`.env`, clés privées, tokens, credentials AWS, clés APNs/FCM).
- Log d'un événement santé (prise, symptôme, prénom enfant, nom de pompe, dose).
- Ajout d'une dépendance non revue (Snyk + Dependabot doivent être verts, licence vérifiée compatible AGPL).
- Merge d'une PR qui touche la crypto sans review du lead **et** sans test dédié (vectors RFC ou scenario custom).
- Recommandation de dose, diagnostic, alerte de crise, ou message « appelez votre médecin » dans l'UI. Ligne rouge dispositif médical.
- Transmission d'une recovery seed au relais Kamez. La seed ne quitte jamais le device de l'utilisateur.
- Stockage de données santé dans la base PostgreSQL du relais.
- `Math.random`, `crypto-js`, comparaisons non-constantes sur données sensibles.
- Désactivation de la règle ESLint `i18next/no-literal-string` sur `apps/`.

## Contact

- **Mainteneur principal** : Martial Kaljob (martial@wonupshop.com)
- **Organisation** : Kamez Conseils
- **Licence** : AGPL v3
- **Sécurité** : signaler toute vulnérabilité à `security@kinhale.health` (voir `SECURITY.md`)
