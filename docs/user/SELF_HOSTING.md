# Self-hosting Kinhale

> **Status (v1.0 preview).** Self-hosting is supported on a best-effort basis.
> The official Kamez Conseils relay (announced at v1.0 release) remains the
> recommended option for most families. If you want to operate your own
> instance — for a clinic, a self-hosting collective, or simply because you
> prefer it — this guide walks you through it end-to-end.

---

## Why self-host?

Kinhale is **local-first and end-to-end encrypted**. Your child's health data
never leaves the caregivers' devices in plaintext. The relay only routes
opaque encrypted blobs.

Self-hosting gives you:

- **Full operational sovereignty.** You control the metadata (which device
  talked to which device, when) on top of the existing zero-knowledge
  guarantee on health content.
- **Compliance flexibility.** You decide the jurisdiction, retention, and
  backup policy.
- **Independence from Kamez.** If Kamez Conseils ever shuts down its hosted
  instance, your families keep working.

What you **do not gain** by self-hosting:

- Less crypto. The end-to-end encryption is the same on the official relay.
- Less work. You take on TLS, backups, monitoring, and patching.

---

## What you are taking on (read this before installing)

Self-hosting Kinhale means you become the **operator** of a service that
caregivers use to coordinate care for an asthmatic child. That comes with
responsibilities:

- Apply security updates promptly. Subscribe to GitHub security advisories.
- Maintain working **backups** (PostgreSQL + S3-compatible blob storage) and
  **test restores**. Without backups, a disk loss erases authentication state
  and the routing mailbox — devices will need to re-pair.
- Maintain valid **TLS certificates**. Without TLS, login magic links and
  WebSocket sync are insecure and the apps will refuse to connect.
- Comply with **local privacy law** (GDPR in EU, Loi 25 in Québec, COPPA in
  the US, etc.). The relay only sees pseudonymous identifiers and encrypted
  blobs, but you are still a data controller for the metadata you store.
- Be reachable. Provide a `security@` and `privacy@` email contact for the
  caregivers using your instance.

Kinhale is **not a medical device**. It does not recommend doses, does not
diagnose, and does not generate "call your doctor" alerts. Self-hosting does
not change that — your instance is still a journal + reminders + sharing tool.

If any of the above feels like too much, please use the official relay
instead.

---

## 1. Prerequisites

| Item            | Minimum                                                  | Recommended |
| --------------- | -------------------------------------------------------- | ----------- |
| OS              | Linux x86_64 with `cgroups v2` (Ubuntu 22.04+, Debian 12) | Ubuntu 24.04 LTS |
| Docker          | Docker Engine 24.0+ with Compose v2 plugin                | Latest stable |
| RAM             | 2 GB                                                     | 4 GB |
| Disk            | 20 GB SSD                                                | 50 GB SSD with daily snapshots |
| CPU             | 2 vCPU                                                   | 4 vCPU |
| Public hostname | A FQDN you control (e.g. `kinhale.example.org`)          | Wildcard cert friendly |
| Outbound ports  | 80, 443 (TLS), 587/465 (SMTP), 5228 (FCM optional)       | — |
| Inbound ports   | 80, 443                                                  | — |

You also need:

- A **domain name** with DNS pointing to the host (one A/AAAA record for the
  relay; optionally a second one for the web app).
- An **SMTP relay** (Postmark, Resend, AWS SES, your own mail server). Magic
  link login depends on it.
- *(Optional, recommended for prod)* an **S3-compatible bucket** for encrypted
  blob storage. The bundled MinIO works but you may want object-level backups.
- *(Optional)* APNs and FCM credentials if you want native push for iOS /
  Android. Without them, in-app reminders still work but won't fire when the
  app is fully closed.

---

## 2. Get the code

```bash
git clone https://github.com/kamez-conseils/kinhale.git
cd kinhale
git checkout v1.0.0    # pin to a release tag, not develop
```

> **Why pin?** `develop` is integration; only tagged releases are considered
> production-ready. Watch the `Releases` tab on GitHub.

---

## 3. Generate secrets

You will need three random values:

```bash
# JWT signing key (≥ 32 random bytes, base64)
openssl rand -base64 48

# PostgreSQL password
openssl rand -base64 32

# Redis password
openssl rand -base64 32
```

Save these in a password manager. **Do not commit them.** The provided
`.gitignore` blocks `.env` and `.env.*` exactly because of this.

---

## 4. Configure the environment

Copy the example file and fill in the values:

```bash
cp infra/docker/.env.prod.example infra/docker/.env.prod
$EDITOR infra/docker/.env.prod
```

Required variables:

| Variable                | Purpose                                                                 | Example |
| ----------------------- | ----------------------------------------------------------------------- | ------- |
| `KINHALE_HOSTNAME`      | Public FQDN that caregivers will use to reach the relay                 | `kinhale.example.org` |
| `KINHALE_WEB_URL`       | Public URL of the web app (used in magic links)                         | `https://app.kinhale.example.org` |
| `POSTGRES_PASSWORD`     | Strong random password (≥ 32 bytes)                                     | output of `openssl rand -base64 32` |
| `REDIS_PASSWORD`        | Strong random password (≥ 32 bytes)                                     | output of `openssl rand -base64 32` |
| `JWT_SECRET`            | ≥ 32 bytes random, base64-friendly                                      | output of `openssl rand -base64 48` |
| `JWT_ACCESS_TTL`        | Access token TTL                                                        | `15m` |
| `JWT_REFRESH_TTL`       | Refresh token TTL                                                       | `14d` |
| `SMTP_HOST`             | SMTP server hostname                                                    | `smtp.postmarkapp.com` |
| `SMTP_PORT`             | SMTP port (`587` STARTTLS or `465` TLS)                                 | `587` |
| `SMTP_USER`             | SMTP username                                                            | (provider token) |
| `SMTP_PASS`             | SMTP password / token                                                   | (provider token) |
| `SMTP_SECURE`           | `false` for STARTTLS (587), `true` for TLS (465)                        | `false` |
| `MAIL_FROM`             | "From" address for transactional mail                                   | `Kinhale <noreply@kinhale.example.org>` |
| `STORAGE_ENDPOINT`      | S3-compatible endpoint (or `http://minio:9000` for bundled MinIO)       | `https://s3.eu-west-1.amazonaws.com` |
| `STORAGE_BUCKET`        | Bucket name (must exist before first start)                             | `kinhale-relay-blobs` |
| `STORAGE_ACCESS_KEY_ID` | S3 access key                                                           | (provider value) |
| `STORAGE_SECRET_ACCESS_KEY` | S3 secret key                                                       | (provider value) |
| `STORAGE_REGION`        | S3 region                                                               | `eu-west-1` |

Optional (push notifications):

| Variable               | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `APNS_KEY_ID`          | Apple Push key id                                                        |
| `APNS_TEAM_ID`         | Apple Developer team id                                                  |
| `APNS_BUNDLE_ID`       | iOS bundle id                                                            |
| `APNS_PRIVATE_KEY`     | Path or PEM contents of the `.p8` Apple key                              |
| `FCM_SERVICE_ACCOUNT`  | Path or JSON contents of the Firebase service account                    |

> **Reminder.** Push payloads remain `{title: "Kinhale", body: "Nouvelle activité"}`
> regardless of platform. Health data never leaves the device in clear, even
> for push.

---

## 5. Configure TLS (Caddy is the simplest path)

We recommend [Caddy](https://caddyserver.com) because it negotiates Let's
Encrypt certificates automatically and reverse-proxies WebSocket without
configuration. A minimal `Caddyfile` for Kinhale looks like:

```Caddyfile
kinhale.example.org {
    encode zstd gzip
    reverse_proxy api:3002
}

app.kinhale.example.org {
    encode zstd gzip
    reverse_proxy web:3000
}
```

Place that file at `infra/docker/Caddyfile`. The provided
`docker-compose.prod.yml` uses it automatically.

If you prefer Traefik, nginx, or a managed load balancer, point it at:

- Port **3002** of the `api` service (HTTP/1.1 + WebSocket upgrade).
- Port **3000** of the `web` service.

---

## 6. Initialise blob storage

If you use the bundled MinIO, create the bucket on first run:

```bash
docker compose -f infra/docker/docker-compose.prod.yml up -d minio
docker exec -it kinhale_minio_prod \
    mc alias set local http://localhost:9000 "$STORAGE_ACCESS_KEY_ID" "$STORAGE_SECRET_ACCESS_KEY"
docker exec -it kinhale_minio_prod mc mb "local/$STORAGE_BUCKET"
```

If you use AWS S3 / Cloudflare R2 / Backblaze B2, create the bucket with your
provider's console and grant the access key `Read+Write+List` on it. The
bucket only stores **encrypted** blobs.

---

## 7. Start the stack

```bash
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod up -d
```

The first start does the following automatically:

1. Pulls `postgres:16-alpine`, `redis:7-alpine`, and Caddy images.
2. Builds the `api` and `web` images from the local source.
3. Brings up PostgreSQL with healthcheck.
4. Applies database schema synchronisation via the API entrypoint.
5. Starts the API on port 3002 and the web app on port 3000 behind Caddy.

> **v1.0 preview note.** The compose currently reuses the workspace
> `apps/api/Dockerfile` and `apps/web/Dockerfile` (also used in dev). Hardened
> multi-stage production Dockerfiles with smaller runtime images and Next.js
> standalone output land under E14-S04 (CI/CD pipeline). The current images
> are functional for self-hosting but larger than necessary.

Verify everything is healthy:

```bash
docker compose -f infra/docker/docker-compose.prod.yml ps
curl -fsSL https://$KINHALE_HOSTNAME/health
```

You should get `{"status":"ok"}` from the health endpoint within a minute of
the first start.

---

## 8. Create the first administrator account

For v1.0 preview, account creation goes through the standard magic-link flow:

1. Open `https://app.kinhale.example.org`.
2. Enter the email of your administrator (the first caregiver).
3. Click the magic link delivered by your SMTP provider.
4. Complete the household creation flow on the device.

> No bootstrap shell command is needed — the relay is intentionally agnostic
> about which user is "admin"; it never sees plaintext household data.

Operational admin (you, the operator) is a different role. Database access for
operational tasks goes through `psql` on the running container; see
**Operational tasks** below.

---

## 9. Backups

The relay holds two kinds of state worth backing up:

1. **PostgreSQL** — accounts, devices, mailbox routing pointers, encrypted
   blob references, push tokens. Loss = devices need to re-pair.
2. **S3-compatible bucket** — opaque encrypted blobs. Loss = devices may need
   to re-sync from their local copies.

**Recommended cadence**:

- PostgreSQL: daily logical backup (`pg_dump`) + weekly full file system
  snapshot. Encrypt at rest with your own key (KMS / age / rage).
- S3 bucket: enable versioning + lifecycle policy on the provider side.

Example daily Postgres dump (cron, every day at 03:00):

```bash
docker exec kinhale_postgres_prod \
    pg_dump -U kinhale -d kinhale \
    | gzip \
    | age -r age1examplerecipient... \
    > /var/backups/kinhale/$(date +%F).sql.gz.age
```

**Test restores quarterly.** A backup that has never been restored is not a
backup.

---

## 10. Restore

To restore from a `pg_dump` snapshot:

```bash
docker compose -f infra/docker/docker-compose.prod.yml stop api
gunzip -c /var/backups/kinhale/2026-04-24.sql.gz \
    | docker exec -i kinhale_postgres_prod psql -U kinhale -d kinhale
docker compose -f infra/docker/docker-compose.prod.yml start api
```

For S3 buckets, follow your provider's restore procedure.

---

## 11. Updates

```bash
# 1. Pull the new release
git fetch --tags
git checkout v1.0.1

# 2. Rebuild images and apply migrations
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod build
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod up -d

# 3. Verify
curl -fsSL https://$KINHALE_HOSTNAME/health
```

The API entrypoint runs migrations forward automatically. **Always read the
release notes** before upgrading across major versions — breaking changes are
called out explicitly.

---

## 12. Monitoring

For v1.0 preview, the minimum monitoring is:

- `docker compose ... ps` — exits non-zero if any container is unhealthy.
- `docker compose ... logs --tail 200 api web` — application logs (already
  pseudonymised; no health data leaks).
- Disk space monitoring on the volume that holds PostgreSQL and (if local)
  MinIO data.

If you operate at scale, point an external monitor (UptimeRobot, healthchecks.io)
at `https://$KINHALE_HOSTNAME/health` with a 1-minute interval.

Sentry / OpenTelemetry exporters can be enabled by setting `SENTRY_DSN` and
`OTEL_EXPORTER_OTLP_ENDPOINT` in `.env.prod`. The Kinhale logger pseudonymises
identifiers before they leave the process — you do not need to filter again at
your collector.

---

## 13. Operational tasks

Open a `psql` shell inside the running stack:

```bash
docker exec -it kinhale_postgres_prod psql -U kinhale -d kinhale
```

List active sessions:

```sql
SELECT account_id, last_seen_at, user_agent FROM sessions ORDER BY last_seen_at DESC LIMIT 50;
```

Revoke a session (in case of suspected device compromise reported by a
caregiver):

```sql
UPDATE sessions SET revoked_at = now() WHERE id = 'session-uuid';
```

Even with database access, you cannot decrypt health data. The relay only
holds encrypted blobs and pseudonymous routing metadata.

---

## 14. Disclaimer

By self-hosting Kinhale you accept that:

- **Health data zero-knowledge** is a property of the protocol, **not of the
  operator**. The encryption keeps Kamez out and keeps you, the operator, out
  too — but you remain responsible for keeping the system available, backed
  up, patched, and legally compliant.
- The Kinhale UI is a **journal + reminders + sharing tool**, not a medical
  device. Caregivers must continue to follow their physician's prescription.
- AGPL v3 applies to your deployment. If you make modifications and offer the
  service over a network, you must make the modified source available to the
  users of that service. See `LICENSE` and §13 of AGPL v3.

If any of this is unclear, email **community@kinhale.health** before going to
production.

---

## Appendix A — Production environment variables, complete list

The complete list lives in `infra/docker/.env.prod.example`. This guide names
the **required** variables; the example file documents every optional knob.

## Appendix B — Architecture references

- `docs/architecture/ARCHITECTURE.md` — high-level design.
- `docs/architecture/adr/ADR-D4-relay-hosting.md` — relay architecture choices.
- `docs/architecture/adr/ADR-D10-push-expo-v1-migration-native-v1-1.md` — push
  pipeline.
- `docs/architecture/adr/ADR-D11-peer-ping-zero-knowledge.md` — zero-knowledge
  peer presence.
- `docs/architecture/adr/ADR-D12-report-pdf-client-side.md` — PDF reports
  generated client-side (the relay never sees a report).
- `docs/architecture/adr/ADR-D13-report-sharing-v1.md` — report sharing v1.
- `docs/architecture/adr/ADR-D14-privacy-export-v1.md` — privacy /
  portability export.

## Appendix C — Getting help

- GitHub issues for non-security bugs.
- `security@kinhale.health` for vulnerabilities (see `SECURITY.md`).
- `community@kinhale.health` for community / Code of Conduct concerns.
