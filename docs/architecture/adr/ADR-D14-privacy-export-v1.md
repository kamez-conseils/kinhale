# ADR-D14 — Export de portabilité RGPD / Loi 25 v1.0 : archive ZIP générée client-side

**Date** : 2026-04-24
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

L'épopée E9 (« Conformité ») du backlog Kinhale couvre l'exercice par l'utilisateur de ses droits RGPD (art. 15 — accès, art. 17 — effacement, art. 20 — **portabilité**) et Loi 25 (art. 27 — accès, art. 28 — rectification, **art. 30 — portabilité**, art. 28.1 — désindexation). La story E9-S02 — « Export de portabilité à la demande » — exige une archive complète CSV + PDF des données de l'utilisateur, livrable « à la demande », avec un SLA réglementaire **≤ 30 jours**.

Le brouillon initial de la story ainsi que les specs §7.2 mentionnent un endpoint `POST /privacy/export` qui produirait l'archive et l'enverrait par e-mail sécurisé via lien signé 7 j (`Critères : E-mail sécurisé + lien signé 7 j`). Cette conception **viole directement** le principe non négociable de zero-knowledge (CLAUDE.md §Principes §1) :

> Aucune donnée santé en clair ne doit jamais quitter les appareils des utilisateurs. Le relais Kamez ne voit que des blobs chiffrés opaques.

Une archive de portabilité CSV + PDF générée côté serveur exigerait que le doc Automerge soit déchiffrable par le relais — donc que la `groupKey` du foyer soit confiée à Kamez. La promesse différenciante du produit (« même nous, les créateurs, ne pouvons pas lire les données de votre enfant ») serait détruite, l'AGPL self-hosting deviendrait dangereuse (image Docker compromise = fuite immédiate), et la base légale Loi 25 / RGPD passerait du modèle « éditeur de logiciel » au modèle « hébergeur de données de santé » — qui exige hébergement HDS (France) ou agrément RPRP renforcé (Québec).

L'**ADR-D12** a déjà acté ce pivot pour le rapport médecin (E8) : génération HTML/PDF 100 % client-side. L'**ADR-D13** a prolongé ce pivot pour le partage du rapport (E8-S04) : download + share sheet OS en v1.0, lien signé 7 j (pattern wormhole) reporté en v1.1. **Cet ADR applique le même raisonnement à l'export de portabilité.**

Le défi spécifique de E9-S02 est la **complétude** de l'export : la portabilité RGPD/Loi 25 ne couvre pas seulement le journal médecin, elle couvre **toutes** les données personnelles que le responsable de traitement détient sur l'utilisateur. Cela inclut :

1. **Données santé** (doc Automerge E2EE local) — projections doses, symptômes, pompes, plan, enfant, aidants. Ces données ne sont **jamais** vues en clair par le relais — seul le device de l'utilisateur peut les exporter.
2. **Métadonnées relais** qui concernent l'utilisateur — devices enregistrés, audit events `report_generated` / `report_shared`, préférences de notifications, quiet hours, comptage de push tokens. Ces métadonnées ne contiennent pas de données santé (cf. ADR-D12 §Audit trail) mais constituent bien des données personnelles au sens RGPD/Loi 25, et entrent donc dans la portabilité.

Les `mailbox_messages` ne sont **pas** inclus : le contenu est chiffré opaque et n'est pas attribuable individuellement à l'utilisateur (ils sont indexés par `householdId`, pas par `accountId` ; ils sont de toute façon déjà restitués via le doc Automerge synchronisé).

## Options évaluées

### Option A — Export entièrement server-side avec lien signé 7 j (rejetée — viole zero-knowledge)

**Description** : endpoint `POST /privacy/export` qui :
1. Récupère le doc Automerge déchiffré côté relais (impose une nouvelle architecture où le relais détient la groupKey).
2. Agrège les métadonnées relais.
3. Génère le ZIP côté serveur.
4. Push sur S3 avec ACL signée 7 j.
5. Envoie un e-mail au RPRP de l'utilisateur avec le lien.

**Avantages** :
- Conformité « par défaut » au libellé brut de la story E9-S02.
- UX asynchrone (l'utilisateur n'a pas besoin d'être sur son device).
- Compatible « sortie de l'écosystème » (l'utilisateur peut récupérer ses données même sans accès à son device, en cliquant le lien e-mail).

**Inconvénients rédhibitoires** :
- **Violation directe zero-knowledge** (CLAUDE.md §Principes §1) : envoyer au relais le doc déchiffré ou un ZIP en clair = casse la promesse produit. Incident P0 de confiance.
- **Viol du contrat AGPL** : un self-hoster malveillant ou compromis pourrait lire toutes les données santé.
- **Hébergement HDS / RPRP requis** : traiter des données santé côté serveur exige un agrément. Hors budget v1.0.
- **Surface d'attaque énorme** : pipeline ZIP + S3 + worker purge + signature CloudFront. ~5 j de dev + audit crypto externe.

**Risques** :
- Perte irréversible de la valeur produit. Reputation damage.

### Option B — Export client-side avec archive téléchargée + share sheet OS (retenue)

**Description** : l'écran « Paramètres → Confidentialité » expose un bouton « Exporter mes données (RGPD / Loi 25) ». Le pipeline est :

1. **Fetch des métadonnées relais** via un nouvel endpoint authentifié `GET /me/privacy/export/metadata` :
   - Authz : `sub` du JWT scope strictement les résultats à l'utilisateur courant.
   - Rate-limit Redis : 5/h/device (action rare).
   - Retourne uniquement les données qui concernent l'utilisateur courant : devices, audit events `report_generated` / `report_shared`, notification preferences, quiet hours, comptage push tokens. **Pas** d'identifiants d'autres utilisateurs.
   - Aucune donnée santé.
2. **Sérialisation déterministe** du doc Automerge local via `@kinhale/reports/privacy-export/serialize-doc.ts` → JSON plat `{doses, symptoms, pumps, plans, children, caregivers}` (utilise les projections existantes `projectDoses`, `projectPumps`, etc.).
3. **Génération CSV** complet via `@kinhale/reports.generateMedicalCsv` (réutilise E8-S03) avec une plage maximum (24 mois — limite déjà imposée par `validateDateRange`).
4. **Génération HTML** rapport complet via `@kinhale/reports.generateMedicalReport` avec la même plage maximum, sans filtre médecin (toutes les prises, y compris `pending_review`).
5. **Calcul des hashes SHA-256** (`@kinhale/crypto.sha256HexFromString`) de chaque fichier individuel pour l'intégrité.
6. **Construction du `README.txt`** bilingue FR/EN avec :
   - Disclaimer non-DM (RM27).
   - Liste des fichiers de l'archive avec leur hash SHA-256 individuel.
   - Date d'export, version Kinhale, accountId pseudonymisé.
   - Note explicite « Le relais Kamez n'a jamais accès à vos données santé. Cette archive a été produite intégralement sur votre appareil. »
7. **Construction du ZIP** via `fflate` (pure JS, ~12 KB minified, MIT license, fonctionne web + RN sans natif). Pas de compression — `STORE` mode (pas besoin pour des données santé déjà compactes).
8. **Download / Share** :
   - Web : `Blob` + `URL.createObjectURL` + `<a download>` ou `navigator.share({ files: [...] })`.
   - Mobile : `FileSystem.writeAsStringAsync` (base64) + `Sharing.shareAsync` + purge à l'unmount.
9. **Audit trail** : `POST /audit/privacy-export` (nouveau endpoint, pattern strict identique à `/audit/report-generated`) avec `{archiveHash, generatedAtMs}`.

**Avantages** :
- **Zero-knowledge préservé strictement** : aucune donnée santé ne quitte le device. Le seul aller-retour réseau est le fetch de métadonnées non-santé scope-isolées par JWT, et un audit minimaliste.
- **SLA ≤ 30 j respecté trivialement** : l'export est **quasi-instantané** (pipeline pur sur device, < 10 s pour un foyer médian).
- **Aucune infra serveur ajoutée** : pas de S3, pas de CloudFront, pas de worker purge. La table `audit_events` existante (ADR-D12) accueille un nouveau `event_type = 'privacy_export'` sans migration de schéma.
- **Compatible AGPL self-hosting** : un self-hoster ne peut pas intercepter l'archive.
- **Déterministe et testable** : sérialisation pure, hashes reproductibles, tests Vitest sans moteur de rendu.
- **Conforme RGPD art. 20 / Loi 25 art. 30** : « format structuré, couramment utilisé et lisible par machine » — JSON + CSV + texte FR/EN cochent les trois.

**Inconvénients / dette acceptée** :
- **Pas d'envoi asynchrone par e-mail** : l'utilisateur doit être sur son device pour exporter. Acceptable car (a) l'app a déjà la contrainte « device requis » pour toutes les fonctions critiques, (b) la share sheet OS permet de transférer l'archive vers n'importe quel client / cloud personnel.
- **Pas de lien signé 7 j en v1.0** : reporté en v1.1 via un pattern wormhole équivalent à celui du rapport médecin (futur ADR-D15). Issue de suivi `[v1.1] KIN-XXX` ouverte à la création de cet ADR.
- **Limite de mémoire navigateur** : un foyer extrême avec 24 mois × ~10 prises/jour ≈ 7 000 prises génère un ZIP de l'ordre de 1-2 MB. Largement dans les capacités d'un device moderne.
- **`fflate` est une dépendance ajoutée au monorepo**. Auditée en kz-securite, MIT, sans deps transitives, ~12 KB minified, gérée par 1 mainteneur actif (101bytes). Risque acceptable pour un usage isolé (pas de chemin critique de sécurité). Vendoring envisageable si le mainteneur disparaît.

### Option C — Export client-side via fragment-as-key wormhole (reporté en v1.1)

**Description** : même pipeline que B mais l'archive est aussi uploadée chiffrée vers le relais et accessible via lien `https://kinhale.health/privacy/:id#key=...`. Le tiers (RPRP du compte) peut ainsi récupérer ses données depuis un autre device en cliquant un lien e-mail.

**Avantages** :
- Couvre le cas « je veux exporter mais je n'ai pas mon device principal sous la main ».
- Compatible zero-knowledge si le chiffrement client-side est correct (cf. ADR-D13 wormhole).

**Inconvénients pour v1.0** :
- Coût ingénierie 2-3 j (pipeline upload chiffré, page web publique, worker purge, audit crypto externe).
- Pattern à mutualiser avec le wormhole rapport médecin (E8-S04 v1.1) — refactoring nécessaire.
- Surface d'attaque élargie sans nécessité v1.0 (l'utilisateur peut exporter depuis son device principal et envoyer l'archive par e-mail manuellement).

**Décision** : reporté en v1.1, ADR-D15 dédié à rédiger en même temps que la mutualisation rapport / privacy export wormhole.

## Critères de décision

1. **Conformité zero-knowledge** (CLAUDE.md §1) : priorité absolue. Élimine A.
2. **Conformité RGPD art. 20 / Loi 25 art. 30** : format structuré + couramment utilisé + lisible par machine — JSON, CSV, texte cochent.
3. **SLA ≤ 30 j** : trivial dans B et C (export quasi-instantané sur device).
4. **Coût v1.0** : la v1.0 est cadrée à 13 semaines / ~260 k$. B = 1-1.5 j, C = +2-3 j. B livre la valeur RGPD/Loi 25 dans le budget.
5. **Compatible AGPL self-hosting** : élimine A.
6. **Anti-DM (RM8, RM27)** : l'export contient les données brutes telles que saisies par les aidants — aucune interprétation médicale, aucune recommandation. Vérifié par tests.

## Décision

**Choix retenu : Option B — Export client-side avec archive ZIP téléchargée + share sheet OS en v1.0. Le mode wormhole (lien signé 7 j) est reporté en v1.1 via un ticket de suivi dédié et un futur ADR-D15.**

L'ADR-D14 acte que :
- Le relais ne voit jamais le contenu santé exporté.
- L'archive est strictement reproductible depuis (doc Automerge local + métadonnées relais à un instant `t`).
- L'utilisateur **doit** être sur son device pour exporter (acceptable cf. discovery UX).
- Le SLA réglementaire ≤ 30 j est respecté trivialement (~secondes).

## Conséquences

**Positives** :
- Zero-knowledge préservé strictement. Aucune nouvelle infra serveur.
- Architecture cohérente avec ADR-D12 et ADR-D13 (même pivot, mêmes patterns).
- Audit trail pour `privacy_export` mutualisé avec la table `audit_events` existante (réutilise la migration 0003 sans changement DB).
- Tests : pipeline pur sérialisation → hash → ZIP testable à 100 % en Vitest Node.
- Pas de DPIA ajouté (pas de nouveau traitement — un nouveau droit utilisateur exercé).
- Compatible self-hosting AGPL : un tiers hébergeur ne peut rien intercepter.

**Négatives / dette acceptée** :
- Pas de lien signé 7 j en v1.0 (reporté v1.1 via issue dédiée — engagement contractuel).
- L'utilisateur doit être sur son device. Si son device est perdu / volé, il doit d'abord restaurer son compte (recovery seed) puis exporter.
- Dépendance `fflate` ajoutée au monorepo. Auditée et minimaliste, mais à surveiller pour les CVE.

**Plan d'implémentation (KIN-085)** :
- `packages/reports/src/privacy-export/serialize-doc.ts` : `serializeDocForExport(doc) → SerializedDoc`. Utilise les projections existantes (`projectDoses`, `projectPumps`, `projectChild`, `projectPlan`, `projectCaregivers`) pour produire un JSON plat déterministe.
- `packages/reports/src/privacy-export/build-readme.ts` : `buildPrivacyReadme({metadata, hashes, locale, generatedAtMs}) → string`. README.txt bilingue FR + EN avec disclaimer + hashes individuels.
- `packages/reports/src/privacy-export/build-archive.ts` : `buildPrivacyArchive(args) → Promise<Uint8Array>`. Pipeline orchestrateur : sérialise → hash → README → ZIP via `fflate.zipSync`.
- `packages/reports/src/privacy-export/types.ts` : interfaces partagées (`RelayExportMetadata`, `BuildArchiveArgs`, `BuildArchiveResult`).
- `apps/api/src/routes/privacy.ts` : `GET /me/privacy/export/metadata` (authz strict par sub JWT, rate-limit 5/h, retourne uniquement les données scope-isolées).
- `apps/api/src/routes/audit.ts` : ajout `POST /audit/privacy-export` (Zod `.strict()`, rate-limit 5/h/device).
- `apps/web/src/app/settings/privacy/page.tsx` : écran Tamagui (bouton « Exporter », état loading, hash de vérif affiché).
- `apps/web/src/lib/privacy/export-client.ts` : fetch metadata + post audit.
- `apps/mobile/app/settings/privacy.tsx` : écran symétrique mobile.
- `apps/mobile/src/lib/privacy/export-client.ts` : pendant mobile.
- `packages/i18n/src/locales/{fr,en}/common.json` : sous-arbre `privacyExport.*` (~25 clés).
- Tests Vitest exhaustifs sur le package + tests Fastify sur la route metadata + tests Jest snippets sur les écrans.

**Points à tracer (follow-ups)** :
- **`[v1.1] KIN-XXX` (à ouvrir)** : « Privacy export par e-mail via wormhole ». Mutualise le pattern fragment-as-key avec le rapport médecin (ADR-D15 à rédiger).
- **kz-conformite** : valider le contenu du `README.txt` côté formulation juridique avant publication v1.0 (issue de suivi).
- **Test e2e Maestro / Playwright** sur le parcours complet « Settings → Confidentialité → Export → Téléchargement » (à ajouter en E9-S02-followup ou dans la passe e2e finale du sprint J6).

## Statut futur

ADR **Accepté** pour la v1.0. Revue prévue à l'ouverture de la story v1.1 wormhole — ADR-D15 mutualisera privacy + report sharing dans un seul pattern fragment-as-key.

## Révision prévue

Revue obligatoire si :
1. Un audit conformité externe (RPRP / DPO sous-traitance) identifie un champ manquant dans l'archive (ex. logs d'authentification détaillés). Réponse probable : ajouter le champ au endpoint `/me/privacy/export/metadata` sans changer l'architecture.
2. Un nouveau type d'événement `eventType` est ajouté à `audit_events` qui doit aussi entrer dans la portabilité.
3. Un incident de sécurité dans `fflate` impose un changement de dépendance (fallback : `pako` ou vendoring d'un mini ZIP `STORE`).
