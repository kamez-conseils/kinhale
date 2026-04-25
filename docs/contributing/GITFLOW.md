# Gitflow — branching model for Kinhale

> Authoritative reference. The short version lives in
> [`CONTRIBUTING.md`](../../CONTRIBUTING.md); this document fills in the
> details, edge cases, and the rationale.

Kinhale uses a **Gitflow** branching model with linear history on `main`.
The model balances three goals:

1. **Stability of `main`** — only tagged releases reach production.
2. **Continuous integration on `develop`** — feature work stays in flight
   without waiting for a release window.
3. **Auditability** — every change to a sensitive package
   (`packages/crypto`, `packages/sync`, `apps/api/src/`) carries a clear
   review trail.

---

## 1. Branch types

### `main`

- Production. Always deployable.
- Tagged `vX.Y.Z` at every release.
- Direct commits forbidden by branch protection.
- Merge sources: `release/vX.Y.Z`, `hotfix/<id>-<slug>`.
- Linear history enforced (rebase or fast-forward only).
- Signed commits required.

### `develop`

- Integration branch.
- Direct commits forbidden by branch protection.
- Merge sources: `feature/<id>-<slug>`, `release/vX.Y.Z` (back-merge),
  `hotfix/<id>-<slug>` (back-merge).
- Squash-merge preferred for `feature/*`.
- CI green is mandatory before merge.

### `feature/<id>-<slug>`

- Branched from `develop`. Merged into `develop`.
- Naming: `feature/KIN-042-recovery-seed-bip39`.
- Lifetime: ideally < 5 days. Long-lived features should be split.
- Squash-merge into `develop`.

### `release/vX.Y.Z`

- Stabilisation branch.
- Branched from `develop` once feature freeze is declared.
- Allowed: bug fixes, version bumps, changelog entries, doc fixups.
- Merged into **`main` AND `develop`**, then tagged `vX.Y.Z` on `main`.
- Merge-commit (not squash) into `main` to preserve the stabilisation
  history.

### `hotfix/<id>-<slug>`

- Urgent production fix.
- Branched from `main`.
- Merged into **`main` AND `develop`**, tagged `vX.Y.(Z+1)` on `main`.
- Merge-commit into `main`. Optional squash into `develop`.

### `support/vX.Y.x`

- Long-term maintenance after v1.0 (security backports for older minors).
- Branched from a tag.
- Receives only `hotfix/*` cherry-picks.

---

## 2. Branch protection (configured at repository settings)

| Rule                                                        | `main`           | `develop`        |
| ----------------------------------------------------------- | ---------------- | ---------------- |
| Direct push                                                 | Blocked          | Blocked          |
| Pull request required                                       | Yes              | Yes              |
| Approving reviews required                                  | 1 (2 if crypto)  | 1 (2 if crypto)  |
| Stale approvals dismissed on new push                       | Yes              | Yes              |
| Status checks required (`CI`, `Docker · node:20-alpine`)    | Yes              | Yes              |
| Conversation resolution required                            | Yes              | Yes              |
| Linear history                                              | Enforced         | Optional         |
| Signed commits                                              | Required         | Required         |
| Force push                                                  | Blocked          | Blocked          |
| Admin bypass                                                | Disabled         | Disabled         |

---

## 3. Commit conventions

We use [Conventional Commits 1.0](https://www.conventionalcommits.org/).
The full rules live in [`CLAUDE.md`](../../CLAUDE.md). Highlights:

- Subject ≤ 72 chars, imperative present, no trailing punctuation.
- Type from: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`,
  `build`, `ci`, `security`, `revert`.
- Scope optional but recommended (`crypto`, `sync`, `api`, `mobile`,
  `web`, `ui`, `i18n`, `infra`, `ci`, `auth`, `push`, `offline`, …).
- Body **mandatory** for any non-trivial commit. Explain *why*.
- Footers for traceability: `Refs: KIN-042`, `Closes: #137`,
  `Co-Authored-By: …`.
- `BREAKING CHANGE:` footer plus `!` after the scope for breaking
  changes (`feat(api)!: …`).
- `security(<scope>)` for crypto / security changes; the body must
  reference the relevant ADR and the test vectors added.

---

## 4. Pull request workflow

1. **Branch** from up-to-date `develop`:
   ```bash
   git fetch origin
   git checkout develop && git pull --ff-only
   git checkout -b feature/KIN-042-recovery-seed-bip39
   ```
2. **TDD**: red test first, then minimal code, then refactor. Coverage
   thresholds (`packages/crypto`, `packages/sync`, `packages/domain`) are
   enforced in CI.
3. **Local checks** before push:
   ```bash
   pnpm format:check
   pnpm lint:root
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
4. **Automated review** (mandatory before opening a PR):
   - `kz-review` on the diff.
   - `kz-securite` if the change touches `packages/crypto`,
     `packages/sync`, authentication, I/O, secrets, health data, push or
     email payloads, or dependencies.
   - Save the report to `.agents/current-run/kz-review-KIN-XXX.md`
     and reference it in the PR description.
5. **Address blockers and majors** in the same branch before opening the
   PR. Minor follow-ups can land in a tracked ticket.
6. **Open the PR** against `develop` (or `main` for hotfixes) with:
   - A 1-2 sentence summary of *why*.
   - A test plan (manual or automated).
   - Links to ADRs / tickets.
   - The `kz-review` / `kz-securite` verdict.
7. **Human review** — at least 1 approval, 2 for sensitive zones. CI must
   be green.
8. **Squash-merge** into `develop` (the only mode allowed by the
   repository settings for feature branches).

---

## 5. Releases

1. Branch `release/vX.Y.Z` from `develop`.
2. Bump version in `package.json` and run `pnpm changeset version` if
   relevant; update `CHANGELOG.md`.
3. Run the full local pipeline (`pnpm lint && pnpm typecheck && pnpm test
   && pnpm e2e:web`) on the release branch.
4. PR `release/vX.Y.Z` → `main`. Merge-commit (not squash). Tag `vX.Y.Z`
   on `main` immediately after merge.
5. Back-merge `release/vX.Y.Z` → `develop`. Delete the release branch.

---

## 6. Hotfixes

1. Branch `hotfix/KIN-XXX-<slug>` from the latest tag on `main`.
2. Fix + add a regression test.
3. PR into `main`. Squash or merge-commit (your call, document in PR
   description). Tag `vX.Y.(Z+1)`.
4. Back-merge into `develop`. Delete the hotfix branch.

---

## 7. Signed commits

Branch protection requires signed commits. We accept either:

- **GPG**: see GitHub's
  [signing commits with GPG](https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits)
  guide.
- **SSH**: same as the SSH key used to push, configured via
  `git config --global gpg.format ssh`. See
  [signing commits with SSH](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification#ssh-commit-signature-verification).

If your environment can't sign at all (e.g. some sandboxed CI agents),
ask a maintainer to land the patch on your behalf.

---

## 8. Reverting

- For a feature on `develop` that hasn't shipped: open a `revert: …` PR.
- For a release that has shipped: prefer a `hotfix/*` rolling forward
  with the corrective change. Reverting a release tag is a last resort
  and must be documented in `CHANGELOG.md` plus an ADR.
