# Architecture technique — Kinhale v1.0

> **Document d'architecture technique**
> Version : 0.1.0 — Date : 2026-04-19
> Licence : AGPL v3
> Description courte : vision local-first + E2EE zero-knowledge, stack technique (React Native, Next.js, Fastify, PostgreSQL, libsodium, MLS, Automerge), infrastructure AWS ca-central-1, conventions et roadmap technique v1.0.

---

## 1. Vision technique globale

Kinhale est une application **local-first, zero-knowledge**. Les données de santé d'un enfant asthmatique (plans, prises, symptômes, rapports) **ne quittent jamais en clair** les appareils des aidants autorisés du foyer. Le backend opéré par Kamez n'est **pas un stockage santé** : c'est un **relais opaque** qui transporte des blobs chiffrés de bout en bout entre les devices d'un même foyer, plus un petit service de comptes et de routage.

```
                               ┌────────────────────────────────────────┐
                               │         Services tiers opaques         │
                               │  APNs / FCM (push titre générique)     │
                               │  Postmark/SES (magic link, rapport*)   │
                               │  S3 ca-central-1 (blobs chiffrés)      │
                               └──────────▲─────────────────────────────┘
                                          │ TLS 1.3
                                          │ Aucune donnée santé en clair
                                          │
┌─────────────────┐                ┌──────┴──────────────┐                ┌─────────────────┐
│  Device parent  │                │  Relais Kinhale     │                │  Device aidant  │
│  (iOS/Android)  │◄──WSS E2EE────►│  (AWS ca-central-1) │◄──WSS E2EE────►│  (garderie,     │
│                 │                │                     │                │   co-parent…)   │
│  - SQLite chiff │                │  - Fastify + WS     │                │                 │
│  - Keychain     │                │  - PostgreSQL       │                │  - SQLite chiff │
│  - CRDT doc     │                │    (métadonnées)    │                │  - Keychain/KS  │
│  - Clés X25519  │                │  - S3 blobs opaques │                │  - CRDT doc     │
│  - Recovery seed│                │  - Redis pub/sub    │                │  - Clés groupe  │
└────────┬────────┘                │  - Auth magic link  │                └────────┬────────┘
         │                         │  - Routage mailbox  │                         │
         │                         └─────────────────────┘                         │
         │                                                                         │
         └────────────────── Sync directe LAN (Bonjour/mDNS, v1.1+) ──────────────┘

*Les rapports quittent le device seulement si le parent choisit l'envoi e-mail ; dans ce cas
 l'e-mail transite chiffré via le fournisseur — payload santé attaché en PDF non-chiffré
 côté fournisseur. À privilégier : téléchargement local + remise en main propre.
```

**Invariants architecturaux** :

1. **Aucune donnée santé en clair côté relais** — ni en base, ni dans les logs, ni dans les payloads push, ni dans les metrics Sentry.
2. **Clé privée par device**, jamais transmise. Authentification des messages par signature Ed25519.
3. **Clés de groupe par foyer**, distribuées via un protocole d'échange authentifié (MLS ou Double Ratchet), **rotées** à chaque révocation d'aidant.
4. **Local-first** : chaque device porte une copie complète du document CRDT de son foyer. L'app est fonctionnelle hors-ligne (saisie, lecture 30+ jours, rapport PDF client-side).
5. **Relais sans état métier santé** : une restauration depuis backup DB du relais ne permet **pas** de reconstruire les données santé d'un foyer, seulement son routage.

---

## 2. Stack technique retenue

### 2.1. Frontend (web + iOS + Android)

**Recommandation : React Native 0.74+ via Expo SDK 52 (bare workflow avec EAS Build) + React Native Web + Next.js 15 pour le wrap SEO-landing.**

| Brique | Choix | Version cible Sprint 0 | Justification |
|---|---|---|---|
| Framework cross-platform | **React Native** (bare workflow, EAS Build) | RN 0.74+ / Expo SDK 52+ | Écosystème JS partagé avec le backend TS, librairies crypto (libsodium, noble) matures, portage web natif via React Native Web. Flutter écarté car écosystème crypto Dart moins mature et perte du partage TS/JS avec le backend. Bare workflow (pas Managed) pour intégrer `react-native-libsodium`, `op-sqlite` et modules natifs sensibles. |
| Wrap web | **Next.js 15 (App Router)** + React Native Web | 15.x | SEO pour la landing + PWA installable pour l'app. SSR utile pour `/privacy`, `/download`, contenus statiques. L'écran app lui-même reste une SPA React Native Web. |
| State | **Zustand** (état UI local) + **TanStack Query v5** (état réseau / sync) | 5.x / 4.x | Plus léger que Redux Toolkit, aligné avec le caractère événementiel du CRDT. RTK Query écarté car la "source de vérité" est le document CRDT local, pas un cache HTTP. Le CRDT lui-même (Automerge) est la vraie source d'état métier. |
| Navigation | **React Navigation 7** (native stack + tabs) | 7.x | Standard RN, prend en charge deep links (invitations QR). |
| Style / design system | **Tamagui** (tokens + variants compilés) | 1.x | Compile-time sur web et natif, aligné avec WCAG (contrast helpers), tokens de couleur mutualisés. Alternative StyleSheet conservée si Tamagui ralentit le build (fallback). |
| i18n | **i18next + react-i18next** | 23.x | Structure namespace JSON, pluralisation ICU, détection OS. |
| Accessibilité | APIs RN (`accessibilityRole`, `accessibilityLabel`), audits axe + Lighthouse sur web | — | Voir §7. |
| Crypto client | **libsodium-wrappers** (web) + **react-native-libsodium** (mobile) | 0.7+ / 1.x | Audité, mêmes primitives que côté backend. Alternative TweetNaCl écartée (moins de primitives, pas d'Argon2id natif). |
| Stockage local | **op-sqlite** (mobile, bindings SQLCipher) + **IndexedDB** chiffré applicatif (web) | — | op-sqlite plus rapide que expo-sqlite, support SQLCipher natif. |
| CRDT | **Automerge 2** | 2.2+ | Voir §2.4. |
| Tests | Jest (unit) + React Native Testing Library + **Maestro** (e2e mobile) + **Playwright** (e2e web) | — | Maestro plus stable qu'e Detox en 2026. |

**Fallback si Sprint 0 invalide Tamagui** : StyleSheet natif + tokens exposés via un petit wrapper `@kinhale/ui`. Coût : légère perte de productivité, acceptée.

### 2.2. Backend (relais zero-knowledge + comptes)

**Recommandation : TypeScript (Node.js 20 LTS) + Fastify 5, mono-service.**

| Brique | Choix | Version cible | Justification |
|---|---|---|---|
| Langage / runtime | **TypeScript 5.4+ / Node.js 20 LTS** | — | Cohérence avec le front, vitesse de dev, bibliothèque libsodium identique. Go écarté pour la v1 : gain de perf non justifié à 100-5000 foyers, perte de partage de code (types CRDT, contrats WS). À réévaluer post-v2 si le relais atteint 10 k connexions WS concurrentes. |
| Framework API | **Fastify 5** | 5.x | Plus performant qu'Express, plugins bien maintenus, schema JSON natif (validation entrée/sortie). NestJS écarté : la surface fonctionnelle du relais est trop mince pour justifier le coût structurel de NestJS. |
| Temps réel | **Fastify + ws** (WebSocket) + fallback long-poll | — | Socket.io écarté : on n'a pas besoin de rooms/namespaces complexes, on gère nos mailboxes directement. |
| Pub/sub inter-nœuds | **Redis 7** (AWS ElastiCache) | 7.x | Nécessaire dès qu'on a ≥ 2 nodes WS pour router un message vers la bonne instance. |
| Base de données métadonnées | **PostgreSQL 16** (AWS RDS multi-AZ) | 16 | **Aucune donnée santé.** Stocke : comptes, devices enregistrés avec clés publiques, mailboxes, métadonnées de messages (timestamp, taille, expiration), invitations, logs d'audit pseudonymisés, consentements. |
| ORM | **Drizzle ORM** (ou Kysely) | — | Drizzle : types TS natifs, migrations SQL lisibles, pas de magie. Prisma écarté car trop lourd pour le périmètre + génération de client incompatible avec monorepo strict. |
| Stockage blobs chiffrés | **S3 (ca-central-1)** avec SSE-KMS + lifecycle 90 j | — | Les blobs sont déjà chiffrés côté client ; SSE-KMS en défense en profondeur. Rétention 90 jours par défaut (le device télécharge et ack les messages ; après ack ils sont purgés). |
| Auth | **Magic link** (JWT courts 15 min + refresh 14 j) + **passkeys WebAuthn** optionnels | — | Pas de mot de passe réutilisable. MFA TOTP optionnelle pour Admin. |
| Push | **APNs (HTTP/2)** + **FCM v1 API** | — | Payload générique "Nouvelle activité dans votre foyer", jamais de contenu santé. |
| Email | **Postmark** (transactionnel, DPA signé) | — | Deux usages : magic link + alertes dose manquée en fallback. Jamais de contenu santé dans le corps. SES Canada envisagé si data residency Canada exigée — à trancher Sprint 0. |
| Observabilité | **CloudWatch Logs + Metrics** + **Sentry** (avec `beforeSend` scrubbing agressif) + **OpenTelemetry** (traces) | — | Sentry reçoit des erreurs JS sans payload métier. Whitelist explicite des champs loggés. |

**Fallback si AWS Native jugé trop lourd en Sprint 0** : **Supabase** (Postgres managé + Auth + Storage) pour le relais. Trade-off : moins de contrôle fin sur les DPA, dépendance plateforme. Réservé au plan B si le délai devient critique. **Recommandation finale : AWS natif** pour la crédibilité long terme et la maîtrise des DPA.

### 2.3. Cryptographie

**Primitives retenues (libsodium partout)** :

| Usage | Algorithme | Librairie |
|---|---|---|
| Signature d'événements, authentification device | **Ed25519** | libsodium `crypto_sign_*` |
| Échange de clés 1:1 | **X25519** | libsodium `crypto_kx_*` |
| Chiffrement symétrique authentifié (blobs) | **XChaCha20-Poly1305** | libsodium `crypto_secretbox_*` / `aead_xchacha20poly1305_ietf_*` |
| Dérivation depuis recovery seed | **Argon2id** (m=64 Mio, t=3, p=1) | libsodium `crypto_pwhash` |
| Génération d'identifiants opaques | `randombytes_buf` 256 bits | libsodium |

**Protocole de groupe (foyer)** :

**Recommandation : MLS (Messaging Layer Security, RFC 9420) via `openmls` (Rust, wrappé en bindings) OU `mls-ts` si la maturité se confirme en Sprint 0.**

MLS est la cible moderne : groupes dynamiques, rotation de clés post-compromission, forward secrecy, standard IETF. Pour Kinhale, un foyer = un groupe MLS, chaque device = un membre, la rotation lors d'une révocation d'aidant est native.

**Fallback si la maturité mobile de MLS est insuffisante à kickoff (bindings React Native non stables, audit externe défavorable)** : **Signal Protocol simplifié** — Double Ratchet 1-to-1 par paire de devices, avec re-keying manuel du groupe à chaque ajout/révocation. Coût UX : léger impact sur les latences d'invitation (< 2 s vs < 500 ms avec MLS).

> **Décision Sprint 0 obligatoire** : PoC MLS sur iOS + Android + Web avec 3 devices + 1 révocation, validé par un auditeur crypto externe avant verrouillage. Si PoC échoue : fallback Double Ratchet, documenté dans un ADR.

**Recovery seed (BIP39, 24 mots, 256 bits d'entropie)** :
- Générée au premier lancement, **affichée une seule fois**, confirmée mot-à-mot par l'utilisateur.
- Stockée **uniquement** sur le device (Keychain/Keystore) et en sauvegarde hors-ligne par l'utilisateur (papier, gestionnaire de mots de passe).
- Permet de : dériver la clé privée du device, déchiffrer le backup cloud opt-in, restaurer sur nouveau device.
- Jamais transmise au relais — **ligne rouge**.

**Stockage local chiffré** :
- **iOS** : Keychain Services (via `expo-secure-store`) pour les clés privées ; `op-sqlite` avec clé dérivée Argon2id pour la base SQLite.
- **Android** : Android Keystore (AES-GCM hardware-backed) pour les clés privées ; `op-sqlite` avec SQLCipher.
- **Web** : clés privées en IndexedDB chiffrée applicative (XChaCha20-Poly1305, clé dérivée de la passphrase utilisateur déverrouillée en mémoire pour la session). WebCrypto `CryptoKey` non-extractible utilisé pour les opérations runtime.

**Sauvegarde cloud opt-in** :
- Archive JSON complète chiffrée (XChaCha20-Poly1305, clé dérivée Argon2id depuis la recovery seed).
- Destinations : iCloud Key-Value / Google Drive App Folder / fichier local exportable.
- Le relais ne voit **jamais** cette archive.

### 2.4. Synchronisation local-first

**Recommandation : Automerge 2 (format binaire `save`/`load`/`getChanges`).**

| Critère | Automerge 2 | Yjs | Verdict |
|---|---|---|---|
| Maturité format binaire | Stable (2.x) | Stable | Égal |
| Complexité d'un schéma "santé" (listes imbriquées, events append-only avec méta) | Excellente (types riches, JSON-like) | Bonne (mais Y.Map/Y.Array plus bas niveau) | **Automerge** |
| Incremental sync | `getChanges(since)` efficace | `Y.encodeStateAsUpdate()` | Égal |
| Binding React Native | `@automerge/automerge` pur JS + WASM (fonctionne RN 0.74+) | `yjs` idem | Égal |
| Communauté crypto / privacy | Historique fort (Ink & Switch, local-first) | Forte (collaboratif temps réel) | **Automerge** (aligné avec la posture produit) |

**Modèle d'événement** :
- Un document Automerge par foyer. Contient : liste append-only d'événements signés (`DoseAdministered`, `SymptomReported`, `PumpReplaced`, `PlanUpdated`, `CaregiverInvited`, `CaregiverRevoked`).
- Chaque événement est **signé Ed25519** par le device émetteur avant insertion dans le doc CRDT.
- Les entités dérivées (pompes actives, plan en cours, historique) sont **des projections calculées** à la lecture, jamais stockées en tant qu'état concurrent.

**Sync via relais** :
- Chaque device publie dans sa "mailbox de foyer" les deltas Automerge (`getChanges(since)`), chiffrés avec la clé de groupe MLS.
- Le relais stocke ces blobs chiffrés dans S3, indexés par `mailbox_id` (= identifiant opaque du groupe MLS) + horodatage + hash.
- Les autres devices du foyer récupèrent les blobs via WebSocket, les déchiffrent, appliquent `Automerge.applyChanges`.
- Le relais **n'a jamais la clé de groupe** et ne peut donc pas lire les deltas.

**Résolution de conflits** :
- Automerge garantit déterminisme → même état final sur tous les devices.
- Les rares conflits métier sémantiques (ex : deux aidants enregistrent une même prise à 5 s d'écart) sont signalés comme `is_disputed` et remontent dans l'UI pour action humaine (**RM6** des specs).

### 2.5. Infrastructure

**Hébergement : AWS `ca-central-1` (Montréal).**

| Service | Rôle | Dimensionnement v1.0 |
|---|---|---|
| **AWS ECS Fargate** | Runtime API Fastify + WS | 2 tasks 0.5 vCPU / 1 Gio RAM, autoscaling sur CPU > 70 % |
| **Application Load Balancer** | TLS termination, routage `/api` et `/ws` | 1 ALB, listener 443 |
| **RDS PostgreSQL 16** | Métadonnées | db.t4g.small Multi-AZ, 20 Gio gp3, backups 14 j |
| **ElastiCache Redis 7** | Pub/sub WS + rate limiting | cache.t4g.micro, 1 node (v1 mono-AZ acceptable) |
| **S3** | Blobs chiffrés + assets web statiques | Buckets dédiés blobs (lifecycle 90 j) + web |
| **CloudFront** | CDN web statique + PWA | 1 distribution, certificat ACM |
| **Route 53** | DNS | Zone hébergée |
| **Secrets Manager** | Secrets backend (DB url, JWT secrets, APNs key, FCM key) | Rotation 90 j |
| **KMS** | Clés SSE-S3, SSE-RDS, chiffrement Secrets Manager | 3 CMK, rotation annuelle |
| **CloudWatch** | Logs + metrics + alarmes | 30 j retention logs app, 90 j logs audit |
| **AWS WAF** | Rate limiting + OWASP Top 10 rules | Attaché à l'ALB |

**Infra-as-code : AWS CDK (TypeScript)**, cohérence langage repo. Terraform écarté pour limiter le nombre de langages dans la CI.

**Environnements** :
- `local` : docker-compose (Postgres 16, Redis 7, MinIO pour S3, Mailpit pour email).
- `dev` : déploiement automatique sur push `develop`.
- `staging` : déploiement automatique sur merge `release/*`.
- `prod` : déploiement manuel sur merge `main`, après tag semver.

### 2.6. DevOps / CI/CD

**Monorepo : Turborepo.**

Nx écarté : surcouche plus lourde, moins de valeur sur un monorepo de taille moyenne. Turborepo est suffisant, excellent cache distant (Vercel Remote Cache ou Nx Cloud selon Sprint 0).

**Structure monorepo** :

```
kinhale/
├── apps/
│   ├── mobile/             # React Native (iOS + Android), Expo bare
│   ├── web/                # Next.js 15 (App Router) + React Native Web
│   └── api/                # Fastify backend (relais + auth)
├── packages/
│   ├── crypto/             # Wrappers libsodium multi-plateforme, primitives MLS
│   ├── sync/               # Moteur Automerge + protocole mailbox + signature events
│   ├── domain/             # Entités métier, règles RM1-RM28, types partagés
│   ├── ui/                 # Design system (Tamagui), tokens, composants RN/RNW
│   ├── i18n/               # i18next config + locales fr/en
│   ├── eslint-config/      # ESLint partagé
│   ├── tsconfig/           # tsconfig.base.json partagé
│   └── test-utils/         # Helpers de test (fixtures, crypto test vectors)
├── infra/
│   ├── cdk/                # AWS CDK stacks
│   └── docker/             # docker-compose local
├── docs/
│   ├── product/            # PRD, specs, compliance (publics)
│   ├── architecture/       # ADRs + ce document
│   ├── contributing/       # Guide contributeur, Gitflow
│   └── user/               # Documentation utilisateur (self-hosting, FAQ)
├── .github/
│   └── workflows/          # CI/CD
├── CLAUDE.md
├── README.md
├── LICENSE                 # AGPL v3
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json
```

**Package manager : pnpm** (workspaces rapides, store centralisé, strict hoisting).

**CI/CD : GitHub Actions**.

Pipelines :
- `ci.yml` : déclenché sur toute PR. Étapes : install → lint → typecheck → test unitaire → build.
- `e2e.yml` : déclenché sur PR ciblant `develop` et `main`. Playwright (web) + Maestro (mobile, via émulateur iOS/Android hébergé sur runner macOS).
- `release.yml` : déclenché sur tag `v*`. Build + publication TestFlight + Play Internal Testing + déploiement CDN web + déploiement API.
- `sca.yml` : Snyk + Dependabot + Renovate (quotidien).
- `sast.yml` : Semgrep (règles OWASP + custom crypto).
- `dast.yml` : OWASP ZAP baseline scan sur staging (hebdomadaire).

**Release management** :
- Semver strict (MAJOR.MINOR.PATCH).
- Tag à chaque merge `release/*` → `main`.
- Changelog conventionnel (`@changesets/cli`).
- Builds iOS/Android publiés TestFlight / Play Internal à chaque release candidate.

---

## 3. Conventions de code

### 3.1. TypeScript

- `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- Pas de `any` implicite. `// @ts-ignore` interdit sans commentaire `// @ts-expect-error <raison>` + ticket associé.
- Préférer les types discriminés aux unions `string | null` pour les états.

### 3.2. Linting / Formatting

- **ESLint** flat config (`eslint.config.mjs`), `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-native`, `eslint-plugin-security`, `eslint-plugin-sonarjs`.
- **Prettier** uniforme (config `@kinhale/prettier-config`).
- Règle custom : interdire `console.log` hors `packages/test-utils` (on utilise un logger pseudonymisé qui strippe les champs santé).

### 3.3. Commits et PR

- **Conventional commits** (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `security`).
- `commitlint` + `husky` bloquent les commits non conformes.
- Template PR obligatoire (`/.github/pull_request_template.md`) : description, risques, tests ajoutés, impact crypto, impact i18n, impact a11y, captures.

### 3.4. Tests

| Niveau | Outil | Cible couverture |
|---|---|---|
| Unit backend | **Vitest** | 80 % lignes, 90 % sur `packages/crypto`, `packages/sync`, `packages/domain` |
| Unit mobile / web | **Jest** + React Native Testing Library | 75 % lignes |
| E2E mobile | **Maestro** | Parcours J1-J7 des specs |
| E2E web | **Playwright** | Parcours J1-J7 des specs |
| Crypto (test vectors) | Vitest + RFC vectors | 100 % des primitives |
| Chaos / sync | Vitest custom (simule N devices, partitions réseau, réconciliations) | 3 scénarios documentés |

---

## 4. Méthodologie Git — Gitflow

### 4.1. Branches

| Branche | Rôle | Parent | Cible merge |
|---|---|---|---|
| `main` | Production. Protégée. Tag semver après chaque release. | — | — |
| `develop` | Intégration continue. Protégée. Toutes les features convergent ici. | — | — |
| `feature/<ticket-id>-<kebab-case>` | Nouvelle fonctionnalité (ex : `feature/KIN-142-invite-caregiver-qr`). | `develop` | `develop` |
| `release/vX.Y.Z` | Stabilisation d'une version : bugfixes, docs, aucun nouveau scope. | `develop` | `main` **et** `develop` |
| `hotfix/<ticket-id>-<kebab-case>` | Correctif urgent prod. | `main` | `main` **et** `develop` |
| `support/vX.Y.x` | Maintenance long terme d'une branche antérieure (post-v1.0 si besoin). | tag `main` | `support/*` |

### 4.2. Règles de protection

- **Aucun commit direct** sur `main` ni `develop` (branch protection GitHub).
- **Au moins 1 review** approuvée avant merge.
- **CI verte obligatoire** (lint + typecheck + test + build).
- **Linear history** forcée sur `main` (`require linear history`).
- **Signatures commits** GPG/SSH exigées (vérif activée).
- **Merge via squash** sur `feature/*` → `develop`, merge-commit sur `release/*` → `main` (préserve la traçabilité).
- **PRs couvrant > 400 lignes modifiées** : justification écrite ou découpage.

### 4.3. Workflow de release

1. Quand `develop` est stable et contient le scope cible, créer `release/vX.Y.Z`.
2. Bugfixes + bump version + changelog sur la branche release.
3. Merge `release/vX.Y.Z` → `main`, tag `vX.Y.Z`, déclenche `release.yml`.
4. Merge `release/vX.Y.Z` → `develop` pour récupérer les bugfixes.
5. Suppression de la branche release.

### 4.4. Workflow de hotfix

1. Créer `hotfix/<ticket>-<desc>` depuis `main`.
2. Fix + test + bump patch.
3. Merge → `main` + tag `vX.Y.Z+1`.
4. Merge → `develop`.

---

## 5. Sécurité & durcissement

Référence intégrale : `../product/COMPLIANCE.md`. Synthèse opérationnelle :

- **Chiffrement E2EE par défaut** sur toutes les données santé (aucune exception).
- **Payload push opaque** : `{title: "Kinhale", body: "Nouvelle activité"}`. Jamais de prénom enfant, jamais de symptôme, jamais de type de pompe.
- **Scrubbing Sentry agressif** via `beforeSend` : whitelist de clés autorisées, rejet de tout objet contenant un champ parmi `{firstName, symptoms, doseId, pumpName, notes}`.
- **SCA** : Snyk + Dependabot + Renovate (quotidien).
- **SAST** : Semgrep (OWASP ruleset + custom crypto : détection de `Math.random`, `crypto-js`, constantes de temps non-constant).
- **DAST** : OWASP ZAP baseline hebdomadaire sur staging.
- **Pen-test externe** avant lancement public.
- **Audit crypto externe** : cabinet indépendant, revue du design MLS/Double Ratchet + implémentation.
- **Détection root/jailbreak** : warning UX, pas de blocage (maintient l'accessibilité pour parents non techniques).
- **Rate limiting API** : 100 req/min par IP + 30 req/min par compte sur endpoints sensibles (invite, revoke, magic link request).
- **Protections** : CSRF (SameSite=Strict + double submit cookie côté web), XSS (Content-Security-Policy strict, no `unsafe-inline`), SSRF (allow-list outbound), clickjacking (`X-Frame-Options: DENY`).
- **Certificate pinning mobile** : ancre publique Let's Encrypt + backup pin, rotation trimestrielle.
- **Secrets** : AWS Secrets Manager, rotation 90 j, jamais dans le repo (hook gitleaks pré-commit + CI).

---

## 6. Internationalisation (i18n)

### 6.1. Langues v1.0

**FR (Canada, défaut)** et **EN** à la sortie. Structure prête pour **ES** et **DE** en v1.1+ (clés déjà namespacées).

### 6.2. Structure

```
packages/i18n/
├── src/
│   ├── index.ts              # export du client i18next configuré
│   ├── detector.ts           # détection OS + override paramètres utilisateur
│   └── formatters.ts         # dates, heures, nombres via Intl
└── locales/
    ├── fr/
    │   ├── common.json
    │   ├── onboarding.json
    │   ├── doses.json
    │   ├── reminders.json
    │   ├── reports.json
    │   ├── caregivers.json
    │   ├── errors.json
    │   └── legal.json
    └── en/
        └── (même structure)
```

### 6.3. Règles

- **Aucune chaîne hardcodée** en code applicatif (règle ESLint `i18next/no-literal-string` activée sur `apps/`).
- Clés en **kebab-case**, namespace explicite (`doses:record-dose-button`).
- **ICU MessageFormat** pour pluriels (`{count, plural, one {# prise} other {# prises}}`).
- **Détection** : OS → `i18next-browser-languagedetector` (web) / `expo-localization` (mobile). Override utilisateur persisté.
- **Formatage** : `Intl.DateTimeFormat`, `Intl.NumberFormat`, avec fallback `date-fns` locales pour formats relatifs (« il y a 3 h »).
- **Expansion EN → FR** : design prévoit +30 % de largeur (FR verbeux). Tests snapshot visuels sur les deux locales.
- **Gestion des clés manquantes** : fallback EN, log warn-level (sans remonter à Sentry en prod).

---

## 7. Accessibilité WCAG 2.1 AA

### 7.1. Exigences structurantes

| Critère WCAG | Mise en œuvre Kinhale |
|---|---|
| 1.4.3 Contrast (Minimum) | Tokens couleur Tamagui validés par Lighthouse + axe ; ratio ≥ 4.5:1 pour texte, 3:1 pour composants UI. |
| 1.4.4 Resize text | Support Dynamic Type iOS + `fontScale` Android + tailles em sur web. Aucune coupe au-delà de 200 %. |
| 1.4.11 Non-text contrast | Boutons et focus visibles avec ratio ≥ 3:1. |
| 2.1.1 Keyboard | Navigation clavier complète web (Tab, Shift+Tab, Enter, Escape). Focus trap dans les modales. |
| 2.4.3 Focus order | Ordre DOM aligné sur ordre visuel, testé. |
| 2.4.7 Focus visible | Anneau de focus custom 2 px contrasté. |
| 2.5.5 Target size | Tous les touch targets ≥ 44×44 pt. |
| 3.1.2 Language of parts | Attribut `lang` ajusté dynamiquement. |
| 4.1.2 Name, Role, Value | `accessibilityRole`, `accessibilityLabel`, `accessibilityState` systématiques sur composants interactifs. |

### 7.2. Code couleur doublé d'une sémantique non-visuelle

Chaque couleur porte **aussi un pictogramme + un texte alternatif** :
- Bleu/vert "fond" → icône shield + label "Traitement de fond".
- Rouge/orange "secours" → icône bolt + label "Secours".
- Jaune/ambre "alerte" → icône warning + label "Attention".
- Gris "historique passif" → icône clock + label "Dose manquée" ou "Passée".

### 7.3. Tests

- **axe-core** en CI sur Playwright (web, échec si critiques HAUTS).
- **Lighthouse** CI : score a11y ≥ 95.
- **Manuels** : VoiceOver (iOS) + TalkBack (Android) + NVDA (Windows) sur parcours J1, J2, J3, J5 à chaque release candidate.

---

## 8. Décisions à trancher en Sprint 0 (ADRs)

| # | Décision | Option recommandée | Alternative (fallback) | Critère de choix |
|---|---|---|---|---|
| D1 | React Native workflow | **Bare + EAS Build** | Managed | Les modules crypto natifs (`react-native-libsodium`, `op-sqlite`) imposent bare. Confirmer compatibilité Expo SDK 52. |
| D2 | Moteur CRDT | **Automerge 2** | Yjs | Bench local de sync 10 devices × 1000 events : latence médiane < 100 ms. |
| D3 | Protocole de groupe | **MLS (openmls)** | Double Ratchet par paires | PoC 3 devices + 1 révocation sur iOS + Android + Web. Validation crypto externe préliminaire. |
| D4 | Hébergement relais | **AWS natif (CDK)** | Supabase | Confirmer DPA AWS signé + région ca-central-1 active. |
| D5 | Monorepo tooling | **Turborepo** | Nx | Bench cache remote sur le repo initial. |
| D6 | Wrap web | **Next.js 15 + RN Web** | Vite SPA pure | SEO landing + PWA installable : Next.js gagne. Vérifier que RN Web + Next.js App Router compile sans friction. |
| D7 | Design system | **Tamagui** | StyleSheet + tokens custom | Bench de build iOS/Android < 5 min. Si Tamagui ralentit, fallback. |
| D8 | Email transactionnel | **Postmark** | SES ca-central-1 | Trancher sur la clause de data residency Canada. |

**Livrable Sprint 0** : **8 ADRs signés** (Architecture Decision Records) couvrant D1-D8, dans `docs/architecture/adr/`.

---

## 9. Points à confirmer avec la revue sécurité avant Sprint 1

1. **Protocole de groupe** : validation du choix MLS vs Double Ratchet, y compris posture en cas d'ajout simultané de deux aidants.
2. **Schéma de recovery seed** : 12 vs 24 mots, politique de dérivation Argon2id (paramètres m/t/p cibles acceptables).
3. **Modèle de menace** : validation de la surface attaquante (device compromis, relais compromis, employé opérateur malveillant, autorité judiciaire).
4. **Stratégie de certificate pinning** : ancre + backup, procédure de rotation d'urgence.
5. **Politique de logs** : whitelist explicite des champs loggés côté backend, procédure de scrubbing Sentry, audit des 10 premiers loggers du repo à la revue.
6. **Détection root/jailbreak** : warning-only vs blocage paramétrable.
7. **Procédure d'audit crypto externe** : scope (design + implémentation), choix du cabinet.

---

## 10. Roadmap technique v1.0 (13 semaines)

Focus technique. Le découpage sprint par sprint donne une vision claire de la progression.

| Sprint | Semaines | Livrables techniques clés |
|---|---|---|
| **Sprint 0** | S0 (1 sem) | ADRs D1-D8 signés ; POC MLS + Automerge 3 devices ; CI/CD minimale verte ; docker-compose local ; skeleton monorepo Turborepo ; design tokens Tamagui ; kickoff juriste + auditeur crypto. |
| **Sprint 1** | S1-S2 | Backend auth magic link + devices + mailboxes ; génération clé X25519/Ed25519 device ; recovery seed BIP39 (génération, confirmation, restauration sur 2e device) ; stockage local chiffré Keychain/Keystore/IndexedDB ; onboarding J1 < 2 min. |
| **Sprint 2** | S3-S4 | Modèle domaine Enfant/Pompe/Plan ; invitation aidant QR+PIN + échange MLS ; révocation avec rotation de clé de groupe ; design system composants de base ; i18n FR/EN wired. |
| **Sprint 3** | S5-S6 | Saisie prise fond/secours (J2, J3) ; stockage Automerge local chiffré ; idempotence offline ; file de sortie chiffrée ; rattrapage 24 h ; voiding. |
| **Sprint 4** | S7-S8 | Sync E2EE via relais (WS + S3 blobs) ; APNs + FCM avec payload opaque ; rappels planifiés (push + local + e-mail fallback) ; détection dose manquée (J4). |
| **Sprint 5** | S9-S10 | Notifications croisées multi-aidants ; mode offline complet 30 j ; résolution CRDT conflits (J7) ; 2 rôles aidants finalisés ; tests chaos (partitions réseau, multi-device). |
| **Sprint 6** | S11-S12 | Rapport PDF client-side (1-2 pages) + CSV ; conformité (consentement, droits, export, suppression) ; audit crypto externe + retest ; pen-test externe + retest ; validation pneumo-pédiatre ; publication dépôt public AGPL v3 ; guide self-hosting ; dépôt TestFlight + Play Internal + soumission App Store / Play Store. |
| **Semaine 13** | S13 | Slack : Apple Review + Go-live + annonce open source. |

---

*Fin de l'architecture technique Kinhale v1.0 — document publié sous AGPL v3.*
