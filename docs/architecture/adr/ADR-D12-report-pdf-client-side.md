# ADR-D12 — Génération du rapport médecin PDF 100 % côté client

**Date** : 2026-04-24
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

L'épopée E8 (« Rapports & export médecin ») du backlog Kinhale couvre la remise d'un PDF synthétique (1-2 pages) au professionnel de santé pour préparer la consultation (W9, RM8, RM24, O3). La story E8-S02 — « Génération PDF 1-2 pages » — était initialement étiquetée `Platform: Backend` dans `00-kz-stories.md`. Cette étiquette est **incompatible** avec le principe non négociable de zero-knowledge décrit en CLAUDE.md §Principes non négociables §1 et en SPECS §3.1 :

> Aucune donnée santé en clair ne doit jamais quitter les appareils des utilisateurs. Le relais Kamez ne voit que des blobs chiffrés opaques.

Un PDF généré côté backend exigerait que le document Automerge soit déchiffrable côté relais, ce qui impose au relais de détenir la `groupKey` du foyer. Cette conception détruit la promesse différenciante du produit (« même nous, les créateurs, ne pouvons pas lire les données de votre enfant »), viole la Loi 25 (minimisation §2.2) et le RGPD (art. 25 — privacy by design), et bloque l'auto-hébergement open-source AGPL v3 (un self-hoster peut lire toute la base).

Les specs contiennent d'ailleurs **déjà** la décision correcte dans le workflow W9 (SPECS §5.9) :

> Bouton « Générer PDF » → génération **entièrement côté client** à partir du document Automerge local

Cet ADR **acte formellement** le pivot (`Platform: Backend` → `Platform: Cross-platform client-side`) pour la story E8-S02, aligne l'implémentation KIN-083 et documente les impacts techniques (moteurs PDF différents web vs mobile).

## Options évaluées

### Option A — Génération client-side via HTML canonique + moteur PDF natif par plateforme (retenue)

**Description** : le package partagé `@kinhale/reports` produit une source HTML déterministe (une chaîne pure) depuis les projections du document Automerge local. Ce HTML est ensuite converti en PDF par le moteur natif de chaque plateforme :
- **Web** : `window.print()` sur une iframe détachée (`srcdoc`). Le navigateur ouvre sa boîte d'impression native ; l'utilisateur choisit « Enregistrer en PDF ». Aucune dépendance JS supplémentaire, aucun chargement distant.
- **Mobile** (iOS + Android) : `expo-print.printToFileAsync({ html })` qui utilise WebKit (iOS) / PrintHelper (Android). PDF écrit dans le cache app, puis partagé via `expo-sharing.shareAsync` (Share Sheet iOS / Intent Android).
- **Hash d'intégrité** (RM24) : calculé en deux passes — (1) HTML sans bloc intégrité → source canonique, (2) `sha256HexFromString` sur cette source via `@kinhale/crypto`. Le hash est ensuite ré-injecté dans le pied de page du HTML final. Un médecin peut recalculer le hash à partir du même document Automerge et vérifier l'intégrité du PDF reçu.

**Avantages** :
- **Zero-knowledge préservé strictement** : le relais Kamez ne voit ni le HTML, ni le PDF, ni aucune métadonnée santé. Seul l'audit trail backend reçoit `{ reportHash, rangeStartMs, rangeEndMs, generatedAtMs }` — métadonnées opaques (ADR-D6, SPECS §3.12).
- **Pas de décharge backend** : aucun rendu HTML/PDF serveur, aucun pipeline de file (ex. Bull/BullMQ), aucune rétention de fichiers sur S3 dans ce ticket. La scalabilité est portée par les devices.
- **Auto-hébergement AGPL compatible** : un tiers qui héberge son relais ne peut pas lire les rapports des foyers hébergés.
- **Déterminisme testable** : l'agrégation (`aggregateReportData`) et le template (`renderMedicalReportHtml`) sont des fonctions pures. Les tests Vitest vérifient `hash(doc, range) === hash(doc, range)` et garantissent la reproductibilité du hash d'intégrité RM24.
- **Conforme à W9 existant** : SPECS §5.9 mentionnait déjà « client-side ». Cet ADR aligne la story sur l'intention produit.
- **Dépendances minimales** : le package `@kinhale/reports` n'ajoute que `@kinhale/crypto` + `@kinhale/sync` (déjà présentes). Le web n'ajoute **aucune** dépendance (`window.print` est natif). Le mobile ajoute `expo-print` + `expo-sharing` (modules Expo officiels, licences MIT compatibles AGPL).

**Inconvénients / dette acceptée** :
- **Deux moteurs PDF** à tester : WebKit (iOS), PrintHelper (Android), moteur Chromium/Firefox/Safari (web). Impose un test manuel E2E sur chaque cible avant GA (E8-S08 — validation pneumo-pédiatre).
- **Pagination A4 conditionnelle au moteur** : une plage 90 j peut déborder sur 3 pages si le moteur d'impression choisit une police légèrement différente. Mitigation : CSS `@page { size: A4; margin: 16mm 14mm; }` + polices système sans-serif + pas de SVG (seulement `<table>` + `<div.bar>`) pour garder un rendu reproductible.
- **Impossibilité de purger un PDF partagé** : une fois que l'utilisateur a envoyé le PDF par e-mail / Messages, Kamez ne peut pas le révoquer. Contrainte acceptée — la responsabilité du partage est à l'aidant (principe de local-first).

**Risques** :
- Si un moteur PDF modifie silencieusement le contenu (reformatage retour chariot, fontes de substitution), le hash SHA-256 imprimé ne correspondra plus au hash recalculable depuis le HTML source. Mitigation : on documente que le hash certifie **la source HTML**, pas le PDF résultant. Un auditeur peut régénérer depuis le doc Automerge pour vérifier.
- Si `expo-print` n'est pas disponible (Expo Go sans dev client), l'écran remonte une erreur i18n. Pas de chemin critique cassé — le backup web reste disponible.

### Option B — PDF server-side (Puppeteer / wkhtmltopdf côté relais) (rejetée)

**Description** : le client envoie le document Automerge déchiffré au relais, qui rend un PDF avec Puppeteer / wkhtmltopdf et le renvoie au client. Ou alternativement, le client déchiffre localement et renvoie un HTML déjà préparé au relais pour rendering.

**Avantages** :
- Un seul moteur PDF à maintenir (Puppeteer headless Chromium).
- Pagination A4 plus contrôlée que sur 3 navigateurs différents.

**Inconvénients rédhibitoires** :
- **Violation directe du zero-knowledge** (CLAUDE.md §1) : envoyer un doc déchiffré ou un HTML en clair au relais casse la promesse « même nous ne pouvons pas lire les données de votre enfant ». Incident P0 de confiance.
- **Incompatibilité auto-hébergement** : un relais auto-hébergé ayant accès aux HTML en clair ouvre une surface d'attaque énorme (image Docker compromise, admin malveillant, sauvegardes en clair).
- **Complexité infra** : Puppeteer headless = ~200 MB d'image Docker supplémentaires, pool de workers, file Redis, timeouts, gestion mémoire. Hors budget sprint 6.
- **Minimisation Loi 25 / RGPD** : traiter des données de santé côté serveur requiert une base légale spécifique, une DPIA mise à jour, un hébergement agréé HDS (France) ou équivalent RPRP Québec. Le projet a explicitement choisi un modèle zero-knowledge pour éviter cette obligation.

**Risques** :
- Perte immédiate de la proposition de valeur différenciante. Reputation damage irréversible sur la communauté cible.

### Option C — WebAssembly (libharu / wkhtmltopdf-wasm) côté client (rejetée)

**Description** : porter un moteur PDF en WebAssembly (libharu, ou un portage de wkhtmltopdf) pour avoir un rendu PDF identique sur web et mobile, sans dépendre du moteur natif.

**Avantages** :
- Rendu 100 % reproductible entre plateformes (même binaire).
- Zero-knowledge préservé (exécution sur le device).

**Inconvénients** :
- Poids binaire : libharu wasm ≈ 800 kB, wkhtmltopdf wasm ≈ 7 MB. Coût réseau significatif au premier chargement.
- Compatibilité mobile : React Native n'exécute pas WASM nativement sans un bridge. Il faut un JSI native module (expo-wasm) encore en alpha.
- Audit de sécurité : un moteur PDF complet = grande surface d'attaque (CVE libharu 2023-5455 encore récent). Pour un usage minimaliste (HTML → PDF portrait), c'est disproportionné.
- Maintenance : pas de communauté active sur libharu-wasm, responsabilité entière sur l'équipe Kinhale.

**Risques** :
- Dette technique haute pour un gain marginal (reproductibilité du rendu, déjà compensée par la vérification du hash SHA-256 qui certifie la source, pas le pixel).

## Critères de décision

1. **Conformité zero-knowledge** (CLAUDE.md §1) : priorité absolue. Toute option qui expose le relais à du contenu santé est éliminée.
2. **Conformité RM8** : le rapport ne doit contenir aucune recommandation de dose, aucun diagnostic, aucun message « appelez votre médecin ». Ce critère est indépendant du moteur et s'applique au template — vérifié par tests unitaires dans `medical-report-html.test.ts`.
3. **Conformité RM24** : hash SHA-256 + timestamp + générateur imprimés en pied de dernière page, calculés côté client.
4. **O3 (perf < 5 s p95)** : le temps de rendu côté client doit rester sous 5 s pour une plage 90 j sur device de référence (iPhone 11 / Android Pixel 5).
5. **Dépendances minimales AGPL-compatibles** : pas de librairie GPLv3 qui contaminerait l'app, pas de dépendance lourde sans nécessité.
6. **Testabilité unitaire** : l'agrégation + le hash doivent être testables sans moteur de rendu (Vitest pur Node).

## Décision

**Choix retenu : Option A — HTML canonique déterministe rendu par le moteur PDF natif de chaque plateforme (web `window.print()`, mobile `expo-print`), hash SHA-256 calculé en deux passes via `@kinhale/crypto`.**

Cette décision préserve strictement le zero-knowledge, ne crée aucune dépendance lourde, et exploite des mécanismes natifs éprouvés sur toutes les cibles. Le compromis — la non-reproductibilité pixel-perfect entre moteurs — est absorbé par le hash d'intégrité qui certifie **la source HTML déterministe**, pas le rendu visuel. Un médecin auditeur peut régénérer la source depuis le doc Automerge et vérifier.

La décision doit être révisée si :
1. Un moteur PDF natif modifie la source HTML au point de casser le hash de façon systématique (à traquer en E8-S08).
2. Un incident Loi 25 / RGPD identifie la métadonnée `{ rangeStartMs, rangeEndMs }` comme donnée santé régulée (improbable, c'est une plage temporelle pure).
3. Un besoin produit non couvert en v1.0 (signature cryptographique du PDF par un pneumo-pédiatre, interopérabilité HL7/FHIR) impose une nouvelle architecture.

## Conséquences

**Positives** :
- Zero-knowledge intégralement préservé sur la génération de rapport. Le relais Kamez n'apprend rien de médical.
- Package `@kinhale/reports` pur, testable à 100 % avec Vitest Node (34 tests unitaires, couverture visée > 80 %).
- Aucune infra de rendu PDF serveur à exploiter ni à sécuriser.
- Compatible auto-hébergement AGPL : un tiers hébergeur ne peut pas lire les rapports.
- Audit trail backend `POST /audit/report-generated` minimaliste (4 champs), avec Zod `.strict()` qui rejette tout champ extra.
- Extensible : la story E8-S04 (partage lien signé) ajoutera un upload du PDF **déjà chiffré** côté client, le relais ne verra qu'un blob.

**Négatives / dette acceptée** :
- Trois moteurs PDF à tester manuellement (WebKit iOS, PrintHelper Android, moteur navigateur). Test manuel requis en E8-S08.
- Pagination A4 non garantie pixel-perfect entre moteurs. Le hash certifie la **source canonique**, pas le PDF final.
- Pas de génération asynchrone en v1.0 pour les grandes plages (E8-S06 ticket séparé). Une plage > 24 mois est refusée par `validateDateRange`.

**Plan d'implémentation** :
- `packages/reports/src/range/date-range.ts` : validation plage (presets 30/90 j, rejet > 24 mois, inversions).
- `packages/reports/src/data/aggregate.ts` : fonction pure `aggregateReportData(doc, range) → ReportData` (observance, rescue/semaine, timeline symptômes).
- `packages/reports/src/templates/medical-report-html.ts` : rendu HTML canonique déterministe (CSS A4, polices système, disclaimer RM8).
- `packages/reports/src/hashing/sha256-report.ts` : wrapper `hashReportContent` → `@kinhale/crypto.sha256HexFromString`.
- `packages/reports/src/generate.ts` : pipeline deux-passes (content → hash → HTML final avec pied de page intégrité).
- `apps/web/src/app/reports/page.tsx` : écran Tamagui (sélecteur plage, iframe d'impression, bouton télécharger).
- `apps/mobile/app/reports/index.tsx` : écran Tamagui (sélecteur plage, `expo-print` + `expo-sharing`).
- `apps/api/src/routes/audit.ts` : `POST /audit/report-generated` (Zod `.strict()`, rate-limit Redis 10/h/device).
- `apps/api/src/db/schema.ts` + `migrations/0003_audit_events.sql` : table `audit_events` + migration.
- `packages/i18n/src/locales/{fr,en}/common.json` : sous-arbre `report.*` (title, sections, labels, disclaimer, UI errors).

**Points à tracer (follow-ups)** :
- **E8-S04 (KIN-084)** : partage lien signé — reprendre le HTML canonique, chiffrer côté client, pousser blob opaque au relais, générer un lien signé. Exploite déjà le hash d'intégrité pour vérifier l'upload.
- **E8-S06 (KIN-086)** : génération asynchrone si > 5 s (notif `report_ready`). Ne concerne que les plages maximum admises.
- **E8-S08** : validation pneumo-pédiatre (DoD PRD) — test manuel lecture < 30 s par un praticien. Inclut un cross-check des 3 moteurs PDF.
- **kz-conformite sur disclaimer** : le texte du disclaimer a été rédigé d'après la ligne rouge dispositif médical (CLAUDE.md §Principes §2). Passage kz-conformite requis avant publication v1.0 pour valider la formulation juridique précise. Issue de suivi ouverte.

## Statut futur

ADR **Accepté** pour la v1.0. Revue obligatoire lors de l'implémentation E8-S08 (validation pneumo-pédiatre) : si le praticien identifie un manque d'information critique dans le PDF qui ne peut pas être servi client-side sans un calcul lourd (ex. comparaison longitudinale sur 5 ans), re-ouvrir l'option asynchrone locale (worker WebWorker / Hermes Web Worker) plutôt que de basculer serveur.

## Révision prévue

Revue mandatoire après validation pneumo-pédiatre (E8-S08) et après audit crypto externe si les flux d'export sont dans le périmètre. Revue anticipée si un incident de sécurité concerne un champ qui fuite côté audit trail.
