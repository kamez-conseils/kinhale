# Security policy

> Kinhale is a journal for caregivers of an asthmatic child. It is **not a
> medical device** — but it carries health-adjacent data and a strong
> zero-knowledge promise. We take security reports seriously.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**

Instead, email **security@kinhale.health** with:

- A description of the issue
- Steps to reproduce, ideally a minimal proof of concept
- The version / commit SHA you tested against
- Your name or handle if you wish to be credited (optional)

If you require encryption, request our PGP fingerprint in a first contact email
without sensitive details and we will reply with the public key.

We acknowledge every report **within 5 business days**. For confirmed
vulnerabilities we aim to ship a fix within:

| Severity                                     | Target fix window |
| -------------------------------------------- | ----------------- |
| Critical (RCE, key extraction, data leak)    | 7 calendar days   |
| High (auth bypass, IDOR, privilege escalat.) | 30 calendar days  |
| Medium                                       | 60 calendar days  |
| Low / informational                          | Best effort       |

These windows apply to the **official Kamez Conseils relay**. Self-hosted
instances run by third parties are responsible for applying patches once
released.

## Coordinated disclosure

We follow a **coordinated disclosure** model:

1. You report privately by email.
2. We confirm reception within 5 business days, agree on severity, and propose
   a fix timeline.
3. We develop and validate a patch, with you in the loop if useful.
4. We release the patch (security advisory, GitHub Security Advisory when
   applicable).
5. Public disclosure happens **after** users have had a reasonable window to
   update — typically 7 to 14 days after release for a Critical / High issue.

We will not pursue legal action against researchers who:

- Report findings privately and in good faith.
- Avoid privacy violations (no probing of real user data).
- Avoid degradation of service for others (no DoS, no data destruction, no
  spam).
- Give us a reasonable window to address the issue before disclosure.

## Hall of Fame

Kinhale is a small, community-funded project. We do not run a paid bug bounty
program in v1.0. We recognise responsible disclosure with a public thank-you
in `SECURITY-THANKS.md` (added with the first valid report) and, where
appropriate, in release notes. If you'd rather stay anonymous, that's fine too.

## Scope

### In scope

The following code paths are in scope for security reports:

- The Kinhale **API relay**: `apps/api/`
- The mobile app: `apps/mobile/`
- The web app: `apps/web/`
- Cryptographic libraries: `packages/crypto/`
- Sync engine: `packages/sync/`
- Domain rules: `packages/domain/`
- Reports / PDF / CSV generation: `packages/reports/`
- CI/CD pipelines and release artifacts in `.github/`
- The official relay we operate at the production hostname (announced at v1.0
  release).

### Out of scope

- **Self-hosted instances run by third parties.** Bugs reproducible only on a
  third-party deployment must be reported to that operator first; we will help
  triage if the root cause is in upstream code, but operational issues
  (misconfigured TLS, weak SMTP credentials, failed backups…) are the
  operator's responsibility.
- **Social engineering** of Kamez Conseils staff or community contributors.
- **Physical access** attacks against staff devices.
- **Denial-of-service** that requires significant resources (e.g. volumetric
  DDoS), unless it stems from an algorithmic complexity bug.
- **Vulnerabilities in third-party dependencies** without a working
  proof-of-concept against Kinhale (please report those upstream).
- **Spam / abuse** of forms (we have rate limiting; please don't try to bypass
  it for fun).
- Findings that boil down to **missing security headers** without a concrete
  exploitation path.
- **Best-practice opinions** without a reproducible weakness (e.g. "you should
  use AES-GCM instead of XChaCha20-Poly1305"). The crypto choices have been
  reviewed; we welcome principled debate, but those are not vulnerabilities.

## What we promise (and what we don't)

We promise:

- **Zero-knowledge for health data.** The relay never sees plaintext puffs,
  symptoms, child names, or pump types. Any deviation is a P0 incident.
- **No health data in logs, metrics, push payloads, or emails.** Any leak is a
  reportable bug.
- A best-effort response within the windows above.

We do not promise:

- That the official relay is the right tool for clinical use. Kinhale is **not
  a medical device**.
- That self-hosted instances are equally hardened. Operators are responsible
  for their own threat model.
- Cash bounties.

## Sensitive areas

The following modules are flagged as **2-reviewer mandatory**:

- `packages/crypto/`
- `packages/sync/`
- Anything under `apps/api/src/` that touches authentication, group key
  distribution, mailbox routing, or push fan-out.

Pull requests touching these areas must pass both an automated `kz-securite`
review and a human security-trained reviewer (Martial Kaljob or a delegated
maintainer).

## Privacy and Loi 25 / GDPR

Kinhale is operated from `ca-central-1` (Quebec, Canada) by Kamez Conseils.
Privacy reports — distinct from technical vulnerabilities — should go to
**privacy@kinhale.health**. We will involve the Office of the Privacy
Commissioner of Canada (OPC) and the Commission d'accès à l'information du
Québec (CAI) where required by law.

## Contact

- Security reports: **security@kinhale.health**
- Privacy reports: **privacy@kinhale.health**
- Code of Conduct reports: **community@kinhale.health**

Thank you for helping keep families using Kinhale safe.
