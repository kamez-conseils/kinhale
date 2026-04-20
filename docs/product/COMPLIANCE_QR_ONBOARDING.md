# Avis de conformité — Onboarding assisté par QR code (Parcours B)

> Rédigé par **kz-conformite** le 2026-04-19 — Client : Martial (martial@wonupshop.com)
> Amont : `00-kz-conformite.md` (cadre initial), `00-kz-ux-research.md` §Décisions UX validées §4, `00-kz-branding.md`, `00-kz-architecture.md`, `00-kz-product.md`, `01-pivot-architectural.md`
> Aval : **kz-designer** (lock des maquettes parcours B), **kz-copywriting** (microcopie consentement FR/EN), kz-specs (règles RM consentement), kz-architecture (format ticket + journal d'audit), consultant / juriste externe

---

## 0. Résumé exécutif

**Verdict global : OUI avec ajustements.**

Le parcours B d'onboarding assisté par QR code est **conforme dans son principe** à la Loi 25 (Québec), au RGPD (Union européenne) et aux engagements de Kinhale posés dans `00-kz-conformite.md`. Il est même, sur plusieurs points (minimisation du ticket, consentement au moment du scan, zero-knowledge préservé), **supérieur à un flux d'invitation classique par lien e-mail** côté conformité.

Six ajustements sont néanmoins **bloquants v1.0** pour pouvoir lock les maquettes :

1. **Écran de consentement explicite non contournable** au moment du scan, **avant** l'ajout au groupe MLS (cf. §5).
2. **Journal de consentement local, E2EE, horodaté et signé** par la clé Ed25519 de l'aidant invité (cf. §5.3 et §6.4).
3. **Ticket d'invitation sans donnée santé** — pas de prénom enfant dans le QR, uniquement dans l'écran de consentement après déchiffrement local (cf. §6.1).
4. **TTL du ticket** : réduction à **10 minutes** par défaut (au lieu de 15), avec prolongation manuelle possible par le parent référent sur demande explicite (cf. §6.2).
5. **Révocation in-app** d'un ticket non consommé, côté parent référent (cf. §6.3).
6. **Droit de retrait effectif** : bouton *« Je quitte ce cercle »* dans les paramètres de l'aidant, sans intervention du parent référent, avec effacement local garanti (cf. §4.3).

Deux cas nécessitent un **avis juridique externe** avant ouverture commerciale :

- Le **cas CPE / garderie** : le consentement individuel de l'éducatrice suffit-il, ou faut-il un contrat-cadre avec l'employeur ? (cf. §4.1)
- La **qualification du parent référent** : *responsable de traitement conjoint*, *mandataire*, ou *utilisateur privé hors champ RGPD* ? (cf. §3.2)

Aucun de ces deux points ne bloque la v1.0 si les disclaimers proposés en §4.1 et §3.2 sont intégrés dans les CGU et la politique de confidentialité.

---

## 1. Rappel du flux à valider

Pour mémoire (source : `00-kz-ux-research.md` §Décisions UX validées §4, confirmé par le fondateur le 2026-04-19) :

1. Le parent référent (ex : Élodie) ouvre l'app, menu **« Inviter un aidant »**.
2. L'app génère un **ticket d'invitation** local contenant :
   - un **identifiant éphémère opaque** (UUID v4 aléatoire, non prédictible),
   - une **clé publique éphémère de négociation MLS** (`KeyPackage` au sens RFC 9420, ou clé publique X25519 en fallback Double Ratchet),
   - une **durée de validité** (proposée 15 min → **révisée à 10 min**, cf. §6.2),
   - une **signature Ed25519** du parent référent prouvant l'authenticité du ticket.
3. Ticket affiché sous **QR code + code court 6 caractères** (fallback saisie manuelle pour cas low-vision ou caméra indisponible).
4. L'aidant secondaire (ex : Lise) installe Kinhale et choisit **« Rejoindre un cercle »**.
5. Lise scanne le QR (ou saisit le code court). **Rien ne passe par le relais Kamez à ce stade** — échange visuel local, au même emplacement physique ou via écran partagé.
6. L'app de Lise génère localement sa paire **Ed25519 + X25519**. Les clés privées ne sortent **jamais** du device.
7. **Écran de consentement explicite** : prénom de l'enfant, identité du parent référent, portée du partage, promesse zero-knowledge, acceptation obligatoire par bouton dédié.
8. Après consentement, l'app de Lise rejoint le groupe MLS, reçoit les clés de session, synchronise les deltas du cercle.
9. Le relais Kamez ne voit passer que des **blobs chiffrés opaques** — jamais le contenu santé.

**Cohérence avec l'architecture** : ce flux est directement compatible avec la décision D3 du `00-kz-architecture.md` (MLS via `openmls` avec fallback Double Ratchet) et avec la séquence Sprint 2 (`invitation aidant QR+PIN + échange MLS`).

---

## 2. Analyse Loi 25 (Québec)

### 2.1. Articles pertinents

| Article | Exigence | Parcours B — conformité |
|---|---|---|
| **Art. 8 LPRPSP** (secteur privé) | Transparence sur l'identité du responsable, les finalités, les catégories de destinataires, les droits. | **OUI** si l'écran de consentement de §5 est implémenté tel que spécifié. |
| **Art. 14** | Consentement **manifeste, libre, éclairé et donné à des fins spécifiques**. Durée limitée, granulaire, non pré-coché, retirable. | **OUI** par construction : le scan est un geste positif + un écran dédié + un bouton dédié. **Blocage si** case pré-cochée ou bouton ambigu. |
| **Art. 14 al. 2** | Consentement **à chaque fin** : un consentement global pour tout l'écosystème est interdit. | **OUI** : la finalité unique du flux est *« rejoindre le cercle de soin de [prénom enfant] »*. Pas de bundling avec newsletter, stats, analytics. |
| **Art. 27** | Droit de retrait du consentement **en tout temps, sans conséquence indue**. | **OUI** si le bouton *« Je quitte ce cercle »* §4.3 est présent et effectif. |
| **Art. 9** | **Minimisation**. | **OUI** : le QR contient le strict nécessaire au rendez-vous cryptographique. Pas de donnée santé. Pas de prénom enfant dans le ticket. |
| **Art. 28** | **Cessation d'utilisation** : à la demande, l'organisme doit cesser d'utiliser un renseignement personnel s'il n'est plus nécessaire aux fins pour lesquelles il a été recueilli. | **OUI** : quand Lise quitte le cercle, ses copies locales sont effacées + signal MLS `Remove` déclenche la rotation de clé de groupe. |
| **Art. 63.5** | **Évaluation des facteurs relatifs à la vie privée (ÉFVP)** obligatoire avant tout nouveau produit impliquant des renseignements personnels. | **OUI** : l'ÉFVP v1.0 déjà prévue dans `00-kz-conformite.md` §9 doit intégrer **un chapitre dédié au parcours B**. Livrable bloquant. |
| **Art. 4** | Renseignement **de santé** = catégorie particulièrement sensible. Consentement explicite renforcé. | **OUI** : le consentement se fait au moment exact où la donnée devient lisible par l'aidant, par un bouton dédié, pas par une case générale. |

### 2.2. Consentement explicite de l'aidant secondaire

**Statut : CONFORME sous réserve des exigences UX §5.**

Points positifs structurels :

- Le **geste physique du scan** est en soi un acte positif sans ambiguïté (non comparable à une case pré-cochée sur un site web).
- Le **délai entre le scan et l'intégration au groupe** (affichage de l'écran de consentement + tap sur *« J'accepte »*) crée la **pause éclairée** exigée par l'art. 14.
- L'écran de consentement est le **seul point** où Lise voit pour la première fois le prénom de l'enfant — avant elle ne l'a jamais vu (le QR est opaque). C'est exactement le principe *« information préalable à la révélation des données »*.

Exigences bloquantes (cf. §5) :

- **Aucun écran intermédiaire** entre le scan et l'écran de consentement, afin que Lise ne soit pas déjà exposée à la donnée santé **avant** d'avoir consenti à la recevoir.
- **Pas d'auto-acceptation** après un délai (même 30 s). Le consentement doit être un geste manuel explicite.
- **Pas de skip** du consentement via un *« Plus tard »* — le parcours s'interrompt à cet écran si Lise n'accepte pas.

### 2.3. Information préalable claire

L'écran de consentement doit présenter **avant acceptation** (§5.1 pour le texte exact) :

- **Qui invite** : prénom + nom court de l'aidant référent (ex : *« Élodie Dupont vous invite »*).
- **Qui est l'enfant** : prénom seul (ex : *« Léa »*). Pas de nom de famille, pas de date de naissance, pas de photo.
- **Quelles données seront partagées** : liste positive finie — journal des prises (pompe de fond + secours), nom des pompes, horodatages, symptômes éventuels, rappels. Explicitement : **pas de géolocalisation, pas de messagerie, pas de données bancaires, pas de photos**.
- **Quelle est la base légale** : *« Vous consentez explicitement à recevoir ces renseignements de santé dans le cadre de la coordination des soins de Léa. »*
- **Promesse zero-knowledge** : *« Même Kinhale et Kamez Conseils ne peuvent pas lire ces données. »*
- **Droits** : accès, rectification, retrait, avec lien direct vers les paramètres.
- **Durée de conservation** : 5 ans post-dernière activité du cercle (aligné avec `00-kz-conformite.md` §5.1 et §3).
- **Identité du responsable** : cf. §3.2 ci-dessous (Kamez + parent référent).

### 2.4. Droit de retrait effectif

Exigence art. 27 et 28 Loi 25 :

- **Bouton self-service** *« Je quitte ce cercle »* accessible en 2 taps depuis les paramètres du profil de Lise.
- **Confirmation explicite** pour éviter un retrait accidentel.
- **Action technique** : signal MLS `Remove` envoyé au groupe, **rotation immédiate de la clé de groupe** côté autres membres, **effacement local** de la copie du document Automerge, des clés de session, de la mailbox locale, des exports PDF éventuellement cachés sur le device.
- **Conservation de la trace pseudonymisée** : `consent_log` local garde l'événement *« Lise a rejoint le 2026-04-19 », « Lise a quitté le 2026-05-30 »* pour audit utilisateur, sans conservation de contenu santé.
- **Aucune action requise du parent référent** : Lise peut quitter seule. Le parent référent est **notifié** de la sortie (*« Lise a quitté le cercle »*) mais ne peut pas la bloquer.

### 2.5. Minimisation du ticket

Le QR code contient strictement :

| Champ | Nature | Donnée personnelle au sens Loi 25 ? |
|---|---|---|
| UUID opaque du ticket | Aléatoire, non prédictible, lien à la session MLS uniquement | Non |
| Clé publique éphémère | Matériel cryptographique | Non |
| TTL / expiration | Horodatage | Non |
| Signature du ticket | Ed25519 du parent référent | Non (la clé publique du parent est connue du relais de toute façon) |
| **Absent** : prénom enfant, prénom parent, e-mail, rôle | — | Minimisation conforme art. 9 |

**Conséquence importante** : même si un tiers intercepte physiquement le QR (photo prise à distance, écran filmé), il n'apprend **rien sur l'enfant ou la famille**. Il peut au pire tenter de rejoindre le cercle à la place de Lise — tentative bloquée par l'écran de consentement qui nomme explicitement l'aidant attendu (cf. §6.1 sur le binding optionnel).

### 2.6. Transparence du responsable

Cf. §3.2. Résumé Loi 25 :

- **Responsable du traitement pour les métadonnées techniques** (mailboxes, comptes, logs d'audit pseudonymisés, ticket d'invitation opaque) : **Kamez Conseils** (instance officielle).
- **Responsable pour le contenu santé** : **personne au sens légal strict** — le contenu n'est lisible par aucune entité juridique de traitement au sens Loi 25, seulement par les devices des aidants qui ont consenti.
- **Le parent référent** agit en **responsable de fait** du partage, mais dans le cadre d'un usage **purement domestique** (cf. §3.2 RGPD art. 2.2.c analogue).

Ces trois niveaux doivent être explicitement décrits dans la politique de confidentialité v1.0.

---

## 3. Analyse RGPD (Union européenne)

### 3.1. Articles pertinents

| Article | Exigence | Parcours B — conformité |
|---|---|---|
| **Art. 6.1.a** | Base légale : consentement. | **OUI** (cf. §3.3). |
| **Art. 7** | Preuve du consentement, retrait aussi simple que le consentement. | **OUI** si §5.3 (journal) et §4.3 (bouton retrait) implémentés. |
| **Art. 8** | Consentement parental pour mineur (< 13/16 ans selon État membre, 15 ans en France par défaut). | **OUI** : le parent référent consent pour la création du cercle et la saisie initiale des données de l'enfant. Chaque aidant consent pour **lui-même**. Cf. §3.4. |
| **Art. 9** | Données de santé. Interdiction de traitement sauf exceptions, dont **art. 9.2.a** (consentement explicite). | **OUI** : c'est exactement la base mobilisée. Renforcée pour un mineur. |
| **Art. 12-14** | Information préalable claire, concise, accessible. | **OUI** si l'écran de consentement §5 respecte le formatage exigé. |
| **Art. 17** | Droit à l'effacement. | **OUI** : Lise peut quitter → copies locales effacées, relais n'a que des blobs opaques qu'il purge après TTL. Cf. §4.3. |
| **Art. 20** | Portabilité. | **OUI** : export PDF/CSV déjà prévu dans `00-kz-conformite.md` §1.2. Pas d'impact parcours B. |
| **Art. 25** | Privacy by Design & by Default. | **OUI** : l'architecture E2EE zero-knowledge est un cas d'école de privacy by design. |
| **Art. 35** | DPIA pour traitement à risque élevé. | **OUI** : la DPIA v1.0 déjà prévue doit inclure un chapitre parcours B. |
| **Art. 46** | Transferts transfrontières. | **Analyse §3.5**. |

### 3.2. Qualification juridique du parent référent

**Question** : en invitant Lise dans le cercle de soin de Léa, Élodie agit-elle comme **responsable de traitement** au sens RGPD ?

**Analyse** :

Le RGPD **art. 2.2.c** exclut expressément son application aux traitements effectués *« par une personne physique dans le cadre d'une activité strictement personnelle ou domestique »*. La jurisprudence de la CJUE (notamment *Ryneš*, C-212/13) précise que cette exclusion ne couvre **pas** les traitements qui débordent la sphère privée (caméra filmant l'espace public, publication en ligne).

Le parcours B de Kinhale se situe **précisément dans la sphère domestique** :

- Les destinataires sont **nommément désignés** par Élodie (Marc, Lise, Aïcha).
- Le périmètre est **un foyer** (au sens extensif inclut CPE désignée).
- Aucune diffusion publique.
- Aucune finalité professionnelle côté Élodie.

**Position kz-conformite** : Élodie **n'est pas** responsable de traitement au sens RGPD pour les données santé de Léa qu'elle partage via Kinhale. Elle est titulaire de l'autorité parentale exerçant un choix éducatif et sanitaire privé.

**Mais attention — cas limite CPE / nounou** :

- Si l'aidant invité est un **professionnel agissant pour le compte d'un employeur** (éducatrice CPE, auxiliaire de puériculture, infirmière scolaire), **son traitement à elle** peut tomber dans le champ professionnel (l'employeur devient potentiellement responsable conjoint au sens art. 26).
- **Recommandation §4.1** : ce cas nécessite un **avis juridique externe** avant v1.1 et un disclaimer d'information v1.0.

**Kinhale doit-il fournir un modèle de consentement ?**

- Pour la sphère familiale : **non**, l'écran de consentement du parcours B tient lieu. Kinhale fournit le véhicule, les utilisateurs en usent dans leur sphère privée.
- Pour le cas professionnel : **oui, fortement recommandé v1.1** — Kinhale doit fournir un **modèle de contrat-cadre CPE / nounou professionnelle** téléchargeable, validé par juriste, que le parent référent peut faire signer à l'employeur du professionnel invité. Cf. §4.1.

### 3.3. Base légale retenue

**Art. 6.1.a + art. 9.2.a RGPD : consentement explicite.**

Justifications :

- **Pas d'intérêt vital (art. 9.2.c)** mobilisable : l'app n'est **pas** un dispositif médical et ne gère pas une situation d'urgence vitale. Invoquer l'intérêt vital serait à la fois juridiquement fragile et contradictoire avec la ligne rouge DM.
- **Pas d'obligation légale (art. 6.1.c)** : aucune loi n'oblige un aidant secondaire à rejoindre Kinhale.
- **Pas d'intérêt légitime (art. 6.1.f)** : exclu par défaut pour les données de santé d'un mineur (cf. `00-kz-conformite.md` §2.3).
- **Pas de contrat (art. 6.1.b)** : l'aidant secondaire n'a pas de contrat avec Kamez au sens commercial.

**Conséquence pratique** : la base consentement suppose **la granularité**, le **retrait possible à tout moment**, et la **preuve tenue à jour**. Tous trois couverts par le flux si §5 et §4.3 sont implémentés.

### 3.4. Données de santé d'un mineur

Règle : c'est le **titulaire de l'autorité parentale** qui consent pour l'enfant (art. 8 RGPD + Code civil français art. 371-1 + Code civil du Québec art. 599).

Dans le parcours B :

- **Élodie** (ou tout parent titulaire) a déjà consenti à la création du cercle (parcours J1), en déclarant être titulaire de l'autorité parentale. Cette déclaration est **tracée et horodatée** (cf. `00-kz-conformite.md` §4.3).
- **Élodie invite Lise** : elle exerce son autorité parentale en choisissant un aidant du cercle de soin. Ce choix est de sa seule responsabilité — Kinhale n'a pas à vérifier que Lise est *« digne »* d'être aidante.
- **Lise consent pour elle-même** : pour ses propres données personnelles (prénom, rôle, horodatages de ses saisies) et pour **recevoir** des renseignements de santé de Léa (base art. 9.2.a côté Lise).

**Cas de conflit parental** (divorce, désaccord entre titulaires de l'autorité parentale) :

- **Hors périmètre v1.0 explicite**. À documenter dans les CGU : *« Kinhale ne tranche aucun désaccord entre titulaires de l'autorité parentale. Chaque titulaire reste libre de créer son propre cercle ou de rejoindre un cercle existant sur invitation. En cas de litige, les recours sont devant les juridictions compétentes. »*
- v2.0 : envisager un mécanisme de co-admin avec consentement parental bi-latéral.

### 3.5. Traitement transfrontalier

Cas 1 — **Élodie au Québec invite Lise en France** (ou inverse) :

- Le relais Kamez est en **ca-central-1 (Canada)**. Côté RGPD, le Canada bénéficie d'une **décision d'adéquation partielle** (2002, entreprises privées couvertes par PIPEDA).
- **Problème potentiel** : la décision d'adéquation Canada est en cours de **réévaluation** par la Commission européenne (horizon 2026–2027). Suivi obligatoire par le RPRP (cf. `00-kz-conformite.md` §11 risque RC8 étendu).
- **Mesure v1.0** : documenter explicitement dans la politique de confidentialité et dans les CGU que l'instance officielle est hébergée au Canada sous adéquation. **Clause contractuelle type (SCC)** préparée en backup dans le DPA entre Kamez et les sous-traitants.
- **Pas de nouvelle exigence spécifique au parcours B** : le ticket QR ne transite pas par le relais, et les blobs MLS sont opaques.

Cas 2 — **Aidant dans un pays sans adéquation** (US, Brésil, etc.) :

- Le relais voit une connexion WS depuis une IP hors UE/Canada. Il ne voit aucun contenu santé.
- **Position** : le parent référent reste responsable de fait du choix de cet aidant. Information dans les CGU : *« Vous pouvez inviter des aidants résidant dans d'autres pays. Les données de santé ne transitent jamais par nos serveurs en clair, mais les aidants invités depuis l'étranger peuvent être soumis à des lois locales différentes. Il vous revient d'en tenir compte. »*
- **Recommandation** : afficher un **warning optionnel** au scan si l'app détecte une IP d'aidant très distante de celle du parent référent (signal faible, non bloquant) — v1.1.

---

## 4. Cas particuliers à trancher

### 4.1. Aidant professionnel (nounou indépendante, éducatrice CPE, service de garde en milieu familial)

**Question** : le consentement individuel du professionnel suffit-il, ou faut-il un contrat-cadre avec l'employeur ?

**Analyse**

| Cas | Statut juridique | Consentement suffisant ? |
|---|---|---|
| **Nounou indépendante auto-employée** (emploi direct par la famille, CESU en France, chèque emploi-service au Québec) | Travailleuse indépendante, pas d'employeur tiers | **Oui**, son consentement individuel suffit. Mention à intégrer : « vous acceptez à titre personnel ». |
| **Éducatrice CPE au Québec** | Employée d'un CPE (centre de la petite enfance) réglementé par le MFA | **Non suffisant seul** : le CPE est responsable du traitement des données concernant les enfants qu'il accueille dans le cadre professionnel. Il faut un **contrat-cadre famille / CPE** pour autoriser l'éducatrice à recevoir des données santé hors dossier CPE. |
| **Service de garde en milieu familial (SGMF)** | Travailleur autonome reconnu mais encadré par un bureau coordonnateur | Zone grise. **Recommandation** : contrat-cadre famille/responsable de service. |
| **Auxiliaire de puériculture école (France)** | Agent territorial ou ATSEM | **Non suffisant** : relève de la collectivité employeur. Contrat-cadre requis. |

**Recommandation v1.0** :

- Dans l'écran de choix de rôle (lors de la génération du ticket), ajouter une **question explicite** : *« Cet aidant est-il un professionnel agissant pour un employeur (garderie, CPE, école) ? »*
- **Si oui** : afficher un **disclaimer non bloquant** *« Nous vous recommandons de faire signer un accord écrit à l'employeur avant que ce professionnel ne rejoigne le cercle. Kinhale fournit un modèle téléchargeable. »* + lien vers le modèle.
- **v1.0** : livrer un **modèle de contrat-cadre CPE/garderie** en FR (Québec + France) et EN, validé par juriste externe (budget compris dans les 1 000–2 000 $ CAD du `00-kz-conformite.md` §10).
- **v1.1** : workflow *« Aidant professionnel »* dédié avec case à cocher *« j'ai obtenu l'accord écrit de mon employeur »* côté professionnel invité + conservation de l'accord en pièce jointe chiffrée locale.

**Avis juridique externe requis** avant v1.1 sur la qualification exacte CPE/SGMF/ATSEM et sur le modèle de contrat-cadre.

### 4.2. Mineur de 14+ ans (hors v1.0 mais à anticiper)

**Cadre légal** :

| Juridiction | Seuil de consentement numérique propre | Référence |
|---|---|---|
| **Québec / Canada** | **14 ans** (Loi 25 art. 4.1 al. 2 : consentement du mineur de 14 ans et plus requis pour le traitement de ses renseignements personnels, sauf si manifestement en sa faveur) | Loi 25 + Code civil du Québec art. 14, 17, 21 |
| **France** | **15 ans** (LIL art. 45) | RGPD art. 8 + LIL |
| **UE (minimum)** | **13 ans** (art. 8 RGPD), État peut fixer supérieur jusqu'à 16 ans | RGPD art. 8.1 |
| **US (COPPA)** | **13 ans** | COPPA |

**Implication pour Kinhale v1.0** :

- v1.0 cible enfants 0–10 ans typiquement. **Hors seuil.** Parent consent seul, pas d'obligation de recueillir le consentement de l'enfant.
- **Anticipation v2.0 (obligatoire)** : architecture doit prévoir un **compte enfant distinct** avec consentement propre dès 14 ans (Québec) / 15 ans (France) / 13 ans (minimum UE). Alignement avec `00-kz-ux-research.md` §Insight sur l'évolution ado.
- **Action v1.0 concrète** : aucune modification du parcours B requise. Prévoir dans l'ÉFVP v1.0 **une section « transition adolescence »** qui documente le fait que l'architecture actuelle ne permet pas encore au mineur de consentir lui-même, et que la v2.0 devra traiter ce cas.

### 4.3. Retrait d'un aidant — effacement des copies locales

**Question** : quand Lise quitte le cercle (de sa propre initiative ou par décision du parent référent), ses copies locales des données santé sont-elles effacées ?

**Exigence Loi 25 art. 28 + RGPD art. 17** : oui, obligatoirement.

**Comportement Kinhale v1.0 à spécifier explicitement** :

| Événement | Effet sur device Lise | Effet sur groupe MLS | Effet côté relais Kamez |
|---|---|---|---|
| **Lise tap « Je quitte ce cercle »** | Effacement immédiat du document Automerge local, des clés de session, de la mailbox locale, des PDFs exportés en cache | Envoi d'un message MLS `Remove` signé par Lise → rotation immédiate de clé de groupe par les membres restants | Purge de la mailbox de Lise, conservation du log d'audit pseudonymisé (« device X a quitté groupe Y à T ») |
| **Parent référent retire Lise** | Device Lise reçoit un message MLS `Remove`, applique l'effacement local au prochain lancement, affichage explicite *« Vous ne faites plus partie du cercle de Léa »* | Rotation immédiate de clé de groupe côté membres restants | Idem |
| **Lise désinstalle l'app sans quitter** | Effacement système + OS (effacement local garanti par l'OS) | Groupe MLS voit la mailbox de Lise inactive, **ne rotate pas automatiquement** | Le parent référent doit être **alerté** après X jours d'inactivité et invité à retirer Lise manuellement pour forcer la rotation |

**Point vigilance** : le cas *« désinstallation sans retrait explicite »* doit être traité en v1.0 — sinon le forward secrecy est partiellement dégradé (la clé de groupe reste accessible à une copie oubliée sur un device Lise non purgé).

**Recommandation bloquante** : l'app du parent référent affiche un **tableau de bord *« Aidants du cercle »*** listant pour chaque aidant la date de dernière activité. Après **30 jours d'inactivité**, proposition automatique *« Lise n'a pas utilisé Kinhale depuis 30 jours. Voulez-vous la retirer du cercle ? »* (non bloquant, non automatique, juste un nudge conforme). Aligne avec le principe de minimisation de la durée de conservation.

### 4.4. Révocation du consentement — Lise retire son consentement

**Question** : si Lise retire son consentement, doit-elle pouvoir quitter le cercle sans action du parent référent ?

**Réponse : OUI, bloquant v1.0.** Exigence RGPD art. 7.3 (retrait aussi simple que le consentement) et Loi 25 art. 27.

**Implémentation** :

- Bouton *« Je quitte ce cercle »* disponible **à tout moment** dans les paramètres du profil aidant, sans confirmation du parent référent, sans justification à fournir.
- **2 taps** maximum depuis l'écran d'accueil : Paramètres → Je quitte ce cercle → confirmation.
- **Aucun questionnaire de sortie** (lui proposer un canal « feedback » est OK mais entièrement optionnel et séparé de la confirmation de retrait — éviter tout pattern *« êtes-vous vraiment sûr, regardez tout ce que vous allez perdre »* type dark pattern).
- **Notification neutre au parent référent** : *« Lise a quitté le cercle de Léa. »* Pas *« Lise a abandonné »*, pas *« Attention, vous perdez un aidant »*.
- **Action immédiate** côté device Lise : effacement local + signal MLS `Remove`.

---

## 5. Exigences UX pour l'écran de consentement au scan

### 5.1. Mentions obligatoires — FR

Titre de l'écran (H1) : **« Rejoindre le cercle de soin de Léa »**

Sous-titre (H2) : **« Vous êtes sur le point d'accéder à des informations de santé confidentielles. »**

Corps (ordre séquentiel, respect du vouvoiement universel et du ton de marque `00-kz-branding.md` §4) :

> **Qui vous invite**
> Élodie Dupont vous invite à rejoindre le cercle de soin de **Léa** (5 ans).
>
> **Ce que vous pourrez voir**
> - Le journal des prises de pompes de fond et de secours de Léa
> - Les noms et posologies des pompes
> - Les symptômes éventuellement notés par les autres aidants
> - Les rappels programmés pour les prises
>
> **Ce que vous ne verrez pas**
> Kinhale ne partage ni la localisation de Léa, ni de photos, ni de données bancaires, ni de messagerie avec un médecin.
>
> **Comment vos données sont protégées**
> Toutes ces informations sont chiffrées sur les appareils des aidants du cercle. **Même Kinhale et Kamez Conseils ne peuvent pas les lire.** C'est la seule promesse qui compte quand un enfant est concerné.
>
> **Vos droits**
> Vous pouvez quitter ce cercle à tout moment, en un geste, depuis vos paramètres. Vos informations personnelles (votre prénom, les horodatages de vos saisies) seront effacées de votre appareil et vos anciennes saisies seront anonymisées.
>
> **Information légale**
> En acceptant, vous consentez explicitement à recevoir des renseignements de santé d'un mineur dans le cadre de la coordination de ses soins. Ce consentement est libre, éclairé, et retirable à tout moment (Loi 25 art. 14 et 27, RGPD art. 7 et 9).

Bouton primaire (action unique, pleine largeur, vert sauge) : **« J'accepte de rejoindre ce cercle »**

Bouton secondaire (texte uniquement, pas bouton plein) : **« Non, je ne rejoins pas »**

**Lien tertiaire** (petit, discret, en bas) : *« Lire la politique de confidentialité complète »* → ouvre la page dédiée.

### 5.2. Mentions obligatoires — EN

Title (H1) : **« Join Léa's care circle »**

Subtitle (H2) : **« You're about to access confidential health information. »**

Body :

> **Who's inviting you**
> Élodie Dupont is inviting you to join **Léa**'s care circle (age 5).
>
> **What you'll see**
> - Léa's log of controller and rescue inhaler uses
> - The names and dosages of her inhalers
> - Symptoms occasionally noted by other caregivers
> - Reminders scheduled for each dose
>
> **What you won't see**
> Kinhale never shares Léa's location, photos, financial data, or messages with her doctors.
>
> **How your data is protected**
> All this information is encrypted on each caregiver's device. **Not even Kinhale or Kamez Conseils can read it.** That's the only promise that matters when a child's health is at stake.
>
> **Your rights**
> You can leave this circle at any time, in one tap, from your settings. Your personal info (your first name, timestamps of your entries) will be erased from your device, and your past entries will be anonymized.
>
> **Legal notice**
> By accepting, you give your explicit consent to receive a minor's health information in the context of coordinating their care. This consent is freely given, informed, and withdrawable at any time (Quebec Law 25, articles 14 and 27; GDPR, articles 7 and 9).

Primary button : **« I agree to join this circle »**

Secondary button : **« No, I won't join »**

Tertiary link : *« Read the full privacy policy »*.

### 5.3. Preuve du consentement — journal local signé

Exigences Loi 25 art. 14 al. 3 (preuve du consentement) + RGPD art. 7.1 (démonstration de l'obtention du consentement).

**Format d'enregistrement proposé** (JSON, stocké dans le `consent_log` local chiffré de Lise) :

```json
{
  "event": "circle_join_consent",
  "circle_id": "uuid_opaque",
  "invited_by": "ed25519_pubkey_hash_parent_referent",
  "child_first_name_displayed": "Léa",
  "timestamp_utc": "2026-04-19T14:27:03Z",
  "app_version": "1.0.0",
  "privacy_policy_hash": "sha256:abcdef...",
  "terms_hash": "sha256:123456...",
  "locale": "fr-CA",
  "signature": "ed25519_signature_by_invitee_private_key"
}
```

**Propriétés exigibles** :

- **Signé par la clé privée de l'invité (Lise)** — non falsifiable par le parent référent ni par Kamez.
- **Stocké localement** (dans le document Automerge privé de Lise ou dans un journal dédié) + **envoyé chiffré au groupe MLS** pour que les autres aidants puissent auditer (ex : le parent référent voit dans les paramètres *« Lise a rejoint le 2026-04-19 à 14:27 UTC »*).
- **Conservé même après le retrait** : la preuve du consentement reste utile pour la période où il était actif. Seul le contenu santé est purgé.
- **Pas envoyé en clair au relais Kamez** — ce log n'est pas plus lisible par Kamez que le reste du contenu.

Ce journal répond à la fois à la preuve Loi 25/RGPD et sert de **registre d'audit utilisateur** côté parent référent.

### 5.4. Présentation (guidelines kz-designer)

- **Une seule action dominante** : le bouton d'acceptation. Respect du principe branding §3.3 *« Une action, un écran »*.
- **Pas de case à cocher pré-cochée** — interdite par Loi 25 art. 14.
- **Pas de case à cocher du tout** — le bouton *« J'accepte… »* est le consentement, pas une case. Cela évite le pattern *« je coche vaguement sans lire »*.
- **Hiérarchie visuelle forte** : H1 lisible à 3 m, corps en 16 px min, bouton primaire ≥ 48 px hauteur (touch target ≥ 44×44 pt WCAG + marge confort).
- **Pas d'emoji décoratif** ni d'illustration qui dramatise ou attendrit (pas de cœur, pas de famille dessinée). Le moment est sérieux mais calme.
- **Scroll visible requis** si l'écran dépasse la hauteur visible — le bouton primaire ne doit **pas** être accessible avant d'avoir fait défiler le corps (WCAG + engagement réel avec le texte).
- **Accessibilité VoiceOver/TalkBack** : lecture séquentielle du texte avant lecture du bouton. Labels `accessibilityLabel` explicites.
- **Contraste AAA** sur le texte légal et le bouton primaire (non AA seulement, compte tenu de la gravité du moment).

### 5.5. Retrait — accessibilité du bouton

- **Paramètres → Mon profil → « Je quitte ce cercle »** : maximum 2 taps depuis l'écran d'accueil.
- **Même couleur** que les actions destructives du DS (probablement terracotta ou neutre, pas rouge alarmiste), même poids visuel — ni caché, ni survendu.
- **Confirmation en modal** : *« Vous quittez le cercle de Léa. Vos copies locales seront effacées. Vos anciennes saisies resteront visibles pour les autres aidants, anonymisées. »* + bouton *« Confirmer »* + bouton *« Annuler »*.
- **Aucun dark pattern** : pas de *« Voulez-vous vraiment abandonner votre famille ? »*, pas de liste détaillée de ce qu'on va perdre pour décourager. Neutralité factuelle.

---

## 6. Impact sur l'architecture technique

### 6.1. Contenu du ticket QR

**Le ticket QR ne contient aucune donnée personnelle ni santé.** Exigence absolue — alignement avec la ligne rouge *« aucune donnée santé en clair côté relais »* étendue à *« aucune donnée identifiante dans le ticket d'invitation »*.

**Format proposé** (JSON compact, encodé en base64url dans le QR, ≤ 256 octets pour rester lisible) :

```json
{
  "v": 1,
  "tid": "ticket_uuid_v4",
  "pk": "ed25519_ephemeral_pubkey_base64",
  "mls": "key_package_base64",
  "exp": 1713532923,
  "sig": "ed25519_sig_by_parent_device"
}
```

- `tid` : identifiant opaque aléatoire.
- `pk` : clé publique éphémère de négociation, dédiée à cette invitation (pas la clé long terme du parent référent).
- `mls` : `KeyPackage` MLS précomputé par le parent référent pour intégrer un nouveau membre.
- `exp` : timestamp UNIX d'expiration (10 min, cf. §6.2).
- `sig` : signature du paquet par la clé long terme Ed25519 du device du parent référent — empêche la contrefaçon du ticket.

**Binding optionnel — v1.1 recommandé** : le ticket peut inclure un **hash du prénom de l'aidant attendu** (si le parent référent l'a pré-renseigné au moment de générer le ticket). Au scan, l'app de Lise demande *« Êtes-vous bien Lise ? »* avant d'afficher l'écran de consentement. Protection contre le vol de QR + un intrus qui essaierait de rejoindre à sa place. Pas bloquant v1.0, mais valeur ajoutée faible coût en v1.1.

**Pas de prénom enfant dans le ticket.** Le prénom n'apparaît qu'après l'échange MLS et le déverrouillage du premier delta du document Automerge partagé. Cela signifie que Lise voit **« Rejoindre le cercle de soin de Léa »** sur l'écran de consentement en **déchiffrant localement une carte d'invitation** qui lui est chiffrée avec la clé MLS fraîchement négociée. Cette carte d'invitation contient le prénom de l'enfant et éventuellement le prénom du parent, **en clair seulement sur le device de Lise**, jamais côté relais.

### 6.2. Durée de validité du ticket

**Recommandation : 10 minutes par défaut** (au lieu des 15 proposées).

Justification :

- **10 min** suffit pour un scan coprésent (cas principal : Élodie et Lise dans la même pièce, Élodie montre le QR sur son téléphone).
- **10 min** couvre aussi le scénario téléphonique (Élodie screenshot et l'envoie par iMessage, Lise scanne depuis un autre téléphone).
- **15 min** augmente la fenêtre d'attaque par vol de téléphone avec écran déverrouillé ou screenshot intercepté.
- **Extension explicite possible** : bouton *« Prolonger de 10 min »* côté Élodie si Lise n'a pas réussi à scanner (cas réseau, confusion technique).

**Cas saisie manuelle du code court 6 caractères** (fallback accessibilité) :

- Même TTL 10 min.
- **Rate limiting** obligatoire côté relais : après 5 tentatives de code erroné sur le même ticket, invalidation du ticket et notification au parent référent.
- **Entropie du code court** : **6 caractères alphanumériques non ambigus** (pas de 0/O, I/1, l/1) = ~30 bits d'entropie sur 10 min = quasi impossible à brute-forcer avec le rate limiting.

### 6.3. Révocation d'un ticket non consommé

**Exigences** :

- Le parent référent doit pouvoir **révoquer un ticket avant son expiration naturelle** depuis l'écran *« Inviter un aidant »* → liste des invitations en cours → swipe *« Annuler »* ou tap *« Annuler cette invitation »*.
- La révocation est **immédiate** : côté relais, le `tid` bascule en `revoked`, toute tentative de consommation renvoie une erreur `invitation_revoked`.
- **Pas de fuite d'information** : l'erreur `invitation_revoked` est indistinguable d'`invitation_expired` pour un scanner tiers.

### 6.4. Journal d'audit des invitations

Exigence Loi 25 art. 15 + RGPD art. 5.2 (responsabilité, *accountability*).

**Côté device du parent référent** (chiffré localement) :

| Champ | Valeur |
|---|---|
| `invitation_id` | UUID du ticket |
| `created_at` | ISO 8601 UTC |
| `role_proposed` | Contributeur / Contributeur restreint |
| `professional_flag` | booléen (cas §4.1) |
| `status` | `pending` / `consumed` / `expired` / `revoked` |
| `consumed_at` | ISO 8601 UTC, si consommé |
| `invitee_pubkey_hash` | hash de la clé publique de l'aidant qui a consommé, si consommé |
| `invitee_first_name` | seulement après consentement, saisi par l'aidant côté son device, synchronisé via MLS |

**Côté relais Kamez** (métadonnées opaques seulement) :

| Champ | Valeur |
|---|---|
| `ticket_id` | UUID opaque |
| `parent_device_pubkey_hash` | hash (pour routage révocation) |
| `created_at`, `expires_at` | horodatages |
| `status` | `pending` / `consumed` / `expired` / `revoked` |
| `size_bytes` | taille du KeyPackage MLS initial |

**Pas stocké côté relais** : qui est invité, rôle, prénom enfant, prénom aidant. Le relais ne sait pas qui rejoint qui.

**Rétention** : **90 jours côté relais** pour le log d'audit invitation (utile pour anti-abus et debug support). **Indéfinie côté device** pour le log utilisateur (l'utilisateur peut effacer à tout moment dans ses paramètres).

---

## 7. Recommandations au designer (kz-designer)

Pour le lock des maquettes parcours B, **doit absolument apparaître** :

1. **Écran de génération de QR côté parent référent** :
   - Titre clair *« Inviter un aidant »*
   - Choix du rôle en langage de cuisine (*« Famille proche »* / *« Garderie ou nounou »*), pas *« Contributeur » / « Contributeur restreint »* dans l'UI — respect branding §4.2.
   - Case *« Cet aidant est un professionnel agissant pour un employeur »* avec disclaimer §4.1 si coché.
   - QR affiché avec **code court en dessous** (6 caractères, fallback accessibilité).
   - Compte à rebours **visible** du TTL (*« Expire dans 09:58 »*).
   - Bouton *« Annuler cette invitation »*.
   - Bouton *« Prolonger de 10 min »* (apparition après 7 min écoulées).

2. **Écran de scan côté aidant invité** :
   - Caméra plein écran avec zone de scan centrée.
   - Lien alternatif *« Saisir le code à 6 caractères »*.
   - Aucun texte anxiogène (*« Attention »*, *« Sécurité »*).

3. **Écran de consentement post-scan** (§5.1, §5.2, §5.4) :
   - Tous les éléments listés §5.1 dans l'ordre.
   - Scroll requis avant d'activer le bouton primaire.
   - Bouton secondaire *« Non, je ne rejoins pas »* au même niveau visuel que le primaire mais poids inférieur (pas caché mais non prioritaire visuel).

4. **Écran post-consentement — réussite** :
   - *« Vous avez rejoint le cercle de Léa. »*
   - Micro-rappel : *« Vous pouvez quitter à tout moment depuis vos paramètres. »*
   - Bouton *« Voir le journal de Léa »*.

5. **Écran paramètres aidant — bouton retrait** :
   - Rubrique *« Mon appartenance au cercle »* clairement nommée.
   - Bouton *« Je quitte ce cercle »* avec modal de confirmation factuelle (§4.4, §5.5).

6. **Écran parent référent — tableau de bord des invitations** :
   - Liste des invitations actives (en attente, consommées, expirées, révoquées).
   - Possibilité de révoquer une invitation pending.
   - Affichage des aidants actifs avec date de dernière activité (pour §4.3 nudge 30 jours).

**À ne pas faire** :

- Ne pas utiliser d'emoji (cadenas, cœur) en décoratif sur l'écran de consentement.
- Ne pas montrer le prénom de l'enfant **avant** l'acceptation (pas dans la preview du QR, pas dans la notif push qui annoncerait l'invitation).
- Ne pas raccourcir le texte légal de §5.1 en dessous des mentions obligatoires — c'est le minimum Loi 25 + RGPD.
- Ne pas utiliser de couleurs rouges alarmistes pour le bouton de retrait — branding §4.2 *« jamais d'urgence gratuite »*.
- Ne pas afficher de compteur *« X personnes ont accepté aujourd'hui »* ou autre métrique comportementale — gamification bannie.

---

## 8. Risques résiduels & points à valider avec avis juridique externe

### 8.1. Risques résiduels identifiés

| # | Risque | Probabilité | Impact | Mitigation v1.0 |
|---|---|---|---|---|
| RC-QR-1 | **QR intercepté visuellement** par un tiers présent au moment de l'affichage | Faible | Moyen (un tiers rejoint le cercle) | TTL 10 min + écran de consentement qui nomme l'aidant attendu. Binding prénom v1.1. |
| RC-QR-2 | **Consentement de l'aidant sous influence** (coercition par le parent référent, ou inversion de rôle dans un couple en conflit) | Très faible v1.0 | Moyen | Hors périmètre technique. Documenter dans les CGU : *« Kinhale ne peut détecter ni prévenir une pression externe sur le consentement. En cas de litige familial, consultez les voies légales. »* |
| RC-QR-3 | **Éducatrice CPE scan sans autorisation employeur** | Moyenne | Moyen (mise en cause employeur) | Disclaimer §4.1 + modèle contrat-cadre v1.0. Avis juridique v1.1. |
| RC-QR-4 | **Désinstallation sans retrait** → clé de groupe non rotée | Moyenne | Moyen (forward secrecy dégradée) | Dashboard parent référent + nudge 30 jours §4.3. |
| RC-QR-5 | **Aidant décédé / incapable** — les copies locales ne peuvent plus être purgées par l'aidant | Très faible | Faible | Parent référent peut retirer l'aidant, ce qui révoque côté groupe MLS. Les copies locales sur le device inutilisé deviennent inexploitables (clés MLS rotées). À documenter. |
| RC-QR-6 | **Juridiction extra-UE/Canada** avec lois plus contraignantes (ex : Allemagne *Bundesdatenschutzgesetz* renforcé sur données santé mineur) | Moyenne | Faible | Les exigences Kinhale sont déjà au-dessus du socle RGPD. Veille juridique annuelle par RPRP. |
| RC-QR-7 | **Aidant mineur lui-même** (ex : grand frère 14 ans invité) | Faible v1.0 | Moyen | Documenter dans les CGU : *« Kinhale est destiné aux aidants adultes. Le parent référent est responsable du choix des aidants qu'il invite. »* Pas de contrôle technique v1.0. |

### 8.2. Points nécessitant avis juridique externe avant v1.1

1. **Qualification exacte du parent référent** au regard de l'art. 26 RGPD (responsable conjoint ?) — spécialement en cas de conflit parental ou de CPE qui n'a pas donné son accord. Position kz-conformite : usage domestique hors champ, mais à confirmer par un juriste spécialisé protection des données santé.
2. **Modèle de contrat-cadre CPE / garderie** : rédaction juridique à commander au juriste externe prévu `00-kz-conformite.md` §10 (budget 1 000–2 000 $ CAD). Valide Québec + France.
3. **Décision d'adéquation Canada** : suivi de la réévaluation CE attendue horizon 2027. Si retrait de l'adéquation, bascule des utilisateurs UE sur instance eu-west-1 (cf. `00-kz-conformite.md` §5.2).
4. **Cas litige parental** (désaccord entre titulaires de l'autorité parentale) : formulation juridique du disclaimer CGU à valider.

---

## 9. Conformité avec le cadre existant `00-kz-conformite.md`

| Point du cadre v1.0 | Statut parcours B |
|---|---|
| §1 Classification des données | **Renforcé** : le QR ne contient aucune donnée personnelle, meilleur que la classification v1.0 minimale. |
| §3 Privacy by Design & by Default | **Cas d'école** : minimisation maximale du ticket, consentement granulaire au moment du scan. |
| §4 Consentement | **Extension** : ce livrable spécifie le format du consentement de l'aidant secondaire §5, qui n'était esquissé que dans §4.1 du cadre v1.0. |
| §5 Hébergement | **Inchangé** : pas de nouveau flux transfrontière introduit. |
| §7 Politique de confidentialité | **Ajout à prévoir** : section dédiée parcours B dans la PC (*« Comment vous rejoignez un cercle de soin »*) — à répartir entre kz-copywriting et juriste externe. |
| §8 Sécurité | **Renforcé** : le ticket signé Ed25519 + TTL 10 min + rate limiting code court + binding prénom v1.1 + journal d'audit dual = couverture au-dessus du cadre v1.0. |
| §9 Gouvernance | **Ajout obligatoire** : ÉFVP v1.0 doit contenir un **chapitre dédié parcours B** incluant tous les points de ce livrable. RAT v1.0 doit mentionner le traitement « ticket d'invitation opaque » (finalité, durée, base légale). |
| §11 Risques | **Étendu** : §8.1 de ce livrable ajoute 7 risques spécifiques parcours B, à fusionner dans la table de risques globale. |

Aucun élément du cadre existant n'est **contredit** par le parcours B. Au contraire, le parcours B **renforce** la posture Loi 25 + RGPD + Privacy by Design de Kinhale.

---

## 10. Ligne rouge dispositif médical — vérification

Le parcours B introduit-il le moindre risque de bascule DM ?

| Test | Parcours B |
|---|---|
| L'écran de consentement recommande-t-il une dose ? | **Non.** |
| Suggère-t-il un plan de soin, un protocole, un diagnostic ? | **Non.** |
| Déclenche-t-il une alerte de type *« appelez votre médecin »* ? | **Non.** |
| Utilise-t-il un vocabulaire prescriptif (*« traitement »*, *« thérapie »*, *« protocole »*) ? | **À surveiller** : la microcopie §5.1 utilise *« coordination des soins »* et *« renseignements de santé »*. Correctement dans le lexique autorisé `00-kz-branding.md` §4.3. |
| Le fait d'ajouter un aidant modifie-t-il la conduite thérapeutique ? | **Non** : ajouter un aidant change qui voit le journal, pas ce qui est prescrit à l'enfant. |

**Verdict** : ligne rouge DM **préservée** par le parcours B.

Pour kz-designer : conserver scrupuleusement le lexique `00-kz-branding.md` §4.3 sur tous les écrans du parcours B. Ne jamais introduire *« votre traitement »*, *« votre protocole »*, *« votre plan thérapeutique »*. Rester sur *« le journal partagé »*, *« le cercle de soin »*, *« la coordination des aidants »*.

---

## 11. Synthèse des décisions pour kz-designer et consultant

**Bloquants v1.0 — à intégrer dans les maquettes parcours B avant lock design** :

- [ ] Écran de consentement §5.1 FR + §5.2 EN, tel que rédigé, sans raccourci ni suppression de mention légale.
- [ ] TTL ticket **10 min** (au lieu de 15) + bouton prolongation manuelle.
- [ ] Bouton *« Je quitte ce cercle »* self-service en 2 taps depuis les paramètres de l'aidant.
- [ ] Dashboard invitations côté parent référent avec révocation possible des tickets pending.
- [ ] Question *« Aidant professionnel ? »* à la génération du ticket + disclaimer conditionnel §4.1.
- [ ] Pas de prénom enfant dans le QR ni dans la notif — uniquement dans l'écran de consentement après déchiffrement local.
- [ ] Pas de case à cocher pré-cochée ; bouton d'action unique *« J'accepte de rejoindre ce cercle »*.

**Bloquants v1.0 — côté livrables conformité à mettre à jour** :

- [ ] ÉFVP v1.0 enrichie d'un chapitre dédié parcours B.
- [ ] RAT v1.0 mentionne le traitement « ticket d'invitation opaque » (finalité, durée, base légale).
- [ ] Politique de confidentialité v1.0 intègre une section *« Comment vous rejoignez un cercle de soin »*.
- [ ] Modèle de contrat-cadre CPE/garderie v1.0, validé juriste externe.
- [ ] CGU v1.0 intègrent les disclaimers §3.5 (juridiction aidant étrangère), §3.4 (conflit parental), §8.1 (pression externe non détectable).

**Reportables v1.1** :

- [ ] Binding prénom dans le ticket (§6.1).
- [ ] Workflow professionnel dédié avec pièce jointe du contrat-cadre signé.
- [ ] Avis juridique externe sur qualification responsable conjoint (§3.2) et cas CPE (§4.1).
- [ ] Warning IP distante aidant étranger (§3.5).

**Reportables v2.0** :

- [ ] Compte enfant distinct avec consentement propre dès 14 ans QC / 15 ans FR / 13 ans UE (§4.2).
- [ ] Mécanisme co-admin parental bi-latéral en cas de divorce (§3.4).

---

*Fin de l'avis de conformité sur le parcours B d'onboarding assisté par QR code. Livrable prêt à être consommé par kz-designer (lock maquettes), kz-copywriting (microcopie FR/EN), kz-specs (règles RM consentement), le consultant et le juriste externe.*
