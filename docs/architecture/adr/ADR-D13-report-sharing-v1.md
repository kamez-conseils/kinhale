# ADR-D13 — Partage du rapport médecin (PDF + CSV) : download + share sheet en v1.0, « lien signé 7 j » reporté en v1.1

**Date** : 2026-04-24
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

La story E8-S04 — « Partage : télécharger, envoyer par e-mail, lien signé » — exige trois modes de partage pour le rapport médecin :

1. **Télécharger** localement le document (PDF ou CSV).
2. **Envoyer** par e-mail.
3. **Copier un lien signé (7 j)** — lien cliquable par un tiers qui récupère le rapport.

Les deux premiers sont naturellement compatibles avec le pivot acté en **ADR-D12** (rapport PDF 100 % client-side) et le principe non négociable de zero-knowledge (CLAUDE.md §Principes §1) :

- **Télécharger** : le fichier est créé en mémoire (Blob côté web, `FileSystem` côté mobile) et pousse dans le téléchargement navigateur / share sheet OS. Rien ne transite vers le relais.
- **Envoyer** : sur mobile, `expo-sharing.shareAsync` ouvre la share sheet iOS / Android, l'utilisateur choisit Mail / Gmail / iMessage / WhatsApp / Messages. Sur web, `navigator.share` (si disponible) ouvre le picker système ; sinon un téléchargement local que l'utilisateur attache à son propre client mail. Le contenu santé part **depuis le device de l'aidant via son propre client**, pas via le relais Kamez.

Le **troisième mode — lien signé 7 j** — pose un problème architectural structurel. Deux interprétations possibles :

- **A.** Upload du fichier **en clair** sur le relais, lien HTTPS signé (ACL S3 ou équivalent) avec TTL 7 j.
- **B.** Upload du fichier **chiffré client-side** sur le relais, clé de déchiffrement transportée dans le **fragment URL** (`#key=…`) — « wormhole pattern » — afin que le relais ne détienne que du blob opaque. Le navigateur du tiers déchiffre localement grâce au fragment.

La variante A **viole directement** le zero-knowledge : le relais détient du contenu santé en clair, accessible à un administrateur Kamez, à un self-hoster compromis, ou à une réquisition. Inacceptable. La variante B est compatible zero-knowledge (le fragment n'est jamais envoyé au serveur par les navigateurs) mais introduit :

- Infra S3 chiffrée côté client + endpoint `POST /reports/upload` + endpoint `GET /reports/:id` + purge cron 7 j (file Redis + worker) ;
- Gestion du chiffrement de fichier côté client (XChaCha20-Poly1305 streaming + clé éphémère à embarquer dans le fragment) ;
- Pages web publiques de téléchargement (`kinhale.health/r/:id`) qui doivent déchiffrer côté client — donc build web supplémentaire, attention UX (que faire si le tiers utilise un navigateur qui retire le fragment lors d'un copier-coller ?) ;
- Authentification : qui peut révoquer le lien avant 7 j ? Comment distinguer l'owner ?
- Test de chiffrement de fichier de bout en bout (nouveau vector) et audit crypto externe.

Coût estimé : **2 à 3 jours** d'ingénierie + frais S3 modestes + surface de sécurité élargie. **Non bloquant** pour la valeur utilisateur v1.0 : l'aidant reste capable de remettre le rapport au médecin via la share sheet OS (iOS Mail / Gmail / AirDrop / iMessage / WhatsApp). Les retours UX de la discovery (`.agents/current-run/00-kz-ux-research.md`) identifient cet usage comme dominant à court terme.

## Options évaluées

### Option A — Upload en clair + lien signé 7 j (rejetée)

**Description** : le client upload le PDF/CSV en clair vers un bucket S3, le relais génère un lien signé HTTPS avec TTL 7 j.

**Avantages** :
- Simplicité de mise en œuvre (~0,5 j).
- UX identique à tout service de transfert de fichiers standard.

**Inconvénients rédhibitoires** :
- **Violation directe zero-knowledge** : admin Kamez, réquisition judiciaire, backup S3 compromis → accès aux données santé en clair.
- **Incompatibilité AGPL self-hosting** : un self-hoster malveillant pourrait lire tous les rapports.
- **Loi 25 / RGPD** : héberger des données santé en clair exige DPIA + hébergeur agréé RPRP (Québec) / HDS (France). Pas dans le budget v1.0.
- **Brise la promesse produit** : « même nous ne pouvons pas lire les données de votre enfant » devient fausse.

### Option B — Upload chiffré client-side + fragment-as-key (reporté en v1.1, retenu comme direction cible)

**Description** : le client chiffre le PDF/CSV avec une clé éphémère X25519+XChaCha20-Poly1305, upload le blob opaque sur S3, renvoie un lien de la forme `https://kinhale.health/r/:id#key=<base64url>`. Le fragment `#…` n'est jamais envoyé au serveur HTTP par les navigateurs conformes. Le tiers clique, le navigateur charge la page de téléchargement, lit `window.location.hash`, récupère le blob chiffré, déchiffre côté client.

**Avantages** :
- Zero-knowledge préservé (relais voit uniquement du blob opaque).
- Lien asynchrone (l'aidant n'a pas besoin d'être sur son device au moment où le médecin ouvre le lien).
- Lien expirable côté serveur (purge 7 j), révocable en supprimant le blob.
- Pattern éprouvé (Firefox Send, Send.ly, certains services Yubico).

**Inconvénients** :
- Coût dev 2-3 j : endpoint upload + endpoint purge + page web publique de download + chiffrement streaming client + test d'intégration + audit crypto.
- Dépendance infra S3/CloudFront + worker de purge.
- Surface de sécurité : gestion du fragment côté navigateur (logs serveur référer, copier-coller qui perd le fragment, reverse proxy mal configuré qui logge les URLs complètes).
- Cas où le tiers utilise un navigateur qui n'exécute pas JS (client mail très vieux) : le fragment-as-key ne fonctionne pas. Mitigation : afficher un message « ouvrez le lien dans un navigateur moderne ».

### Option C — Download uniquement + share sheet OS (retenue pour v1.0)

**Description** : l'écran « Rapport » propose deux boutons sur chaque format (PDF et CSV) :
1. **Télécharger** : ouvre le téléchargement natif (download web / share sheet mobile).
2. **Envoyer** : déclenche explicitement la share sheet (mobile) ou `navigator.share` (web si dispo, sinon fallback download).

Le bouton « Lien signé 7 j » est **absent** de l'UI v1.0. Un ticket de suivi explicite « Follow-up KIN-084 » est ouvert pour la v1.1 et rattaché à l'ADR-D13.

**Avantages** :
- Zero-knowledge strictement préservé (aucune infra S3, aucun blob santé sur le relais).
- UX acceptable pour la v1.0 : l'aidant partage via son propre client (Mail / Gmail / iMessage / WhatsApp) en sortant de l'app. C'est un flux « natif » sur mobile (share sheet).
- Aucune nouvelle dépendance infra ; aucune nouvelle surface d'attaque.
- Compatible ADR-D12, ADR-D4 (relais minimaliste).
- Livre la valeur E8-S04 partiellement (2/3 modes) dans le budget v1.0.

**Inconvénients / dette acceptée** :
- Pas de partage asynchrone (l'aidant doit être sur son device au moment du partage).
- Pas de révocation (une fois le PDF partagé par email, Kamez ne peut pas révoquer).
- La story E8-S04 est livrée **partiellement** — DoD E8-S04 marqué « partial » avec un follow-up v1.1 explicite dans `00-kz-stories.md`.

## Critères de décision

1. **Conformité zero-knowledge** (CLAUDE.md §1) : priorité absolue. Élimine A.
2. **Coût v1.0** : la v1.0 est cadrée à 13 semaines et ~260 k$ CAD. B ajoute 2-3 j + infra + audit crypto ; non prioritaire vs. E9 (suppression self-service) ou E11 (magic link).
3. **UX acceptable** : share sheet OS est déjà le flux dominant sur mobile en 2026. Web : `navigator.share` couvre > 75 % des navigateurs récents.
4. **Extensibilité v1.1** : garder la porte ouverte pour B sans dette architecturale — exactement ce qu'on obtient avec C (on ajoute un 3e bouton plus tard sans remettre en cause la génération client-side).

## Décision

**Choix retenu : Option C — Download + share sheet OS en v1.0. Le lien signé 7 j (pattern fragment-as-key) est reporté en v1.1 via un ticket de suivi dédié et un ADR futur qui détaillera le schéma de chiffrement, la page publique de download et le worker de purge.**

L'ADR-D13 **acte le scope partiel** de la story E8-S04 pour v1.0 : 2 modes sur 3. Les acceptance criteria `E-mail : aucun contenu santé en clair, lien signé` sont satisfaits par la share sheet OS (le contenu part du device de l'aidant via son propre client mail), mais le lien lui-même n'est pas livré.

## Conséquences

**Positives** :
- Zero-knowledge préservé strictement. Aucune nouvelle surface d'attaque côté relais.
- Aucune dette infra (pas de S3, pas de worker purge, pas de page publique de download) en v1.0.
- Audit réglementaire simple : le backend ne voit que des métadonnées opaques (hash + méthode de partage) via `POST /audit/report-shared`.
- Compatible auto-hébergement AGPL : un self-hoster ne peut rien intercepter.

**Négatives / dette acceptée** :
- Pas de partage asynchrone de rapport en v1.0.
- Dépendance à l'UX share sheet OS : si un aidant est sur un navigateur desktop sans `navigator.share`, il doit télécharger puis attacher manuellement au mail (UX 1 clic supplémentaire, message explicatif prévu).
- Follow-up v1.1 **obligatoire** (ticket ouvert à la création de l'ADR) — le report ne doit pas glisser en v2.0 si des retours utilisateur remontent le besoin.

**Plan d'implémentation (KIN-084)** :
- `packages/reports/src/csv/generate-csv.ts` : fonction pure `generateMedicalCsv(data: ReportData): string`. Échappement CSV conforme RFC 4180, BOM UTF-8, colonnes fixées dans l'ordre :
  1. `datetime_local` (ISO `YYYY-MM-DDTHH:mm:ss±HH:mm` calculé côté client)
  2. `datetime_utc` (ISO `YYYY-MM-DDTHH:mm:ss.sssZ`)
  3. `type` (`maintenance` / `rescue`)
  4. `pump_id` (identifiant opaque, pas le nom — évite fuite freeFormTag)
  5. `dose_count` (`dosesAdministered`)
  6. `symptoms` (liste `|`-séparée de codes stables `cough` / `wheezing` / …)
  7. `circumstances` (liste `|`-séparée de codes stables)
  8. `caregiver_id` (identifiant opaque)
  9. `status` (`recorded` / `pending_review`)
- Séparateur `,` universel + quoting RFC 4180 (double-quote + échappement `""`). Option BOM UTF-8 activée par défaut pour compatibilité Excel.
- Web : ajouter boutons « Télécharger CSV » et « Partager CSV » à `apps/web/src/app/reports/page.tsx` ; piper via `Blob` + `URL.createObjectURL` ; `navigator.share({ files: [...] })` si dispo, sinon download seul.
- Mobile : ajouter boutons « Exporter CSV » + bouton « Envoyer » sur le PDF (déjà là) à `apps/mobile/app/reports/index.tsx` ; `FileSystem.writeAsStringAsync` + `Sharing.shareAsync` ; purge après partage.
- Backend : `POST /audit/report-shared` (même pattern que `/audit/report-generated`, quota 20/h/device). Zod `.strict()` avec enum fermée `shareMethod ∈ {download, system_share, csv_download, csv_system_share}`.
- i18n : sous-arbre `report.ui.csv.*` + libellés `downloadPdfCta`, `sharePdfCta`, `downloadCsvCta`, `shareCsvCta`.
- Exclusions explicites (RM8 keyword-filter) : aucun champ interprétatif dans le CSV (pas de « controlled »/« contrôlé », pas de « severe »/« sévère », pas de « increase dose »/« augmenter dose »). Test unitaire vérifiant l'absence de ces mots dans un CSV d'exemple riche.

**Plan v1.1 (ticket de suivi `[v1.1] KIN-XXX`)** :
- ADR-D14 à rédiger : pattern wormhole, chiffrement streaming XChaCha20-Poly1305, gestion du fragment côté navigateur, choix S3 + CloudFront.
- Endpoint `POST /reports/upload` (blob opaque, Content-Type octet-stream).
- Endpoint `GET /reports/:id` (lien direct signé CloudFront, purge 7 j).
- Page publique `apps/web/src/app/r/[id]/page.tsx` qui déchiffre côté client via fragment.
- Worker de purge `apps/api/src/workers/purge-reports.ts` (cron 1 h).
- Tests d'intégration E2E Playwright : upload → partage lien → déchiffrement côté tiers → vérification hash intégrité.
- Audit crypto externe sur le flux chiffrement streaming + fragment.

## Révision prévue

ADR **Accepté** pour la v1.0. Revue **obligatoire** à l'ouverture du ticket v1.1 (pattern wormhole) — un ADR-D14 concret sera publié avec les détails cryptographiques et un test vector. L'option A (upload en clair) restera **interdite** sauf décision explicite qui casserait le pilier zero-knowledge — dans ce cas l'ensemble du produit devrait être repositionné.
