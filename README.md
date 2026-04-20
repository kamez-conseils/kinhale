# Kinhale

> _A local-first, end-to-end encrypted asthma inhaler tracker for kids — built for caregivers, by caregivers._

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-pre--alpha-orange.svg)]()
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

Kinhale is **pre-alpha**. Active development begins Sprint 0 of the Kamez Conseils delivery plan.

## Getting started

Developer documentation will land in `/docs/` once Sprint 0 opens. For now:

- Architecture overview: `docs/architecture/` _(coming soon)_
- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Git workflow (Gitflow): `docs/contributing/GITFLOW.md`
- Security disclosure policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Licence

Kinhale is published under the **GNU Affero General Public License v3.0** — see [LICENSE](./LICENSE).

We chose AGPL v3 because we want Kinhale to stay a common good: any derivative — including a SaaS version — must keep the source open for its users.

## Credits

- Maintainer: Martial Kaljob
- Stewarded by: [Kamez Conseils](https://github.com/kamez-conseils)
- Every family contributing a bug report, a translation or a patch: **thank you**.

---

**_Your child's health data never leaves your devices. Not even we can read it._**
