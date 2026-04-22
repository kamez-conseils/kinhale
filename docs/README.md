# Documentation Kinhale

> **Index de la documentation publique du projet Kinhale**
> Version : 0.2.0 — Date : 2026-04-20
> Licence : AGPL v3

Bienvenue dans la documentation de **Kinhale**, une application multi-plateforme (web + iOS + Android) open source sous licence AGPL v3 qui permet aux aidants d'un enfant asthmatique de coordonner, tracer et partager les prises de pompes de fond et de secours. Architecture local-first avec partage E2EE zero-knowledge : les données de santé restent chiffrées sur les appareils des utilisateurs.

Cette page liste les documents de cadrage publiques du projet. Le guide général (conventions, structure monorepo, commandes) est dans le fichier `CLAUDE.md` à la racine du dépôt.

## Documents de cadrage

| Document | Description | Chemin |
|---|---|---|
| **PRD** (Product Requirements Document) | Vision produit, personas, parcours utilisateurs J1-J7, périmètre fonctionnel v1.0 / v1.1 / v2.0, métriques de succès (OKR) et critères de sortie. | [`product/PRD.md`](./product/PRD.md) |
| **SPECS** (Spécifications fonctionnelles) | Modèle de données logique, règles métier RM1-RM28, workflows W1-W12, écrans E1-E13, contrats API REST + WebSocket, exigences non fonctionnelles, critères d'acceptation globaux. | [`product/SPECS.md`](./product/SPECS.md) |
| **ARCHITECTURE** (Architecture technique) | Vision local-first + E2EE zero-knowledge, stack technique (React Native, Next.js, Fastify, PostgreSQL, libsodium, MLS, Automerge), infrastructure AWS ca-central-1, conventions de code, Gitflow, roadmap technique v1.0 (13 semaines). | [`architecture/ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) |
| **COMPLIANCE** (Cadre de conformité) | Classification des données, cadre réglementaire multi-juridictions (Loi 25, PIPEDA, RGPD, COPPA), principes privacy by design, consentement, hébergement et chiffrement, gouvernance, risques conformité. | [`product/COMPLIANCE.md`](./product/COMPLIANCE.md) |
| **COMPLIANCE — QR Onboarding** | Validation Loi 25 + RGPD du flux d'onboarding assisté par QR code (parcours B), microcopie de consentement bilingue, 6 ajustements bloquants intégrés aux maquettes. | [`product/COMPLIANCE_QR_ONBOARDING.md`](./product/COMPLIANCE_QR_ONBOARDING.md) |

## Design

| Document | Description | Chemin |
|---|---|---|
| **BRANDING** (Identité de marque) | Mission, vision, valeurs, personnalité Gardien + Compagnon, ton de voix bilingue FR/EN, palette vert sauge `#2F6B5A`, typographies Inter + Fraunces, naming et 5 décisions validées. | [`design/BRANDING.md`](./design/BRANDING.md) |
| **UX RESEARCH** (Recherche utilisateur) | 6 personas d'aidants (parents, grand-parent, nounou, éducatrice CPE, enfant), parcours J1-J7, 7 moments de vérité, 12 insights, 10 principes d'interaction non-négociables dont le "test Lise". | [`design/UX_RESEARCH.md`](./design/UX_RESEARCH.md) |
| **UI DESIGN** (Conception UI) | 51 écrans spécifiés en 9 flows (onboarding double parcours A+B, usage quotidien, cercle de soin, pompes, rappels, exports, paramètres, edge cases, légal), wireframes des 7 moments de vérité, 10 décisions design validées. | [`design/UI_DESIGN.md`](./design/UI_DESIGN.md) |
| **DESIGN SYSTEM** (Système de design) | Tokens Tamagui-ready (couleurs, typographie, espacement, motion), modes clair + sombre en parité, 60 composants spécifiés (21 primitives, 16 composition, 23 Kinhale-spécifiques), règles a11y WCAG 2.1 AA, règles i18n, roadmap 40 j-personnes. | [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md) |

## À propos de ces documents

- **Public cible** : contributeurs et contributrices, opérateurs d'instances self-hostées, partenaires cliniques et toute personne souhaitant comprendre le projet en profondeur.
- **Versionnement** : ces documents sont versionnés avec le code source ; toute modification structurante doit passer par une PR et être reflétée dans le changelog du dépôt.
- **Architecture Decision Records (ADRs)** : les décisions techniques structurantes sont consignées dans `architecture/adr/` (à créer au Sprint 0).
- **Documentation utilisateur et self-hosting** : voir `user/` (à venir).
- **Guide de contribution / Gitflow** : voir `contributing/` (à venir).

## Contact

- **Mainteneur principal** : Martial Kaljob — `martial@wonupshop.com`
- **Sécurité** : signaler toute vulnérabilité à `security@kinhale.health` (voir `SECURITY.md` à venir).

---

*Index publié le 2026-04-19, mis à jour le 2026-04-20 sous licence AGPL v3.*
