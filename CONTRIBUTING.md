# Contributing to Kinhale / Contribuer à Kinhale

> **Français : [sauter à la version française](#français)**

Thank you for considering contributing to Kinhale! This project exists because parents and caregivers around the world need a simple, private, reliable tool to coordinate their child's asthma care. Every contribution — code, documentation, translation, bug report — matters.

---

## English

### Code of Conduct

This project adheres to the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold it. Report unacceptable behaviour to `conduct@kinhale.app`.

### How can I contribute?

- **Report bugs** via GitHub Issues — use the bug report template.
- **Propose features** via GitHub Issues — use the feature request template.
- **Submit code** via Pull Requests (see workflow below).
- **Translate** the app into your language — see `packages/i18n/` (available after Sprint 0).
- **Improve documentation** — even a typo fix helps.
- **Security vulnerabilities** — do **NOT** open a public issue. See [SECURITY.md](./SECURITY.md).

### Git workflow — Gitflow

Kinhale uses **Gitflow**. All details in [`docs/contributing/GITFLOW.md`](./docs/contributing/GITFLOW.md). Short version:

- **`main`** — production code. Protected. Tagged `vX.Y.Z` at each release.
- **`develop`** — integration branch. Protected. All feature work merges here first.
- **`feature/<issue-id>-<short-kebab-description>`** — new work. Branch from `develop`. PR into `develop`.
- **`release/vX.Y.Z`** — release stabilisation. Branch from `develop`. Merge into `main` AND `develop`.
- **`hotfix/<issue-id>-<short-kebab-description>`** — urgent production fix. Branch from `main`. Merge into `main` AND `develop`.

**Branch protection rules**:
- No direct commits to `main` or `develop`.
- Pull Requests require at least **1 approved review** and **all CI checks green**.
- PRs touching `packages/crypto` or security-sensitive code require **2 approved reviews** including one from a maintainer.
- Signed commits (GPG or SSH) required.

### Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>

<optional footer>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `security`.

Example:
```
feat(crypto): add BIP39 recovery seed generator

Generates a 12-word seed using libsodium entropy. Integrates with
the local vault initialisation flow.

Closes #42
```

### Pull Request checklist

Before opening a PR:

- [ ] Branch is up-to-date with `develop`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass locally.
- [ ] New user-facing strings are added to both `packages/i18n/locales/fr/*.json` **and** `packages/i18n/locales/en/*.json`.
- [ ] No health data appears in logs, emails, push payloads, or Sentry.
- [ ] PR description explains **what** and **why** (the **how** is in the diff).
- [ ] PR is ≤ 400 lines changed, or it includes a justification to review a larger change.
- [ ] Accessibility (WCAG 2.1 AA) considered for any UI change.
- [ ] Any new dependency is declared and licence-checked (compatible with AGPL v3).

### Development setup

Detailed setup instructions will live in `docs/contributing/DEVELOPMENT.md` once Sprint 0 opens. Prerequisites:

- Node.js 20 LTS
- pnpm 9+
- Xcode 15+ (macOS) for iOS builds
- Android Studio + Android SDK 34+ for Android builds
- Docker Desktop for local backend services

### Non-negotiable principles

Before submitting code, keep in mind:

1. **Local-first + E2EE zero-knowledge.** Health data never leaves user devices in clear text. Breaking this is always a P0 incident.
2. **Not a medical device.** No dose recommendations, no diagnosis, no "call your doctor" auto-alerts.
3. **No health data in logs, push payloads, emails.** Ever.
4. **i18n FR + EN from commit #1.** No hardcoded UI strings.
5. **Accessibility (WCAG 2.1 AA).** Colour-coded information must also carry a non-colour signal (icon, text).

### Licence agreement

By contributing, you agree that your contribution will be licensed under AGPL v3, the same licence as the project.

---

## Français

Merci d'envisager une contribution à Kinhale ! Ce projet existe parce que des parents et des aidants du monde entier ont besoin d'un outil simple, privé et fiable pour coordonner les soins d'asthme de leur enfant. Chaque contribution — code, documentation, traduction, rapport de bug — compte.

### Code de conduite

Ce projet adhère au [Contributor Covenant](./CODE_OF_CONDUCT.md). En participant, vous vous engagez à le respecter. Signalez tout comportement inacceptable à `conduct@kinhale.app`.

### Comment contribuer ?

- **Signaler un bug** via GitHub Issues — utilisez le gabarit de rapport de bug.
- **Proposer une fonctionnalité** via GitHub Issues — utilisez le gabarit de demande de fonctionnalité.
- **Soumettre du code** via Pull Requests (voir workflow ci-dessous).
- **Traduire** l'application — voir `packages/i18n/` (disponible après le Sprint 0).
- **Améliorer la documentation** — même une correction de coquille aide.
- **Vulnérabilités de sécurité** : **NE PAS** ouvrir d'issue publique. Voir [SECURITY.md](./SECURITY.md).

### Workflow Git — Gitflow

Kinhale utilise **Gitflow**. Détails complets dans [`docs/contributing/GITFLOW.md`](./docs/contributing/GITFLOW.md). Version courte :

- **`main`** — code de production. Protégée. Taguée `vX.Y.Z` à chaque release.
- **`develop`** — branche d'intégration. Protégée.
- **`feature/<issue-id>-<description-kebab>`** — nouvelles fonctionnalités. Partent de `develop`, reviennent dans `develop`.
- **`release/vX.Y.Z`** — stabilisation. Part de `develop`, revient dans `main` ET `develop`.
- **`hotfix/<issue-id>-<description-kebab>`** — urgence prod. Part de `main`, revient dans `main` ET `develop`.

**Règles de protection** :
- Aucun commit direct sur `main` ou `develop`.
- Les Pull Requests requièrent au moins **1 review approuvée** et **CI verte**.
- PRs touchant `packages/crypto` ou du code sensible : **2 reviews approuvées** dont une d'un mainteneur.
- Commits signés (GPG ou SSH) obligatoires.

### Messages de commit

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/fr/).

Types : `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `security`.

### Checklist Pull Request

Avant d'ouvrir une PR :

- [ ] La branche est à jour avec `develop`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` passent en local.
- [ ] Les nouvelles chaînes UI sont ajoutées dans `packages/i18n/locales/fr/*.json` **et** `packages/i18n/locales/en/*.json`.
- [ ] Aucune donnée santé n'apparaît dans les logs, e-mails, payloads push ou Sentry.
- [ ] Description de la PR explique le **quoi** et le **pourquoi** (le **comment** est dans le diff).
- [ ] PR ≤ 400 lignes modifiées, ou inclut une justification pour une review plus volumineuse.
- [ ] Accessibilité (WCAG 2.1 AA) prise en compte pour toute modification UI.
- [ ] Toute nouvelle dépendance est déclarée et sa licence est compatible AGPL v3.

### Principes non négociables

Avant de soumettre du code :

1. **Local-first + E2EE zero-knowledge.** Les données santé ne quittent jamais les appareils en clair. Toute régression = incident P0.
2. **Pas un dispositif médical.** Pas de recommandation de dose, pas de diagnostic, pas d'alerte « appelez votre médecin ».
3. **Pas de données santé dans les logs, payloads push, e-mails.** Jamais.
4. **i18n FR + EN dès le commit #1.** Pas de chaînes UI codées en dur.
5. **Accessibilité (WCAG 2.1 AA).** Toute information par couleur doit être doublée d'un signal non-coloré (icône, texte).

### Accord de licence

En contribuant, vous acceptez que votre contribution soit distribuée sous licence AGPL v3, la même licence que le projet.
