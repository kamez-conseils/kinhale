# Kinhale

> _A local-first, end-to-end encrypted asthma inhaler tracker for kids — built for caregivers, by caregivers._

[![CI](https://github.com/kamez-conseils/kinhale/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/kamez-conseils/kinhale/actions/workflows/ci.yml)
[![E2E Web](https://github.com/kamez-conseils/kinhale/actions/workflows/e2e-web.yml/badge.svg?branch=develop)](https://github.com/kamez-conseils/kinhale/actions/workflows/e2e-web.yml)
[![Security scan](https://github.com/kamez-conseils/kinhale/actions/workflows/security-scan.yml/badge.svg)](https://github.com/kamez-conseils/kinhale/actions/workflows/security-scan.yml)
[![Coverage](https://codecov.io/gh/kamez-conseils/kinhale/branch/develop/graph/badge.svg)](https://codecov.io/gh/kamez-conseils/kinhale)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/github/v/tag/kamez-conseils/kinhale?label=version&sort=semver)](https://github.com/kamez-conseils/kinhale/releases)
[![Status](https://img.shields.io/badge/status-v1.0--preview-orange.svg)]()
[![FR](https://img.shields.io/badge/lang-français-blue.svg)](./README.fr.md)

> **Français : [lire ce README en français →](./README.fr.md)**

---

## Why Kinhale?

When a child is diagnosed with asthma, parents, grandparents, daycare staff and babysitters all take turns giving inhaler puffs throughout the day. In practice, that means:

- Missed doses because no one remembers who did what
- No visibility for the other caregivers when a rescue puff is administered
- No reliable history to show the pediatric pulmonologist at the next appointment
- Surprise empty inhalers with no way to anticipate them

Kinhale exists to fix this — **without ever storing your child's health data on someone else's servers**.

## What makes Kinhale different

**Your child's health data never leaves your devices.**
Every dose, every symptom, every note is encrypted on your device and only synchronised end-to-end between the caregivers you explicitly invite. The Kinhale relay we operate is a _zero-knowledge_ pipe: we can see that a message was routed, but we cannot read its content — not even if legally compelled to.

## Core features (v1.0)

- Log maintenance and rescue puffs in a single tap, online or offline
- Record symptoms and context alongside rescue puffs
- Reliable reminders + missed-dose alerts
- Real-time sync between invited caregivers — with two granular roles:
  - _Log-only_: can record puffs, cannot see medical history
  - _Log + history_: can record puffs and view the full medical timeline
- Inhaler refill tracking with low-stock alerts
- PDF + CSV reports, printable for your doctor
- Full offline mode — the app works with zero internet connection
- Web + iOS + Android

## Planned for v1.1 (≈ 2 months after v1.0)

- Multi-child (siblings) support
- COPPA compliance for US users
- Community feedback pack

## Planned for v2.0

- Apple Health / Google Health Connect integration
- Read-only portal for pediatric pulmonologists
- Optional B2B offering for clinics (funds long-term hosting)

## Not a medical device

Kinhale is a **logging, reminder and sharing tool**. It never recommends doses, never diagnoses, never alerts that you should call your doctor. If something feels wrong with your child, call a medical professional.

## Project status

Kinhale is **v1.0 preview**. The codebase is under active development; an
official production instance hosted by Kamez Conseils in `ca-central-1` is
planned with the v1.0 release. Self-hosting is supported on a best-effort
basis — see the guide below.

## Quickstart — development

```bash
git clone https://github.com/kamez-conseils/kinhale.git
cd kinhale
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
pnpm dev
```

The dev compose ships PostgreSQL, Redis, Mailpit (SMTP) and MinIO (S3) on
local ports — see [`infra/docker/README.md`](./infra/docker/README.md).

## Quickstart — self-hosting

If you want to run your own relay (clinic, self-hosting collective, family
deployment) the full guide is in [`docs/user/SELF_HOSTING.md`](./docs/user/SELF_HOSTING.md).
Short version:

```bash
git clone https://github.com/kamez-conseils/kinhale.git
cd kinhale
git checkout v1.0.0
cp infra/docker/.env.prod.example infra/docker/.env.prod
# edit infra/docker/.env.prod with your secrets and hostnames
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod up -d
```

## Documentation

- Architecture overview: [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)
- Architecture decisions: [`docs/architecture/adr/`](./docs/architecture/adr/)
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Git workflow (Gitflow): [`docs/contributing/GITFLOW.md`](./docs/contributing/GITFLOW.md)
- Security disclosure policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Self-hosting guide: [`docs/user/SELF_HOSTING.md`](./docs/user/SELF_HOSTING.md)

## Licence

Kinhale is published under the **GNU Affero General Public License v3.0** — see [LICENSE](./LICENSE).

We chose AGPL v3 because we want Kinhale to stay a common good: any derivative — including a SaaS version — must keep the source open for its users.

## Credits

- Maintainer: Martial Kaljob
- Stewarded by: [Kamez Conseils](https://github.com/kamez-conseils)
- Every family contributing a bug report, a translation or a patch: **thank you**.

---

**_Your child's health data never leaves your devices. Not even we can read it._**
