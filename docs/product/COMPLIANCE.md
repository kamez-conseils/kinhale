# Cadre de conformité — Kinhale v1.0

> **Document de cadre réglementaire et conformité**
> Version : 0.1.0 — Date : 2026-04-19
> Licence : AGPL v3
> Description courte : classification des données, cadre réglementaire (Loi 25, PIPEDA, RGPD, COPPA), principes privacy by design, consentement, hébergement, gouvernance et risques conformité pour la v1.0 de Kinhale.

---

## Préambule

Kinhale manipule **les données les plus sensibles qui existent** : des données de santé concernant un **mineur**. Cette combinaison fait basculer le projet dans la catégorie réglementaire la plus contraignante dans toutes les juridictions visées (Québec, Canada fédéral, Union européenne, États-Unis). Le statut **non dispositif médical** (journal + rappel + partage, sans recommandation thérapeutique) reste la ligne rouge structurante : toute dérive replace le produit dans un régime de certification CE / Santé Canada incompatible avec le délai v1.0.

Le présent cadre hiérarchise les exigences **bloquantes pour le lancement v1.0** (ne peut pas sortir sans) des exigences v1.1 / v2.0 (améliorations post-lancement acceptables).

---

## 1. Classification des données

### 1.1. Types de données collectées en v1.0

| Catégorie | Données | Classification RGPD / Loi 25 |
|---|---|---|
| **Identité enfant** | Prénom, âge ou année de naissance, éventuel surnom | Donnée identifiante **+ mineur** |
| **Santé enfant** | Nom de la pompe de fond, posologie prescrite, nom de la pompe de secours, horodatages de prises, symptômes (toux, sifflement, essoufflement…), circonstances (effort, allergène, infection, nuit), commentaires libres | **Données de santé sensibles (art. 9 RGPD / renseignement de santé Loi 25)** |
| **Identité aidants** | E-mail, prénom, rôle (Admin / Contributeur / Contributeur restreint), appareil, consentement horodaté | Donnée identifiante |
| **Métadonnées techniques** | Identifiant foyer, identifiants appareil (token push APNs/FCM), logs d'audit (connexions, exports, invitations), crash reports | Donnée technique + pseudonyme |
| **Données dérivées** | Compteur de doses, niveau estimé de la pompe, statuts « dose manquée », historique agrégé | Donnée de santé (dérivée) |

**Hors-périmètre explicite (jamais collecté v1)** : géolocalisation par défaut, biométrie, données bancaires, photos/vidéos, messagerie avec professionnel, ordonnances scannées.

### 1.2. Cartographie data-flow

```
[Saisie par aidant sur device]
   ├─ Stockage local chiffré (Keychain iOS / Android Keystore / IndexedDB chiffré web)
   └─ File d'attente de sync (si hors-ligne)
        ↓ TLS 1.3, charge utile E2EE (relais ne voit que des blobs chiffrés)
[Backend Canada — ca-central-1]
   ├─ Base de métadonnées chiffrée au repos (AES-256) — AUCUNE donnée santé
   ├─ Stockage blobs chiffrés (S3, lifecycle 90 j)
   ├─ Audit log (qui a lu/écrit/exporté quoi, horodaté, pseudonymisé)
   ├─ Backups chiffrés (rétention définie §5)
   └─ Diffusion temps réel aux autres aidants du foyer (WebSocket) — blobs opaques
        ↓ push token
[APNs / FCM] — notification minimale, aucun contenu santé dans le payload
        ↓ optionnel
[Export PDF / CSV généré côté client → téléchargé par l'aidant → remis au médecin en local]
        ↓
[Suppression en self-service] → purge complète sous 30 jours
```

**Principe clé** : aucune donnée de santé ne transite en clair par un service tiers. Les serveurs de Kinhale eux-mêmes ne voient **jamais** les données santé en clair (architecture E2EE zero-knowledge — voir `../architecture/ARCHITECTURE.md`). APNs/FCM reçoivent uniquement un identifiant opaque + un titre générique type « Rappel ».

### 1.3. Flux transfrontières

- **Par défaut** : données résidentes au Canada (ca-central-1) sous forme de métadonnées chiffrées et de blobs chiffrés opaques.
- **Exception structurelle** : APNs (Apple, US) et FCM (Google, US) pour les notifications push — **aucun contenu santé** dans le payload, uniquement un identifiant opaque et un titre générique.
- **Exception à venir** : Postmark / SES ou équivalent pour les e-mails transactionnels (magic link, rapports envoyés) — fournisseur à choisir parmi ceux offrant une région de traitement Canada ou UE + DPA signé.

---

## 2. Cadre réglementaire applicable

### 2.1. Loi 25 (Québec) — **applicable par défaut** (hébergement Canada + fondateur québécois)

**Exigences structurantes v1.0 (bloquantes)** :

- **Responsable de la protection des renseignements personnels (RPRP)** : nomination obligatoire. Nom et coordonnées publiés dans la politique de confidentialité et sur une page `/privacy-officer`.
- **Évaluation des facteurs relatifs à la vie privée (ÉFVP)** : document formel obligatoire avant mise en production (équivalent DPIA RGPD). Livrable concret : un fichier `EFVP-v1.0.md` versionné, revu annuellement.
- **Registre des incidents de confidentialité** : tenir un journal horodaté de tout incident, même sans notification. Template à livrer.
- **Droits renforcés** : accès, rectification, effacement, **portabilité** (exports CSV + PDF déjà prévus dans le PRD — conforme), retrait du consentement.
- **Consentement explicite et granulaire** : cases non pré-cochées, distinction données obligatoires (identité enfant, prises) vs optionnelles (e-mail pour rapports, crash reports anonymisés).
- **Notification à la Commission d'accès à l'information (CAI)** en cas d'incident présentant un **risque de préjudice sérieux** : délai « dans les meilleurs délais », notification à la personne concernée également.
- **Minimisation** : ne collecter que le strict nécessaire. **Action technique** : la date de naissance complète n'est pas nécessaire, l'année suffit pour la posologie.

### 2.2. PIPEDA (Canada fédéral)

- Consentement éclairé (couvert par 2.1).
- Accès, correction, retrait (couvert par 2.1).
- Notification d'atteinte au **Commissariat à la protection de la vie privée du Canada** si risque réel de préjudice grave, et aux personnes concernées.
- Responsabilité de bout en bout y compris pour les sous-traitants (AWS, Postmark, APNs, FCM) → **DPA (Data Processing Agreement) signés avec chacun**.

### 2.3. RGPD (UE) — **applicable dès qu'un utilisateur européen utilise l'app**

Le code étant open source et l'instance officielle accessible mondialement, un utilisateur français peut s'inscrire dès J1. Le RGPD s'applique alors à l'instance officielle Kinhale.

- **Base légale** : **art. 6.1.a (consentement)** combiné à **art. 9.2.a (consentement explicite pour données de santé)**. Pas de base légale « intérêt légitime » possible sur données de santé d'un mineur.
- **Consentement parental (art. 8)** : vérifier que le consentant est bien le titulaire de l'autorité parentale. **Action technique** : case dédiée « Je déclare être le parent ou le titulaire de l'autorité parentale de [prénom enfant] », horodatée, version CGU/PC capturée.
- **DPIA / AIPD obligatoire** : données de santé + mineur + traitement à grande échelle potentiel → seuil de risque élevé atteint (art. 35 RGPD). **Livrable bloquant v1.0**.
- **Droits** : accès, rectification, effacement, **portabilité (art. 20)**, opposition (art. 21), limitation (art. 18). Délai de réponse **≤ 1 mois** (extensible 2 mois si complexité).
- **DPO (Délégué à la Protection des Données)** : **non strictement obligatoire** (l'opérateur n'est pas une autorité publique et le traitement ne rentre pas formellement dans les seuils art. 37), mais **fortement recommandé** vu la sensibilité. Option possible : **DPO externe mutualisé** à temps partiel.
- **Transferts hors UE** : les utilisateurs UE verront leurs données hébergées au Canada. Le Canada bénéficie d'une **décision d'adéquation partielle** de la Commission européenne (pour le secteur privé couvert par PIPEDA). Cette adéquation couvre l'instance officielle **à condition que PIPEDA soit respectée** — ce qui est le cas. **Action v1.0** : documenter explicitement dans la politique de confidentialité que l'hébergement est au Canada sous décision d'adéquation. **Pour APNs/FCM/Postmark (US)** : ajouter des **clauses contractuelles types (SCC) + mesures supplémentaires** (aucun contenu santé dans les payloads, chiffrement bout-en-bout des e-mails sensibles).
- **Registre des activités de traitement (art. 30)** : obligatoire. Livrable concret : un fichier `RAT-v1.0.md` versionné.
- **Notification d'incident** : **72h** à l'autorité de contrôle compétente (CNIL pour la France) en cas de risque pour les personnes concernées.

### 2.4. COPPA (US) — applicable si utilisateurs US <13 ans

Dès lors que l'instance officielle est accessible depuis les US et que le produit cible explicitement les enfants, COPPA peut s'appliquer.

- **Consentement parental vérifiable renforcé** : pas uniquement une case à cocher, mais une méthode vérifiable (credit card auth, signature numérique, e-mail double opt-in avec lettre d'information). **Action v1.0** : double opt-in par e-mail suffit pour une interprétation conservatrice.
- **Collecte minimale** : COPPA est encore plus strict que le RGPD sur le principe de minimisation pour les moins de 13 ans. Le périmètre actuel est compatible.
- **Politique de confidentialité dédiée** : section spécifique « Children's Privacy » obligatoire, divulgation claire des données collectées et des destinataires.
- **Safe Harbor** : adhérer à un programme COPPA Safe Harbor (ex : kidSAFE, iKeepSafe) n'est pas obligatoire mais renforce la crédibilité si traction US.

**Recommandation v1.0** : traiter COPPA comme **v1.1 bloquant pour le marché US**. En v1.0, afficher un disclaimer d'inscription pour les utilisateurs US (« Ce service s'adresse aux familles résidant au Canada et dans l'UE ; l'inscription depuis les US n'est pas encore formellement supportée »).

### 2.5. HIPAA (US)

**Hors champ v1.0**. L'opérateur n'est ni un *Covered Entity* ni un *Business Associate* au sens HIPAA (pas de relation contractuelle avec un assureur santé, hôpital, ou professionnel de santé américain). À rouvrir en **v2.0** si partenariat clinique US (portail pro B2B).

---

## 3. Principes transverses — Privacy by Design & by Default

| Principe | Action technique v1.0 | Criticité |
|---|---|---|
| Minimisation | Année de naissance (pas DDN complète), symptômes via grille pré-définie (pas de texte libre obligatoire), e-mail uniquement pour magic link + rapports | **Bloquant** |
| Chiffrement au repos | AES-256 sur disques DB + backups + logs + stockage local device | **Bloquant** |
| Chiffrement en transit | TLS 1.3 partout, HSTS, pinning optionnel sur mobile | **Bloquant** |
| E2EE zero-knowledge | Données santé chiffrées de bout en bout entre devices ; relais ne voit jamais le contenu en clair | **Bloquant** |
| Pseudonymisation | Identifiant enfant = UUID opaque en base, prénom jamais en base relais, jamais dans les logs techniques | **Bloquant** |
| Séparation logique par foyer | Multi-tenant strict : chaque requête backend filtre par `household_id` du token ; tests automatisés anti-IDOR | **Bloquant** |
| Rétention limitée | **5 ans post-dernière activité** du foyer pour l'historique médical, puis purge automatique. Alternative : l'utilisateur peut demander une purge anticipée à tout moment. | **Bloquant** |
| Suppression de compte | Bouton « Supprimer mon foyer » en self-service, purge complète sous **30 jours max** (délai technique pour purge des backups rotatifs) | **Bloquant** |
| Audit trail | Log horodaté de tout accès/export/modification sur données sensibles, rétention 1 an, accès réservé RPRP | **Bloquant** |
| Pseudonymisation dans les notifications push | Payload APNs/FCM = `{title: "Kinhale", body: "Nouvelle activité"}`, aucun contenu santé | **Bloquant** |

---

## 4. Consentement

### 4.1. Qui consent

- **Parent titulaire de l'autorité parentale** — déclaration explicite à la création du foyer.
- **Aidant secondaire invité** (co-parent, grand-parent, garderie) : consent pour **ses propres données** (e-mail, rôle, horodatages de ses saisies) lors de l'acceptation de l'invitation. **Ne consent pas** pour l'enfant — mandat implicite du parent référent dans le cadre de l'administration des soins, sans partage de données hors périmètre du foyer.

### 4.2. Comment

- **Écran dédié à la création du foyer**, pas un simple « J'accepte les CGU ».
- **Cases non pré-cochées** — séparation claire entre :
  - **Obligatoire** : traitement des données de santé de l'enfant pour l'usage de l'app (art. 9.2.a RGPD).
  - **Optionnel** : crash reports anonymisés pour améliorer le service, envoi d'un e-mail de rappel en cas de dose manquée, inscription à une future newsletter produit.
- **Granularité** : chaque finalité a sa propre case.

### 4.3. Preuve et traçabilité

- Horodatage du consentement (ISO 8601, UTC).
- Version des CGU et de la politique de confidentialité (hash SHA-256) acceptée, stockée en base.
- IP + user-agent conservés pour la preuve (24 mois max).
- **Action technique** : table `consent_log` en base, jamais purgée même en cas de suppression du foyer (conservée en pseudonyme pour preuve légale).

### 4.4. Retrait du consentement

- Possible à tout moment depuis les paramètres du foyer.
- Retrait = suppression effective sous 30 jours (sauf obligations légales de conservation, aucune connue en v1).
- Les aidants secondaires peuvent quitter le foyer, leurs saisies passées restent attribuées (pseudonymisées si compte supprimé).

---

## 5. Hébergement & infrastructure

### 5.1. Région principale

- **Canada — ca-central-1 (AWS Montréal)**. Justification : Loi 25 + PIPEDA + proximité du fondateur + décision d'adéquation UE applicable.
- **Souveraineté des données** : aucune réplication automatique hors Canada en v1.0.

### 5.2. Multi-région (v2+)

- Déploiement UE (eu-west-1 ou eu-central-1) si traction européenne > 1 000 foyers — évite les débats sur l'adéquation, améliore la latence.
- Pas de déploiement US en v1 / v1.1 tant que COPPA n'est pas traité formellement.

### 5.3. Chiffrement

- **Disques** : chiffrement natif EBS avec clés gérées par KMS.
- **Base de données** : chiffrement au repos (AES-256) + TLS en transit. **À noter** : dans le modèle E2EE zero-knowledge retenu, la base ne contient **pas** de données santé en clair (voir `../architecture/ARCHITECTURE.md`).
- **Backups** : chiffrés, rétention **30 jours** pour snapshots journaliers + **1 an** pour snapshots mensuels. Test de restauration **trimestriel**.
- **Logs** : chiffrés, anonymisés côté application (aucun prénom enfant, aucun symptôme en clair dans les logs).

### 5.4. Gestion des clés (KMS)

- Rotation annuelle des clés de chiffrement applicatif.
- Séparation des rôles : aucun développeur n'a accès simultané aux clés et aux données.
- Clés root dans un HSM managé (AWS KMS avec CMK).
- **Clés santé (E2EE)** : détenues exclusivement par les devices des aidants du foyer. Le relais ne possède **aucune clé** permettant de déchiffrer les données santé.

### 5.5. Journalisation

| Type de log | Quoi | Rétention | Accès |
|---|---|---|---|
| Audit sécurité | Connexions, échecs d'auth, exports, invitations, suppressions | 12 mois | RPRP + équipe sécurité |
| Technique | Erreurs, latences, santé infra (sans PII) | 90 jours | Équipe dev |
| Accès données sensibles | Toute lecture/écriture sur mailbox de foyer (métadonnées uniquement, jamais le contenu chiffré déchiffré) | 12 mois | RPRP |
| Consentement | Horodatage + version CGU acceptée | Indéfini (preuve) | RPRP |

---

## 6. Cas spécial open source

- **Code public** → **aucun secret hardcodé**. Secrets via variables d'environnement + gestionnaire (AWS Secrets Manager, ou équivalent). Hook pré-commit + scan CI (gitleaks).
- **Audit continu des dépendances** : SCA (Software Composition Analysis) obligatoire en CI (Dependabot + Snyk ou équivalent).
- **Licence retenue** : **AGPL v3** — protège contre le fork commercial propriétaire (tout hébergeur d'une version modifiée doit publier son code). Cohérente avec l'esprit « outil de santé public, non capturé par un éditeur commercial ».
- **Documentation de self-hosting** : clause explicite dans le README et les CGU de l'instance officielle : *« Kamez héberge l'instance officielle de Kinhale. Toute instance tierce auto-hébergée est sous la responsabilité exclusive de son opérateur. Kamez ne peut être tenu responsable d'une mauvaise configuration de sécurité ou d'un non-respect des obligations réglementaires par un opérateur tiers. »*
- **Instance officielle = Responsable du traitement (controller)**. Clairement affiché dans la politique de confidentialité et l'onboarding.

---

## 7. Politique de confidentialité & CGU — plan de rédaction

Livrables v1.0 bloquants : **politique de confidentialité**, **CGU**, **mentions légales**, **section COPPA-ready** (activable v1.1).

Sections minimales obligatoires :

1. **Identité du responsable de traitement** — raison sociale, adresse, e-mail RPRP.
2. **Finalités du traitement** — suivi santé enfant, coordination aidants, rappels, génération de rapports, amélioration du service (opt-in).
3. **Données collectées** — liste exhaustive (cf. §1.1).
4. **Base légale** — art. 6.1.a + art. 9.2.a RGPD / consentement explicite Loi 25.
5. **Destinataires** — aucun tiers en v1 ; sous-traitants techniques (AWS, Postmark, APNs/FCM) listés nommément.
6. **Durée de conservation** — 5 ans post-dernière activité, 30 jours max après suppression.
7. **Droits utilisateurs** — accès, rectification, effacement, portabilité, opposition, limitation ; modalités d'exercice (e-mail RPRP + bouton in-app).
8. **Mesures de sécurité** — chiffrement, pseudonymisation, E2EE, audit (synthèse).
9. **Transferts internationaux** — Canada (décision d'adéquation UE) + exceptions push/e-mail avec SCC.
10. **Modifications de la politique** — notification in-app + e-mail, nouveau consentement requis si changement substantiel.
11. **Contact RPRP / DPO** — e-mail dédié, délai de réponse 30 jours.
12. **Section enfants / COPPA** (v1.1 si ouverture US).

**Recommandation forte** : faire réviser la rédaction par un **juriste externe spécialisé protection des données santé**.

---

## 8. Mesures de sécurité exigibles

Alignement avec **OWASP MASVS** (mobile), **OWASP ASVS** niveau 2 (web/backend).

**Bloquantes v1.0** :
- Authentification par magic link (pas de mot de passe réutilisable), **MFA optionnelle** (TOTP), **passkeys** recommandés dès que la plateforme le permet.
- Sessions : tokens JWT courts (15 min) + refresh token révocable, rotation obligatoire, révocation centralisée (logout = invalidation backend).
- Protection **OWASP Top 10** backend + **MASVS** mobile.
- Stockage sécurisé sur device : Keychain iOS, Android Keystore, IndexedDB + Web Crypto API sur web.
- Détection jailbreak/root **non bloquante** (avertissement utilisateur, log d'audit) — bloquer rend l'app inutilisable sur des téléphones parents non-techniques.
- **CI/CD** : SAST (Semgrep / CodeQL), SCA (Snyk / Dependabot), DAST (OWASP ZAP en recette) — bloqueurs de merge sur criticité haute.
- **Plan de réponse aux incidents** documenté (runbook : détection → confinement → notification RPRP → notification autorités <72h → notification utilisateurs → post-mortem).
- **Pen-test externe avant lancement public** — recommandé.
- **Audit crypto externe** du design MLS / Double Ratchet et de son implémentation.

**Reportables v1.1 / v2.0** :
- Certification ISO 27001 (v2+).
- Bug bounty public (v2+).
- Attestation SOC 2 (uniquement si demande B2B cliniques).

---

## 9. Gouvernance & processus

Livrables concrets à produire **avant lancement v1.0** :

| Livrable | Format | Responsable | Bloquant v1 ? |
|---|---|---|---|
| **Registre des activités de traitement (RAT)** | `.md` versionné dans le dépôt privé | RPRP | **Oui** |
| **Registre des incidents** | Tableau + procédure d'alimentation | RPRP | Oui (vide au démarrage, structure prête) |
| **ÉFVP / DPIA** | `.md` versionné, signé par le RPRP | RPRP + juriste externe | **Oui** |
| **Nomination RPRP** | Lettre officielle, publication in-app | Opérateur | **Oui** |
| **Procédure demande d'exercice des droits** | SLA utilisateur ≤ 30 jours, formulaire dédié | RPRP | **Oui** |
| **DPA sous-traitants** | AWS, Postmark, APNs (Apple), FCM (Google) | Opérateur | **Oui** |
| **Plan de réponse aux incidents** | Runbook `.md` | RPRP + lead dev | **Oui** |
| **Audit annuel conformité** | Revue à date anniversaire | RPRP | v1.1 |

---

## 10. Impact sur les délais v1.0

Les tâches de conformité sont intégrées à la roadmap technique (voir `../architecture/ARCHITECTURE.md` §10). Points saillants :

- Rédaction DPIA / ÉFVP (avec juriste externe).
- Rédaction Politique de confidentialité + CGU + Mentions légales (revue juriste recommandée).
- Mise en place registre traitement + registre incidents.
- Mise en place procédure d'exercice des droits (front + backend + RPRP flow).
- Signature DPA avec sous-traitants.
- Plan de réponse aux incidents (runbook).
- Pen-test externe avant lancement.
- DPO externe mutualisé (recommandé).

*Section interne détaillée sur budgets et chiffrages retirée de la version publique.*

---

## 11. Risques conformité résiduels & mitigations

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| RC1 | **Non-conformité Loi 25** détectée par la CAI (plainte utilisateur) | Faible | Élevé (amende + réputation) | ÉFVP formelle, RPRP nommé, registre à jour, audit annuel |
| RC2 | **Incident de sécurité** (fuite de données santé enfant) | Faible | **Critique** (amende RGPD jusqu'à 4 % CA, réputation détruite) | E2EE zero-knowledge + chiffrement applicatif + KMS + pen-test + runbook incident + DPA sous-traitants |
| RC3 | **Transfert transfrontière non couvert** (ex. vers APNs/FCM US sans SCC) | Moyenne | Moyen | SCC signées, pseudonymisation des payloads push (déjà prévue) |
| RC4 | **Demande d'effacement non traitée dans les délais** (30 j Loi 25, 1 mois RGPD) | Faible | Moyen | Procédure automatisée en self-service + ticket de backup RPRP |
| RC5 | **Fork tiers non conforme** utilisant le code Kinhale pour traiter des données santé sans cadre | Moyenne | Faible (pour l'opérateur d'origine) à Élevé (pour utilisateurs finaux du fork) | Clause explicite de non-responsabilité + licence AGPL v3 forçant l'ouverture des forks |
| RC6 | **Dérive produit vers statut DM** (ajout d'une reco de dose, d'une alerte santé auto-générée) | Moyenne | Bloquant (+12 mois de certification) | Ligne rouge inscrite dans le PRD, revue conformité à chaque évolution fonctionnelle |
| RC7 | **Utilisateur US <13 ans** s'inscrit sans consentement parental COPPA-vérifiable | Moyenne | Élevé (amende FTC) | v1.0 : disclaimer d'exclusion US + vérification pays via IP/locale. v1.1 : flow COPPA dédié |
| RC8 | **Sous-traitant change sa politique** (ex : AWS ouvre le trafic hors Canada) | Faible | Élevé | Revue annuelle DPA, monitoring des régions, clauses contractuelles de changement |
| RC9 | **Expiration du consentement parental** (enfant devient majeur 13/16/18 ans selon juridiction) | Faible v1 | Moyen | v2.0 : flow de transition de consentement à l'adolescent |

---

## 12. Recommandation finale

### 12.1. Stratégie de lancement

- **Aller au lancement v1.0 avec** : cadre **Loi 25 + PIPEDA + RGPD ready**. Instance officielle au Canada, politique de confidentialité exemplaire, ÉFVP signée, RPRP nommé.
- **COPPA prêt en v1.1** si utilisateurs US détectés (>5 % de la base). V1.0 : afficher un disclaimer d'exclusion US à l'inscription, avec vérification pays (IP + locale navigateur).
- **HIPAA** : hors périmètre jusqu'à un éventuel partenariat clinique US en v2.0.

### 12.2. Décisions structurantes

1. **Licence** : **AGPL v3** retenue.
2. **RPRP** : nommé par l'opérateur de l'instance officielle.
3. **Juriste externe** : revue de la politique de confidentialité + CGU — **recommandée et non négociable** pour des données de santé d'un mineur.
4. **COPPA v1.0** : afficher un disclaimer d'exclusion US.
5. **Pen-test v1.0** : recommandé avant d'atteindre 1 000 foyers actifs.

### 12.3. Ligne rouge produit (rappel)

- **Instance officielle = Responsable du traitement**, clairement affiché.
- **Disclaimer permanent** : *« Kinhale est un outil de suivi et de coordination. Il ne remplace pas un avis médical, ne diagnostique pas et ne recommande aucun traitement. En cas de doute, consultez un professionnel de santé. »* — visible à l'onboarding, en pied de l'écran d'accueil, sur chaque rapport PDF exporté, dans les CGU.
- **Ne jamais ajouter** : recommandation de dose, alerte santé auto-générée, diagnostic, messagerie avec professionnel de santé sans nouveau passage par une revue conformité ET évaluation du statut DM.

---

*Fin du cadre de conformité Kinhale v1.0 — document publié sous AGPL v3.*
