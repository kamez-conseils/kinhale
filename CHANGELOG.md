# Changelog

Tous les changements notables apportés à ce projet sont documentés ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), et ce
projet adhère au [versionnage sémantique](https://semver.org/spec/v2.0.0.html).

## [0.1.0-preview.1] — 2026-04-22

Première release pré-v1.0 marquant la clôture des Sprints 0 à 2 du plan de
livraison 13 semaines. Aperçu non destiné à la production : flux E2EE, hors-ligne
et rapports médecin encore partiels.

### Fondations (Sprint 0)

- Monorepo pnpm + Turborepo + TypeScript strict.
- Squelettes `apps/api` (Fastify 5), `apps/web` (Next.js 15 + React Native Web),
  `apps/mobile` (Expo SDK 52 + bare workflow).
- Design system Tamagui partagé, i18next FR + EN dès le commit initial.
- Domaine métier `packages/domain` : 28 règles RM1-RM28 implémentées et testées
  (admin permanent, consentement, journal, invitations, multi-tenant,
  géolocalisation opt-in, …).

### Cryptographie & synchronisation (Sprint 1)

- Wrappers libsodium (`packages/crypto`) : Ed25519, X25519, XChaCha20-Poly1305,
  Argon2id, BIP39 recovery seed, dérivation de clés device.
- Moteur Automerge 2 + mailbox E2EE (`packages/sync`) : événements signés,
  projections typées, curseur de synchronisation, pipeline chiffré.
- Relais WS sécurisé (`apps/api`) : JWT, pub/sub Redis, register-device,
  catchup, payload opaque.

### Parcours utilisateur (Sprint 2)

- Authentification magic link (web + mobile) + établissement session chiffrée.
- Journal de prises E2EE : saisie fond / secours, symptômes, circonstances,
  règle RM4 (documentation obligatoire des prises de secours).
- Notifications push APNs/FCM avec payload opaque (RM16) + enregistrement
  des tokens device.
- Onboarding foyer : enregistrement enfant (RM13), gestion pompe avec
  décompte doses (RM7) et détection péremption (RM19), plan de traitement
  quotidien.
- Invitation aidant par QR code (W5/W6) : génération Admin (token 256 bits +
  PIN 6 chiffres + TTL 10 min + Argon2id), scan caméra mobile, acceptation
  avec consentement RM22, session 8 h pour `restricted_contributor` ou 30 j
  pour `contributor`. Quota RM21 (max 10 invitations actives) et verrouillage
  15 min après 3 PINs ratés.

### Qualité & conformité

- Couverture > 80 % sur `packages/crypto`, `packages/sync`, `packages/domain`.
- CI GitHub Actions : lint, typecheck, tests unitaires, format Prettier,
  build Docker `node:20-alpine` (musl).
- Workflow de revue assistée adopté (kz-review + kz-securite systématiques
  sur toute PR touchant une zone sensible).
- Zéro donnée santé côté relais (logs, base, payloads push/e-mail).

### Hors-périmètre v0.1.0-preview.1

- Stockage local chiffré SQLCipher / IndexedDB (prévu Sprint 3).
- Propagation E2EE multi-device en temps réel + résolution de conflits
  (prévu Sprints 4-5).
- Mode offline complet + rappels dose manquée (prévu Sprint 4).
- Rapports médecin + export PDF (prévu Sprint 6).
- Audits cryptographique et pen-test externes (prévus Sprint 6).

[0.1.0-preview.1]: https://github.com/kamez-conseils/kinhale/releases/tag/v0.1.0-preview.1
