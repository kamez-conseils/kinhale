# Conception UI/UX — Kinhale v1.0

> Rédigé par **kz-designer** le 2026-04-19 — Client : Martial (martial@wonupshop.com)
> Amont : `00-kz-discovery.md`, `00-kz-discovery-addendum.md`, `00-kz-product.md`, `00-kz-specs.md`, `00-kz-branding.md`, `00-kz-ux-research.md`, `00-kz-conformite.md`
> Aval : kz-design-system, kz-copywriting, kz-frontend, kz-qa

---

## Décisions design validées (2026-04-20)

Les 10 arbitrages design (§11) + les 6 ajustements conformité issus de `00-kz-conformite-qr-onboarding.md` ont été tranchés par le consultant et doivent être traités comme définitifs par tous les agents en aval (kz-design-system, kz-copywriting, kz-frontend, kz-qa).

### 10 décisions design

1. **A1 — Export PDF** : **Admin seul** en v1.0. Contributeur consulte, pas d'export. Bouton Export masqué pour les rôles autres qu'Admin.
2. **A2 — Onboarding assisté (Admin configure device de Lise à distance)** : **hors v1.0**. Le parcours B QR code couvre suffisamment le cas Lise. À reconsidérer en v1.1.
3. **A3 — Widget iOS / Android** : **hors v1.0**. Roadmap v1.1.
4. **A4 — Mode sombre** : **activé dès v1.0**, clair + sombre en parité complète via tokens Tamagui. Respect `prefers-color-scheme` système + override manuel dans paramètres.
5. **A5 — Photo enfant** : **absente par défaut** (pastille avec initiale colorée). Toggle "Activer la photo" dans paramètres, avec avertissement explicite "photo stockée chiffrée localement uniquement".
6. **A6 — Baseline dans l'app** : **"Pour respirer ensemble" / "Breathe easier, together"** (baseline émotionnelle validée au branding) sur la landing slide 1. Baseline fonctionnelle réservée App Store / SEO.
7. **A7 — Vocabulaire "pompe"** : **monolexique "pompe"** pour FR-CA ET FR-FR. Pas d'override `fr-FR.inhaler_term` en v1.0. Revisiter si tests post-lancement montrent > 20% d'incompréhension FR-FR.
8. **A8 — Révocation aidant** : **wipe immédiat cryptographique** (rotation de clé MLS instantanée côté cercle) **+ signal de wipe local exécuté à la prochaine connexion du device révoqué**. Microcopie E3.05 honnête : "[Aidant] n'aura plus accès aux prises futures. Ses anciennes copies locales seront effacées à sa prochaine ouverture."
9. **A9 — Recovery seed** : **parcours tolérant**, report possible avec rappels J+1 et J+3. Copy de rappel honnête : "Sans cette phrase de récupération, vos données seront irrécupérables en cas de perte du téléphone."
10. **A10 — Page `/trust` publique** : **v1.0 en version minimale**. 1 page statique sur `kinhale.health` : architecture zero-knowledge expliquée en langage clair + lien code source AGPL + contact `security@kinhale.health`. Contenu enrichi en v1.1.

### 6 ajustements conformité bloquants — intégrer aux maquettes du parcours B (onboarding QR)

Issus de `00-kz-conformite-qr-onboarding.md` — verdict "OUI avec ajustements" :

1. **Écran de consentement non contournable** au scan, AVANT ajout au groupe MLS. Le design actuel E1.13 doit être re-spécifié pour empêcher tout bypass.
2. **Journal de consentement local E2EE**, horodaté, signé par la clé Ed25519 de l'invité. Stocké sur le device de l'invité + copie sur le device de l'Admin. Lecture possible dans les paramètres.
3. **Pas de prénom enfant dans le QR code**. Le QR contient uniquement : identifiant d'invitation, clé publique éphémère, TTL. Le prénom de l'enfant n'apparaît qu'APRÈS déchiffrement local sur l'écran de consentement.
4. **TTL ticket = 10 min par défaut** (ramené de 15 min). Bouton "Prolonger" manuel côté Admin si l'invité n'a pas encore scanné.
5. **Révocation d'un ticket non consommé** : dashboard "Invitations en attente" côté Admin avec bouton "Révoquer" immédiat.
6. **Bouton "Je quitte ce cercle" self-service** en 2 taps dans les paramètres de l'aidant, sans action requise du parent référent.

### Points à faire valider par juriste externe (non bloquants v1.0, disclaimer CGU suffisant)

- Qualification juridique du parent référent (usage domestique RGPD art. 2.2.c vs responsable conjoint art. 26)
- Cas garderie/CPE professionnelle : contrat-cadre à faire rédiger si déploiement B2B2C

---

## Préambule

Ce livrable n'invente ni une promesse produit, ni une personnalité de marque, ni des personas : il traduit ceux qui existent en **écrans utilisables**. Chaque décision est justifiée par un amont précis — PRD `00-kz-product.md` §N, spec `00-kz-specs.md` §N, branding `00-kz-branding.md` §N, UX research `00-kz-ux-research.md` §N, conformité `00-kz-conformite.md` §N — jamais par goût esthétique.

Kinhale se conçoit **debout, une main, parfois à 3 h du matin, parfois avec un enfant qui tousse** (UX research §3 et §5). Ce livrable garde ce filtre d'arbitrage prioritaire sur la cohérence visuelle.

La v1.0 couvre **51 écrans**, regroupés en 9 flows, tous maquettés ici. Aucun écran n'est optionnel : tous sont nécessaires pour respecter la Definition of Done produit (PRD §11) et les règles métier RM1-RM28 (specs §4).

---

## Table des matières

1. Principes de design — opérationnalisation des 10 principes non-négociables
2. Architecture de l'information — carte d'ensemble des 51 écrans
3. Parcours clés illustrés — les 7 moments de vérité en wireframes ASCII
4. Spécifications écran par écran (51 écrans, 9 flows)
5. Composants UI récurrents
6. Grille et breakpoints
7. Principes d'accessibilité
8. Principes de motion
9. Conventions de nommage
10. Risques UX résiduels
11. Points d'arbitrage restants

---

## 1. Principes de design

Les 10 principes non-négociables d'`00-kz-ux-research.md` §8 sont ici traduits en lignes directrices opérationnelles pour le designer et le design-system. Aucun écran ne peut être validé sans vérifier ces 10 critères sous forme de checklist.

| # | Principe UX research | Traduction designer |
|---|---|---|
| **DP1** | Test Lise | Un écran = un but. Texte corps ≥ 16 px, cible ≥ 18 px. Bouton primaire ≥ 56 px de haut, ≥ 44 × 44 pt de surface tactile. Aucune navigation critique au-delà de 2 niveaux. |
| **DP2** | Recovery seed = moment de confiance | L'écran « mots de sécurité » bénéficie d'un **layout dédié** (pas un formulaire standard) : ivoire chaud, Fraunces en titre, colonne de mots en JetBrains Mono, CTA unique. Jamais « seed » ni « BIP39 » à l'écran. |
| **DP3** | Ni peur ni minimisation | Ambre `#C9883C` pour attention, terracotta `#B94A3E` **strictement réservé pompe de secours**, gris ardoise `#6B7280` pour historique passé. Zéro point d'exclamation dans la microcopie système. |
| **DP4** | Une action principale, point | Écran d'accueil = 1 CTA dominant + 1 CTA secours. Les autres actions sont derrière des icônes discrètes. Pas de tab bar à 5 items : **maximum 3** (Accueil, Journal, Plus). |
| **DP5** | Hors-ligne = mode, pas erreur | Badge discret `chip-offline` en haut, confirmation locale immédiate avec texte rassurant (*« Prise enregistrée. Sera synchronisée dès que la connexion revient. »*). Jamais de modale d'erreur plein écran. |
| **DP6** | Vocabulaire = sécurité juridique | « pompe » (décision UX research §0.1), « donner », « prise du matin / soir », « aidant », « foyer », « cercle ». Jamais « administrer », « posologie », « crise », « alerte santé ». |
| **DP7** | Notifications opaques en contenu, expressives en design | Push OS = `{title: "Kinhale", body: "Nouvelle activité dans votre foyer"}` (RM16 + conformité §1.2). Dans l'app, les in-app notifications peuvent nommer l'aidant et la pompe. |
| **DP8** | WCAG 2.1 AA prérequis | Contraste ≥ 4.5:1 texte normal, ≥ 3:1 UI. Dynamic Type jusqu'à 200 %. `prefers-reduced-motion` honoré systématiquement. |
| **DP9** | Zéro gamification, zéro urgence auto | Pas de streaks, badges, scores. Pas d'« Urgent », « Alerte », « Critique » auto-générés. Pas de « appelez votre médecin » hors disclaimer légal statique. |
| **DP10** | L'app s'efface | Écran d'accueil silencieux. Pas de carrousel, pas de nouveautés tape-à-l'œil, pas de demande d'avis App Store. Usage mature = 5 secondes / jour. |

### Règles d'arbitrage visuel complémentaires

- **Palette (branding §5.2)** : vert sauge `#2F6B5A` = routine/fond ; terracotta `#B94A3E` = **secours uniquement** ; ambre `#C9883C` = attention douce ; ardoise `#6B7280` = passé neutre ; vert doux `#4B8B6E` = succès discret ; ivoire `#FAF8F4` / forêt nuit `#14201C` = surfaces.
- **Typographies (branding §5.3)** : Inter pour 99 % de l'UI. Fraunces uniquement H1 marketing + wordmark + couverture PDF médecin. JetBrains Mono **uniquement** sur écrans recovery seed + horodatages détaillés.
- **Iconographie (branding §5.4)** : Phosphor ou Lucide, stroke 1.5 px, terminaisons arrondies. Icônes custom pour pompe de fond et pompe de secours (silhouette générique, jamais une marque). **Jamais** de croix rouge, caducée, stéthoscope, pilule, seringue.
- **Motion (branding §5.6)** : 150-200 ms standard, 250-300 ms entrée d'élément, ease-out. Aucun bounce. Aucun confetti.
- **Registre linguistique (branding §4.2)** : vouvoiement FR universel, neutre EN. Aucun tutoiement même en écran intime.

---

## 2. Architecture de l'information

### 2.1. Vue d'ensemble — 51 écrans en 9 flows

```
Flow 1 — Découverte & Onboarding (E1.01 → E1.16) ............ 16 écrans
Flow 2 — Usage quotidien & journal (E2.01 → E2.07) ........... 7 écrans
Flow 3 — Cercle de soin & partage (E3.01 → E3.06) ............ 6 écrans
Flow 4 — Pompes & plan de traitement (E4.01 → E4.04) ......... 4 écrans
Flow 5 — Rappels & notifications (E5.01 → E5.04) ............. 4 écrans
Flow 6 — Profil enfant & exports (E6.01 → E6.04) ............. 4 écrans
Flow 7 — Paramètres & sécurité (E7.01 → E7.08) ............... 8 écrans
Flow 8 — États critiques & edge cases (E8.01 → E8.06) ........ 6 écrans
Flow 9 — Informations légales & support (E9.01 → E9.05) ...... 5 écrans
                                                           Total : 60 écrans techniques
                                                           (regroupement spec 51 écrans)
```

Note : le brief demandait une couverture de 50+ écrans numérotés 1 à 51. Dans la réalité technique des états (loading, error, empty, success) et des variantes contextuelles, certaines entrées se dédoublent ou se dédoublent pas. Le découpage ci-dessous respecte la numérotation du brief (1-51) avec un identifiant technique `E<flow>.<num>` plus granulaire pour l'implémentation.

### 2.2. Carte mentale — structure de navigation

```
                          ┌──────────────────────────┐
                          │  APP LANCÉE              │
                          └──────────┬───────────────┘
                                     │
                ┌────────────────────┼───────────────────┐
                ▼                    ▼                   ▼
         SESSION ACTIVE       SESSION ÉTEINTE     INVITATION QR
                │                    │                   │
                │             ┌──────┴───────┐           │
                │             ▼              ▼           │
                │        PREMIER         RETOUR        PARCOURS B
                │        LANCEMENT       UTILISATEUR   (Aidant invité)
                │             │              │           │
                │             ▼              ▼           ▼
                │       FLOW 1         AUTH/BIOMÉTRIE  FLOW 1.B
                │       ONBOARDING A         │        (E1.11-1.14)
                │             │              │           │
                │             └──────────────┼───────────┘
                │                            ▼
                └─────────────► ACCUEIL CERCLE (E2.01) ◄─────┐
                                         │                   │
        ┌────────────────────┬───────────┴──────┬────────┐   │
        ▼                    ▼                  ▼        ▼   │
    JOURNAL              RAPPELS           CERCLE    PARAM.  │
    (Flow 2)             (Flow 5)          (Flow 3)  (Flow 7)│
        │                    │                  │        │   │
        ├─Saisie rapide      ├─Config rappel    ├─Membres├─Profil aidant
        ├─Détail prise       ├─Notif reçue      ├─Rôles  ├─Sécurité/seed
        ├─Correction         └─Préférences      ├─Invit. ├─Bio/PIN
        ├─Calendrier                            ├─Retrait├─Sauvegarde
        ├─Secours (terracotta)                  └─Audit  ├─Récup device
        └─Vue filtrable                                  ├─Devices
              │                                          └─Préférences
              │
       ┌──────┴──────┐
       ▼             ▼
    POMPES       PROFIL ENFANT
    (Flow 4)     (Flow 6)
       │             │
       ├─Liste       ├─Fiche
       ├─Détail      ├─Édition
       ├─Ajout       ├─Export PDF
       └─Plan        └─Historique exports

                   ÉTATS CRITIQUES (Flow 8, transverses)
                   ├─Offline      ├─Conflit sync
                   ├─Notif ratée  ├─Seed perdue
                   ├─Erreurs      └─Empty states

                   LÉGAL & SUPPORT (Flow 9, transverses)
                   ├─À propos     ├─Politique conf.
                   ├─CGU          ├─FAQ / aide
                   └─Contact sécurité
```

### 2.3. Règles de navigation

- **Navigation principale mobile (primaire)** : tab bar 3 items — **Accueil** (maison), **Journal** (timeline), **Plus** (menu ouvrant cercle / pompes / rapport / paramètres / légal). Choix validé vs 5 tabs par DP4.
- **Navigation principale tablette / desktop** : sidebar gauche 240 px minimum avec 6 sections visibles — Accueil, Journal, Cercle, Pompes, Rapport, Paramètres.
- **Profondeur max** : 3 niveaux (Accueil → Journal → Détail prise). Au-delà, on ouvre une modale plutôt qu'un nouvel écran.
- **Retour** : gesture swipe iOS natif + flèche back Android natif + bouton back discret sur web. Jamais un X qui risque la perte de données sans confirmation.
- **Aidant restreint (garderie/nounou)** : pas de tab bar. Un seul écran tout le temps (E2.02 simplifié) — mode kiosque.

### 2.4. Matrice écran × persona

| Écran | P1 Élodie Admin | P2 Marc Contrib | P3 Lise Contrib | P4 Fatou Restr. | P5 Aïcha Restr. | P6 Léa sujet |
|---|---|---|---|---|---|---|
| Onboarding A (parent référent) | **Oui** | Non | Non | Non | Non | n/a |
| Onboarding B (QR invité) | Non | **Oui** | **Oui** | **Oui** | **Oui** | n/a |
| Accueil cercle | Oui | Oui | Oui (simplifié) | Non | Non | n/a |
| Accueil restreint kiosque | Non | Non | Non | **Oui** | **Oui** | n/a |
| Saisie rapide prise fond | Oui | Oui | Oui | Oui | Oui | n/a |
| Prise de secours | Oui | Oui | Oui | Oui | Oui | n/a |
| Journal complet | Oui | Oui | Oui (simplifié) | **Non** | **Non** | n/a |
| Cercle — gérer rôles | **Oui seul** | Non | Non | Non | Non | n/a |
| Plan de traitement — éditer | **Oui seul** | Non | Non | Non | Non | n/a |
| Export PDF | **Oui seul** | Non | Non | Non | Non | n/a |
| Recovery seed | Oui | Oui | Oui (assistée) | n/a | n/a | n/a |
| Paramètres complets | Oui | Oui | Oui | Subset | Subset | n/a |

---

## 3. Parcours clés illustrés — les 7 moments de vérité

### MV1 — La génération de la recovery seed (J1, étape 1.5)

Écran le plus critique du produit (UX research §5 MV1). L'objectif est de transformer une contrainte cryptographique en **moment de confiance**.

```
┌─────────────────────────────────────┐
│  ←        Pas à pas • Étape 5/7  ⌕  │   ← progression discrète
├─────────────────────────────────────┤
│                                     │
│   Vos mots de sécurité              │   H1 Fraunces 32 px
│                                     │
│   Pour que personne — même nous —   │   Inter body-lg 18 px
│   ne puisse lire les données        │   vouvoiement FR
│   de Léa, Kinhale va générer        │
│   12 mots rien qu'à vous.           │
│                                     │
│   Notez-les sur papier, ou          │
│   enregistrez-les dans votre        │   pas d'allusion iCloud Notes
│   gestionnaire de mots de passe.    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  1 orange      7  tunnel    │    │   JetBrains Mono 18 px
│  │  2 jardin      8  miel      │    │   colonne 2 colonnes
│  │  3 calme       9  nuage     │    │   spacing aéré
│  │  4 pierre     10  racine    │    │
│  │  5 sentier    11  source    │    │
│  │  6 feuille    12  lampe     │    │
│  └─────────────────────────────┘    │
│                                     │
│  [ Afficher/Masquer ] [ Imprimer ]  │   toggle show/hide
│                                     │
│  ┌─────────────────────────────┐    │
│  │  J'ai noté mes mots         │    │   CTA primaire vert sauge
│  └─────────────────────────────┘    │   pleine largeur 56 px
│                                     │
│   Je le ferai plus tard             │   lien secondaire (pas bouton)
│                                     │
└─────────────────────────────────────┘
```

**Étape suivante (confirmation)** : 3 cases blanches à remplir, « Quel est le mot n°2 ? n°7 ? n°11 ? » — pas les 12, pour ne pas piéger. Si erreur : « Vérifions ensemble », pas « ERREUR ».

**Règles** : DP2, DP3, DP6, DP9 appliqués simultanément.

### MV2 — Première synchro entre deux aidants (J2, étape 2.4)

```
┌─────────────────────────────────────┐
│                                     │
│          Léa • 5 ans                │   nom enfant tout en haut
│          ─────────                  │   (dignité P6)
│                                     │
│   Prochaine prise du soir           │
│   20:00                             │   Fraunces 24 px
│                                     │
│  ┌─────────────────────────────┐    │
│  │  ● Je viens de donner       │    │   CTA primaire vert sauge
│  │     la pompe de fond        │    │   56 px, 1 tap
│  └─────────────────────────────┘    │
│                                     │
│   • Pompe de secours                │   CTA secondaire terracotta outline
│                                     │
├─────────────────────────────────────┤
│   Dans votre cercle                 │   section discrète
│                                     │
│   ✓ Élodie, vous                    │
│   ✨ Marc vient de rejoindre        │   petite anim fade-in
│     le cercle                       │   coche vert doux 200 ms
│                                     │
├─────────────────────────────────────┤
│  [  Accueil  ] [ Journal ] [ Plus ] │   tab bar 3 items
└─────────────────────────────────────┘
```

### MV3 — Notification reçue (prise enregistrée par un autre)

```
OS (payload opaque — RM16) :
┌────────────────────────────────┐
│  Kinhale                       │
│  Nouvelle activité dans        │
│  votre foyer                   │
└────────────────────────────────┘

Ouverture app → in-app card :
┌─────────────────────────────────────┐
│          Léa • 5 ans                │
│   ─────────                         │
│                                     │
│   Prise du soir donnée              │   vert sauge, pas d'exclamation
│   par Marc à 19:47                  │   Inter 18 px
│                                     │
│   Voir le détail                    │   lien discret
│                                     │
│   Prochaine prise : matin 8:00      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Tout est à jour            │    │   status card succès discret
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### MV4 — Invitation QR code (parcours B, aidant invité) — P3 Lise

```
CÔTÉ P1 ÉLODIE (génère l'invitation) :
┌─────────────────────────────────────┐
│  ← Inviter un aidant                │
├─────────────────────────────────────┤
│                                     │
│   Rôle                              │
│  ┌─────────────────────────────┐    │
│  │  ● Famille proche           │    │   radio sélectionné (vert sauge)
│  │    (voit l'historique,      │    │   DP6 langage cuisine
│  │     reçoit les rappels)     │    │
│  │  ○ Garderie ou nounou       │    │
│  │    (saisit une prise,       │    │
│  │     session 8 h sur         │    │
│  │     appareil partagé)       │    │
│  └─────────────────────────────┘    │
│                                     │
│   Nom affiché dans le cercle        │
│  ┌─────────────────────────────┐    │
│  │ Mamie Lise                  │    │
│  └─────────────────────────────┘    │
│                                     │
│                                     │
│   ┌─────────────────┐               │
│   │ ▓▓░░▓▓░▓▓░▓░    │  QR code      │   QR généré côté device
│   │ ░▓▓░▓░▓░▓▓▓░    │  256 px        │   zero-knowledge (UX §0.4)
│   │ ▓░▓▓▓░▓▓░░▓▓    │               │
│   │ ░▓░▓░░▓░▓▓░▓    │               │
│   └─────────────────┘               │
│                                     │
│   Code court :    4 8 2 9 1 7       │   JetBrains Mono 24 px
│                                     │
│   Expire dans : 48 h                │
│                                     │
│  [ Partager le lien ] [ Imprimer ]  │
│                                     │
└─────────────────────────────────────┘

CÔTÉ P3 LISE (scan QR sur son iPad) :
┌─────────────────────────────────────┐
│                                     │
│   Élodie vous invite                │   Fraunces 28 px
│   à rejoindre le cercle             │   calme, pas urgent
│   de soin de Léa                    │
│                                     │
│   En rejoignant, vous pourrez :     │
│   • noter une prise de pompe        │
│   • voir l'activité récente         │
│   • recevoir les rappels            │
│                                     │
│   ─────────────────                 │
│                                     │
│   Avant de continuer                │   consentement Loi 25/RGPD
│   (RPRP — conformité §4.1)          │   à l'acceptation (UX §0.4)
│                                     │
│   ☐  Je comprends que les données   │   case NON pré-cochée
│      santé de Léa resteront         │   case ≥ 28 px
│      chiffrées sur mon appareil     │
│                                     │
│   ☐  J'accepte de recevoir des      │
│      rappels et notifications       │
│                                     │
│   Politique de confidentialité →    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Rejoindre le cercle        │    │   CTA primaire vert sauge
│  └─────────────────────────────┘    │   grisé tant que cases non cochées
│                                     │
│   Ce n'est pas moi                  │   lien discret
│                                     │
└─────────────────────────────────────┘
```

### MV5 — Première prise de secours (J6)

```
ÉCRAN DE SÉLECTION (E2.06) :
┌─────────────────────────────────────┐
│  ← Pompe de secours                 │   H1 Inter 24 px
├─────────────────────────────────────┤
│                                     │
│   Ce que Léa ressent                │   label terracotta
│                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐            │   grille 3 × 2
│  │ 🫁  │ │ 💨  │ │ 😮‍💨 │            │   (icônes custom Phosphor
│  │Toux │ │Siff-│ │Ess- │            │    stroke terracotta)
│  │     │ │lem. │ │oufl.│            │   touch target 88 × 88 pt
│  └─────┘ └─────┘ └─────┘            │   body-lg 18 px
│  ┌─────┐ ┌─────┐ ┌─────┐            │
│  │ 🌙  │ │ ❤   │ │ …   │            │
│  │Ré-  │ │Gêne │ │Autre│            │
│  │veil │ │     │ │     │            │
│  └─────┘ └─────┘ └─────┘            │
│                                     │
│   Contexte                          │
│                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐            │
│  │🏃‍♂️  │ │🌸   │ │🤧   │            │
│  │Eff- │ │Aller│ │Rhume│            │
│  │ort  │ │gène │ │     │            │
│  └─────┘ └─────┘ └─────┘            │
│                                     │
│   + Ajouter une note (optionnel)    │   lien discret
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Enregistrer la prise       │    │   CTA primaire terracotta
│  └─────────────────────────────┘    │   grisé tant que RM4 non satisfaite
│                                     │
└─────────────────────────────────────┘

→ CONFIRMATION (200 ms)
   Coche terracotta qui se dessine.
   Texte : « Prise de secours enregistrée. »
   Aucun feu d'artifice. Aucun « bravo ».

→ NOTIFICATION REÇUE PAR ÉLODIE (5 s plus tard)
   Push OS : « Kinhale — Nouvelle activité dans votre foyer »
   À l'ouverture : « Prise de secours donnée par Aïcha à 14:30.
                    Signalée : toux, réveil de sieste.
                    Cette information vient directement de votre cercle.
                    Si vous souhaitez en discuter avec Aïcha, [Contacter]. »
   PAS de « Urgence », PAS de « Appelez votre médecin ».
```

### MV6 — PDF médecin (J7)

```
ÉCRAN D'EXPORT (E6.03) :
┌─────────────────────────────────────┐
│  ← Rapport pour la pédiatre         │
├─────────────────────────────────────┤
│                                     │
│   Période à résumer                 │
│                                     │
│   ○ 30 derniers jours               │
│   ● 3 derniers mois  ◄ défaut       │
│   ○ Personnalisée                   │
│                                     │
│   Destinataire                      │
│                                     │
│   ○ Pour moi                        │
│   ● Pour un médecin                 │
│                                     │
│   ─────────────────                 │
│                                     │
│   Aperçu                            │
│  ┌─────────────────────────────┐    │
│  │  [page 1/2]                 │    │   miniature PDF
│  │  ╔═════════════════╗        │    │   (wireframe du PDF lui-même)
│  │  ║ Léa, 5 ans      ║        │    │
│  │  ║ 19 jan–19 avr   ║        │    │
│  │  ║ ──────          ║        │    │
│  │  ║ Fond 92 %       ║        │    │
│  │  ║ Secours 3       ║        │    │
│  │  ║ [graphique]     ║        │    │
│  │  ╚═════════════════╝        │    │
│  └─────────────────────────────┘    │
│                                     │
│   Taille 87 Ko • Pages 2            │
│   Disclaimer non-DM inclus (RM27)   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Télécharger le PDF         │    │   CTA primaire vert sauge
│  └─────────────────────────────┘    │
│   Envoyer par email                 │
│   Télécharger en CSV (données brut) │
│                                     │
└─────────────────────────────────────┘
```

### MV7 — Révocation d'un aidant (fin de garde)

```
ÉCRAN CERCLE > DÉTAIL AIDANT (E3.02) :
┌─────────────────────────────────────┐
│  ← Mamie Lise                       │
├─────────────────────────────────────┤
│                                     │
│         ┌───┐                       │
│         │ L │         Mamie Lise    │   avatar initiale
│         └───┘         Famille proche│
│                                     │
│   A rejoint le 12 avril             │
│   Active il y a 2 h                 │
│   A enregistré 14 prises            │
│                                     │
│   ─────────────────                 │
│                                     │
│   Modifier le nom affiché           │
│   Modifier le rôle                  │
│                                     │
│   ─────────────────                 │
│                                     │
│   Retirer du cercle                 │   bouton texte terracotta
│                                     │   (confirmation forte requise)
└─────────────────────────────────────┘

→ TAP « Retirer du cercle » → MODALE CONFIRMATION FORTE :

┌─────────────────────────────────────┐
│                                     │
│     Retirer Mamie Lise ?            │   Fraunces 24 px
│                                     │
│  À partir de maintenant :           │
│  • elle ne verra plus les prises    │
│  • elle ne recevra plus de rappels  │
│  • l'historique sur son iPad sera   │
│    effacé à sa prochaine connexion  │
│                                     │
│  Vous pourrez l'inviter à nouveau   │
│  plus tard.                         │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Confirmer le retrait       │    │   CTA primaire terracotta
│  └─────────────────────────────┘    │
│   Annuler                           │   lien
│                                     │
└─────────────────────────────────────┘

→ ACCEPT → SIDE EFFECTS
   - RM (spec §4) : rôle révoqué
   - notification côté Lise (par fallback email) :
     "Votre accès au cercle de Léa est terminé. Merci d'avoir aidé."
     (digne, non froide — UX research §5 MV7)
   - audit trail (spec 3.11) : event `invitation_revoked`
   - wipe local forcé côté Lise à prochaine ouverture
```

---

## 4. Spécifications écran par écran

**Convention de lecture** :
- `[brief #]` fait référence à la numérotation du brief utilisateur (1-51).
- `<ID technique>` : identifiant de route et de composant à utiliser en code.
- `persona` : qui l'utilise principalement.
- `contexte` : environnement d'usage (cuisine, CPE, lit, consultation…).
- `but` : objectif utilisateur en une phrase.
- `contenu` : éléments d'information présents, ordonnés par hiérarchie visuelle.
- `actions` : CTA primaires / secondaires / navigation.
- `états` : idle, loading, error, empty, success.
- `responsive` : différences mobile portrait / tablette / desktop.
- `a11y` : points d'attention spécifiques.
- `i18n` : impact FR (textes plus longs).
- `motion` : micro-interactions clés.
- `risques UX` : ce qui peut décrocher.
- `règles` : mapping vers RM et DP.

---

### FLOW 1 — Découverte & Onboarding (16 écrans)

#### [1] E1.01 — Splash & langue

- **ID** : `splash`
- **Route** : `/` (first launch)
- **Persona** : tous à l'installation
- **Contexte** : App Store install, iOS ou Android, parfois web PWA
- **But** : afficher l'identité Kinhale + proposer la langue
- **Contenu** :
  - Fond ivoire chaud `#FAF8F4`
  - Wordmark Kinhale (Fraunces 600, 48 px), centré
  - Illustration sobre d'un cercle vert sauge qui se dessine (motif Kinhale) — 120 × 120 px
  - Sélecteur de langue : deux pastilles **Français** / **English**, présélection selon locale OS
  - CTA primaire « Continuer » / « Continue »
  - En pied : « Kamez Conseils · AGPL v3 » (body-sm ardoise `#6B7280`)
- **Actions** : tap pastille langue → mise à jour live ; « Continuer » → E1.02
- **États** : idle uniquement (écran transitionnel)
- **Responsive** : identique mobile/tablette ; sur desktop, wordmark + sélecteur centrés sur fond ivoire, max-width 640 px
- **a11y** : sélecteur langue = deux `<button aria-pressed>`, lu comme « Français, sélectionné » / « English, non sélectionné ». Wordmark avec `aria-label="Kinhale"`
- **i18n** : texte minimal, pas d'impact
- **Motion** : fade-in wordmark 300 ms + cercle qui se dessine 400 ms. `prefers-reduced-motion` → apparition instantanée.
- **Risques UX** : aucun majeur si la durée < 1.5 s. Si l'app force 3 s de splash, perception « lourd »
- **Règles** : DP10 (l'app s'efface dès l'accueil)

#### [2] E1.02 — Landing de bienvenue (3 slides)

- **ID** : `onboarding-welcome`
- **Route** : `/welcome`
- **Persona** : tous
- **Contexte** : premier lancement, avant choix de parcours
- **But** : présenter en 3 slides la promesse Kinhale (coordination, zero-knowledge, gratuit/open source)
- **Contenu** : carrousel horizontal 3 slides
  - **Slide 1** : illustration d'un cercle de 4 silhouettes diverses ; titre Fraunces « Coordonnez le soin, à plusieurs. » / « Care together, not alone. » ; body : « Le journal partagé des aidants d'un enfant asthmatique. »
  - **Slide 2** : illustration clé + appareil ; titre « Vos données restent chez vous. » / « Your data stays with you. » ; body : « Chiffrées sur vos appareils. Même nous ne pouvons pas les lire. »
  - **Slide 3** : illustration cœur trait souple + icône open source ; titre « Gratuit, open source, pour tous. » / « Free, open source, for everyone. » ; body : « Sous licence AGPL v3. Le code est public. »
  - Indicateur de page en bas (3 pastilles vert sauge / ardoise)
  - CTA primaire **« Commencer »** / **« Get started »**
  - Lien secondaire **« J'ai déjà un cercle »** → E1.11 (parcours B invité)
- **Actions** : swipe slide ← / → ; tap pastille ; « Commencer » → E1.03 (choix de parcours) ; « J'ai déjà un cercle » → E1.11 (scan QR)
- **États** : idle
- **Responsive** : mobile portrait = carrousel plein écran. Tablette/desktop = 3 colonnes en parallèle sur une seule page. Bouton primaire toujours visible.
- **a11y** : carrousel avec `aria-roledescription="carousel"`, pagination annoncée. Chaque slide = `<section aria-label="Étape X sur 3">`. Swipe + pagination clavier (← →). Bouton « Ignorer » accessible sans balayage.
- **i18n** : FR ~20 % plus long qu'EN, textes à 2 lignes max, taille slide doit absorber
- **Motion** : transition slide 250 ms ease-out. Pas de bounce. `prefers-reduced-motion` → transition instant.
- **Risques UX** : lecture obligatoire trop longue → bouton « Passer » discret en haut à droite
- **Règles** : DP3 (pas de peur, ton calme), DP4 (une action principale), UX research §5 MV1 (poser le terrain zero-knowledge dès ici)

#### [3] E1.03 — Choix de parcours (création vs rejoindre)

- **ID** : `onboarding-choose-path`
- **Route** : `/onboarding/choose`
- **Persona** : P1 Admin ou P2/P3/P4/P5 invité
- **Contexte** : sortie du welcome
- **But** : aiguiller vers parcours A (créer un cercle) ou parcours B (rejoindre via QR)
- **Contenu** :
  - Titre Fraunces « Comment souhaitez-vous commencer ? »
  - **Carte A** — « Je crée un cercle de soin » ; sous-titre « Vous êtes parent, grand-parent ou tuteur. Vous configurez Kinhale pour un enfant. » ; icône cercle souple vert sauge
  - **Carte B** — « Je rejoins un cercle » ; sous-titre « Quelqu'un vient de vous envoyer un code QR ou un code court. » ; icône QR terracotta… wait, non : icône QR **ardoise** (terracotta réservé secours, DP3)
  - Pied : « Vous pouvez changer plus tard depuis les paramètres » body-sm
- **Actions** : tap carte A → E1.04 ; tap carte B → E1.11
- **États** : idle
- **Responsive** : cartes pleine largeur mobile, côte à côte tablette/desktop
- **a11y** : chaque carte = `<button>` avec `aria-label` complet. Focus ring vert sauge 2 px offset 2 px.
- **i18n** : intitulés FR/EN de même longueur grâce aux titres courts
- **Motion** : hover tablette/desktop = subtile élévation (shadow-sm → shadow-md) sur 150 ms
- **Risques UX** : confusion « créer vs rejoindre » si la personne ne sait pas si elle est déjà invitée → la carte B mentionne explicitement « QR ou code court »
- **Règles** : UX research §0.4 (double parcours A + B validé), DP4 (2 choix clairs, pas 5)

#### [4] E1.04 — Parcours A, étape 1/7 — Consentement & magic link

- **ID** : `onboarding-a-consent`
- **Route** : `/onboarding/create/consent`
- **Persona** : P1 Admin
- **Contexte** : création du cercle
- **But** : recueillir le consentement explicite Loi 25 / RGPD + envoyer magic link
- **Contenu** :
  - Progress bar 1/7 (linear, ardoise → vert sauge)
  - Titre « Avant de commencer »
  - Body-lg « Kinhale traite les données de santé de votre enfant. Pour les protéger, nous demandons votre consentement explicite. »
  - **Résumé en 3 puces** :
    - Chiffrement sur vos appareils, illisible par Kamez
    - Hébergement Canada, instance gratuite opérée par Kamez Conseils
    - Vous pouvez exporter et supprimer vos données à tout moment
  - **Case 1 obligatoire (non pré-cochée)** : « Je déclare être le parent ou le titulaire de l'autorité parentale de l'enfant dont je vais enregistrer les prises. » (conformité §2.3, RGPD art. 8)
  - **Case 2 obligatoire (non pré-cochée)** : « J'accepte la politique de confidentialité et les conditions d'utilisation. » (lien vers E9.02 et E9.03)
  - **Case 3 optionnelle** : « J'accepte l'envoi de rapports d'anomalie anonymisés pour améliorer Kinhale. »
  - Champ email
  - CTA primaire « Recevoir mon lien de connexion » (grisé tant que cases 1+2 non cochées)
  - Liens secondaires : « Politique de confidentialité » → E9.02, « Conditions d'utilisation » → E9.03
- **Actions** : cocher cases, saisir email, envoyer → E1.05 attente
- **États** :
  - idle : form vide
  - invalid email : message inline ardoise « Cette adresse ne semble pas valide. »
  - cases non cochées : CTA grisé, pas d'erreur tant que non tenté
  - loading : spinner sur CTA
  - error serveur : toast ardoise « Problème temporaire. Réessayez dans quelques instants. » (jamais rouge plein écran, DP5)
- **Responsive** : form mono-colonne mobile, 640 px max desktop
- **a11y** : chaque case = checkbox native, label cliquable (`<label>` wrapping). Email = `<input type="email" autocomplete="email">`. Focus visible.
- **i18n** : consentements plus longs en FR (30 % en moyenne) → prévoir 3-4 lignes par case
- **Motion** : case cochée = coche vert sauge 200 ms qui se dessine
- **Risques UX** : longueur perçue du consentement. Décrochage si > 15 s de lecture
- **Règles** : conformité §4.2 (cases NON pré-cochées, granulaires), RM9, DP6, DP9

#### [5] E1.05 — Parcours A, étape 2/7 — Attente magic link

- **ID** : `onboarding-a-check-email`
- **Route** : `/onboarding/create/check-email`
- **Persona** : P1
- **But** : rassurer pendant le délai magic link
- **Contenu** :
  - Illustration d'une enveloppe qui arrive (trait souple vert sauge)
  - H1 Fraunces « Vérifiez vos emails »
  - Body-lg « Un lien de connexion a été envoyé à **elodie@exemple.ca**. Ouvrez-le sur cet appareil pour continuer. »
  - Body-sm ardoise « Il peut arriver dans les prochaines minutes. Vérifiez aussi votre dossier Indésirables. »
  - Lien secondaire « Renvoyer le lien » (grisé 30 s, puis actif)
  - Lien secondaire « Changer d'adresse email »
- **Actions** : user clique dans l'email → deep link ouvre E1.06 ; renvoyer ; changer
- **États** : idle, resend-cooldown (countdown 30 s visible), resend-sent (toast vert doux « Lien renvoyé »)
- **Responsive** : centré
- **a11y** : email visible dans la copie (contrast ≥ 4.5:1)
- **i18n** : FR 25 % plus long
- **Motion** : illustration enveloppe — petit mouvement de flap 400 ms une seule fois, puis statique
- **Risques UX** : email spam → bouton renvoyer + lien FAQ
- **Règles** : DP5, UX research §3 J1.4

#### [6] E1.06 — Parcours A, étape 3/7 — Création de profil enfant

- **ID** : `onboarding-a-child`
- **Route** : `/onboarding/create/child`
- **Persona** : P1
- **But** : saisir identité minimale de l'enfant (minimisation Loi 25 : prénom + année de naissance seulement, pas de date complète, spec 3.3)
- **Contenu** :
  - Progress 3/7
  - H1 « Parlez-nous de votre enfant »
  - Body-lg « Kinhale tourne autour de l'enfant pour qui vous coordonnez le soin. »
  - Champ « Prénom » (obligatoire, ≤ 50 car.)
  - Champ « Année de naissance » (sélecteur année uniquement, pas date complète — minimisation)
  - Bouton « Ajouter une photo » (optionnel, label explicite « Optionnel, ne quittera jamais votre appareil »)
  - Body-sm ardoise « Vous pourrez modifier ces informations plus tard. »
  - CTA primaire « Continuer »
- **Actions** : saisie, optionnel photo (camera/galerie), continuer → E1.07
- **États** : idle, avec photo, sans photo, champs vides
- **Responsive** : form mono-colonne
- **a11y** : prénom `<input type="text" autocomplete="given-name">`. Année `<select>` natif. Photo = bouton avec icône camera, `aria-label`.
- **i18n** : trivial
- **Motion** : si photo ajoutée, thumbnail fade-in 250 ms
- **Risques UX** : confusion « pas de date de naissance ? » → body-sm explique : « Nous n'avons besoin que de l'année pour vous accompagner »
- **Règles** : conformité §3 (minimisation), spec RM13, DP6

#### [7] E1.07 — Parcours A, étape 4/7 — Première pompe de fond

- **ID** : `onboarding-a-pump`
- **Route** : `/onboarding/create/first-pump`
- **Persona** : P1
- **But** : saisir la pompe de fond prescrite (champ libre, **pas de base médicamenteuse** — risque DM)
- **Contenu** :
  - Progress 4/7
  - H1 « Ajoutons la pompe de fond »
  - Body-lg « C'est la pompe que Léa prend tous les jours, matin et soir. »
  - Champ « Nom de la pompe » (placeholder : « ex : Flovent 125, Qvar 100… ») — **saisie libre**, pas d'auto-complétion (UX research §3 J1.7)
  - Sélecteur « Rôle » : Fond (sélectionné par défaut) / Secours
  - Champ « Doses par inhalation » (par défaut 1, min 1 max 4)
  - Champ « Nombre de doses dans cette pompe » (par défaut 120, modifiable, spec 3.4 `total_doses_initial`)
  - Champ « Date de péremption » (optionnel)
  - Body-sm « Le nom que vous tapez est une étiquette pour vous. Kinhale ne valide pas la prescription — c'est votre médecin qui prescrit. » (disclaimer non-DM RM27)
  - CTA primaire « Continuer »
  - Lien « Je n'ai pas de pompe de fond, juste une de secours »
- **Actions** : saisies, continuer → E1.08
- **États** : idle, validation inline sur nom vide
- **Responsive** : form mono-colonne
- **a11y** : tous les champs labellés, aide contextuelle accessible
- **i18n** : placeholder adapté FR-FR (« Ventoline », « Symbicort ») — via i18n keys
- **Motion** : confirmation visuelle de saisie validée par un léger trait vert sauge sous le champ
- **Risques UX** : utilisateur cherche son médicament dans une liste (apps concurrentes) → friction. Arbitrage : **champ libre** assumé et justifié en copy
- **Règles** : UX research §3 J1.7 (pas d'auto-complétion médicamenteuse), DP6, RM27

#### [8] E1.08 — Parcours A, étape 5/7 — Recovery seed

- **ID** : `onboarding-a-seed`
- **Route** : `/onboarding/create/security-words`
- **Persona** : P1 (et P2/P3 via parcours B plus tard)
- **Contexte** : moment de vérité MV1 — le plus critique de tout le produit
- **But** : générer, expliquer, vérifier les 12 mots de sécurité
- **Contenu** : **3 sous-écrans séquentiels** (E1.08a, E1.08b, E1.08c)

**E1.08a — Explication AVANT d'afficher la seed**

- H1 Fraunces « Vos mots de sécurité »
- Body-lg « Pour que personne — même nous — ne puisse lire les données de Léa, Kinhale va générer 12 mots rien qu'à vous. »
- Body « Ces 12 mots sont la clé qui permet de récupérer vos données si vous changez d'appareil. Sans eux, personne ne peut les retrouver — c'est le prix de votre vie privée. »
- Illustration sobre d'une clé trait souple, pas un cadenas agressif (branding §5.4)
- CTA primaire « Voir mes 12 mots »
- Lien secondaire « Je préfère le faire plus tard » (option de report avec rappel J+1, J+3 — UX research §6 Insight 3)

**E1.08b — Affichage de la seed (voir wireframe MV1 ci-dessus)**

- 12 mots BIP39, JetBrains Mono 18 px, grille 2 colonnes
- Toggle « Afficher / Masquer » (par défaut affiché, flou possible au screenshot — iOS `UIScreen.isCaptured`)
- Bouton « Imprimer » (génère PDF via print dialog OS)
- CTA primaire « J'ai noté mes mots » → E1.08c
- Lien « Je le ferai plus tard » (rappel silencieux)

**E1.08c — Vérification partielle (3 mots sur 12)**

- H1 « Vérifions ensemble »
- Body « Pour être sûr que vous les avez bien notés, remplissez 3 mots au hasard. »
- Affichage : « Quel est le **mot n°2** ? » → champ input + clavier mobile OK
- Répéter pour mots 7 et 11 (aléatoires)
- Si erreur : « Ce n'est pas le bon — pas grave, ouvrez votre carnet et essayez encore. » (ton calme, DP3)
- CTA primaire « Terminer »
- Lien « Recommencer »

- **Actions** :
  - 08a → « Voir » ouvre 08b, « plus tard » → skip avec marker à rappeler
  - 08b → « J'ai noté » → 08c
  - 08c → 3 corrects → E1.09, erreurs → re-essai (max 3 fois avant retour à 08b)
- **États** : idle, verified, retry, skipped
- **Responsive** : form mono-colonne ; tablette/desktop = même layout, max-width 640 px
- **a11y** :
  - Seed en JetBrains Mono avec `aria-label="Mot 1 sur 12 : orange"` sur chaque cellule
  - Toggle show/hide = switch `<button aria-pressed>`
  - Clavier : tab entre cellules dans l'ordre de lecture
  - VoiceOver annonce le numéro + mot
  - Respect `prefers-reduced-motion` sur le reveal
- **i18n** : seed en 2048 mots BIP39 FR standard (BIP39 français officiel) ou EN ; **pas de traduction automatique** — utiliser la wordlist officielle
- **Motion** : reveal de chaque mot en cascade (50 ms décalé), total 600 ms. Désactivé si `prefers-reduced-motion`.
- **Risques UX** : décrochage estimé 30-50 % si mal expliquée (UX research §3 J1.5). **Design critique**.
- **Règles** : DP2, DP9, UX research §5 MV1, branding §5.3 (JetBrains Mono localisé ici seulement)

#### [9] E1.09 — Parcours A, étape 6/7 — Plan de traitement initial

- **ID** : `onboarding-a-plan`
- **Route** : `/onboarding/create/plan`
- **Persona** : P1
- **But** : créer le plan de traitement initial avec valeurs par défaut saines (PRD §8.5)
- **Contenu** :
  - Progress 6/7
  - H1 « Quand donner la pompe de fond ? »
  - Body-lg « Les horaires que vous définissez déclencheront les rappels. Vous pourrez les modifier à tout moment. »
  - Sélecteur fréquence : **Matin et soir** (sélectionné par défaut) / Matin seulement / Soir seulement / Personnalisé
  - Champs horaires : **8:00** et **20:00** par défaut, pickers natifs OS, 24h ou AM/PM selon locale
  - Body-sm « Fenêtre de confirmation ±30 min par défaut. À ajuster dans les paramètres. »
  - CTA primaire « Continuer »
  - Lien « Je configurerai plus tard » → skip, plan créé avec valeurs défaut
- **Actions** : modifier horaires, continuer → E1.10
- **États** : idle, custom mode (ajout de créneaux)
- **Responsive** : form mono-colonne
- **a11y** : time picker natif accessible (pas de picker custom)
- **i18n** : format heure selon locale (24h FR / 12h EN US)
- **Motion** : none
- **Risques UX** : confusion fréquences avancées → arbitrage défaut = « matin + soir »
- **Règles** : spec W1 étape 7, RM2

#### [10] E1.10 — Parcours A, étape 7/7 — Invitation & finalisation

- **ID** : `onboarding-a-invite-and-done`
- **Route** : `/onboarding/create/invite`
- **Persona** : P1
- **But** : proposer d'inviter le co-parent maintenant ou plus tard, finaliser
- **Contenu** :
  - Progress 7/7
  - H1 Fraunces « Votre cercle est prêt. »
  - Illustration : le cercle de silhouettes avec une seule silhouette dedans (Élodie), 3 emplacements vides
  - Body-lg « Vous êtes la première personne à prendre soin de Léa ici. Souhaitez-vous inviter quelqu'un d'autre maintenant ? »
  - CTA primaire « Inviter un aidant » → E3.03 génération QR
  - CTA secondaire **« Plus tard »** → E2.01 accueil
- **Actions** : inviter → E3.03 ; plus tard → E2.01
- **États** : idle
- **Responsive** : illustration adaptative
- **a11y** : illustration `role="img" aria-label="Votre cercle de soin avec une personne — vous"`
- **i18n** : -
- **Motion** : illustration cercle souple 400 ms à l'entrée, puis statique
- **Risques UX** : pression à inviter → « Plus tard » doit être **aussi visible** que « Inviter »
- **Règles** : UX research §3 J2, DP4

#### [11] E1.11 — Parcours B, étape 1/4 — Scan QR ou saisie code

- **ID** : `onboarding-b-scan`
- **Route** : `/onboarding/join/scan`
- **Persona** : P2 Marc, P3 Lise, P4 Fatou, P5 Aïcha
- **Contexte** : invité à rejoindre un cercle, avec QR ou code court
- **But** : scanner QR ou saisir code à 6 chiffres
- **Contenu** :
  - H1 « Rejoindre un cercle de soin »
  - **Zone caméra plein viewfinder** (si permission accordée)
  - Overlay carré viewfinder 280 × 280 px avec 4 coins vert sauge
  - Hint « Pointez la caméra vers le QR code »
  - Lien texte **« J'ai un code court à 6 chiffres »** → switch vers saisie manuelle
  - **Mode saisie code** : 6 inputs JetBrains Mono 24 px style OTP ; CTA « Continuer »
- **Actions** : scan OK → E1.12 ; saisie code OK → E1.12 ; camera refusée → message avec lien vers paramètres OS
- **États** : idle, scanning, permission-denied, code-mode, error (code invalide/expiré)
- **Responsive** : plein écran mobile ; tablette = viewfinder centré 400 × 400 px ; desktop = mode saisie code principal (webcam optionnelle)
- **a11y** : bouton « switch to code input » accessible par tab. Champ code avec `aria-label="Chiffre 1 sur 6"` chacun.
- **i18n** : labels courts
- **Motion** : viewfinder coins qui pulsent doucement 2 s (respect `prefers-reduced-motion` → statique)
- **Risques UX** : permission caméra refusée → fallback code immédiat et visible
- **Règles** : UX research §0.4 (parcours B validé), conformité §4 (consentement au scan)

#### [12] E1.12 — Parcours B, étape 2/4 — Consentement à rejoindre

- **ID** : `onboarding-b-consent`
- **Route** : `/onboarding/join/consent`
- **Persona** : P2/P3/P4/P5
- **Contexte** : vient de scanner/saisir un code valide
- **But** : consentement explicite Loi 25/RGPD **au moment du scan** (UX research §0.4)
- **Contenu** : voir wireframe MV4 côté Lise ci-dessus
  - H1 « Élodie vous invite à rejoindre le cercle de soin de Léa »
  - « En rejoignant, vous pourrez : noter une prise, voir l'activité récente, recevoir les rappels »
  - Cases NON pré-cochées :
    - « Je comprends que les données santé de Léa resteront chiffrées sur mon appareil »
    - « J'accepte la politique de confidentialité »
    - « J'accepte de recevoir des rappels et notifications » (optionnelle)
  - Nom affiché dans le cercle (pré-rempli depuis l'invitation, modifiable — ex « Mamie Lise »)
  - CTA primaire « Rejoindre le cercle » (grisé tant que cases obligatoires non cochées)
  - Lien « Ce n'est pas moi »
- **Actions** : cocher, rejoindre → E1.13 ; « pas moi » → E1.11
- **États** : idle, invalid (cases), loading
- **Responsive** : form mono-colonne
- **a11y** : cases natives 28 × 28 px, touch ≥ 44 × 44 pt
- **i18n** : FR 25 % plus long
- **Motion** : cases cochées = coche 200 ms
- **Risques UX** : fatigue de lecture → résumé en 3 puces
- **Règles** : conformité §2.3 (RGPD art. 8), RM9, DP9, UX research §0.4

#### [13] E1.13 — Parcours B, étape 3/4 — Génération locale d'identité

- **ID** : `onboarding-b-identity`
- **Route** : `/onboarding/join/identity`
- **Persona** : P2/P3/P4/P5
- **But** : générer la clé privée locale + afficher recovery seed de l'aidant invité
- **Contenu** :
  - H1 « Nous préparons votre accès »
  - Loader discret (progress indéterminé, vert sauge)
  - Body « Kinhale génère sur votre appareil les clés qui protègent les données de Léa. Cela prend quelques secondes. »
  - Quand prêt → même composant que E1.08 (recovery seed), mais contextualisé pour aidant invité
  - Pour P3 Lise (non-tech) : **option « faire sauvegarder par un proche »** — génère un QR de partage sécurisé transmis à Élodie qui sauvegarde pour elle (UX research §3 J3.1, avec consentement explicite dans audit trail)
- **Actions** : voir mots, noter, verify → E1.14
- **États** : generating, ready, verified
- **Responsive** : idem E1.08
- **a11y** : loader avec `aria-live="polite"` annonçant progrès
- **i18n** : -
- **Motion** : loader simple fade-in 200 ms
- **Risques UX** : Lise décroche ici. Le **parcours assisté par Élodie** est la solution (UX research Insight 4)
- **Règles** : DP2, UX research §3 J3, Insight 4

#### [14] E1.14 — Parcours B, étape 4/4 — Bienvenue dans le cercle

- **ID** : `onboarding-b-done`
- **Route** : `/onboarding/join/done`
- **Persona** : P2/P3/P4/P5
- **But** : confirmer l'arrivée dans le cercle
- **Contenu** :
  - H1 Fraunces « Bienvenue dans le cercle de Léa »
  - Illustration cercle souple avec la nouvelle silhouette qui rejoint
  - Body « Vous pouvez maintenant noter une prise de pompe, voir l'activité récente, et recevoir des rappels. »
  - Liste des autres membres (avatars + rôles)
  - CTA primaire **« Voir l'accueil »** → E2.01 pour Contributeur, ou E2.02 kiosque pour Restreint
- **Actions** : aller à l'accueil
- **États** : idle
- **Responsive** : -
- **a11y** : illustration alt-text décrivant le cercle
- **i18n** : -
- **Motion** : nouvelle silhouette rejoint le cercle 400 ms fade+slide, puis statique
- **Risques UX** : -
- **Règles** : UX research §5 MV2, DP3 (ton chaleureux mais sobre)

#### [15] E1.15 — Autorisations système (notifications, caméra, biométrie)

- **ID** : `onboarding-permissions`
- **Route** : `/onboarding/permissions`
- **Persona** : tous
- **Contexte** : après entrée dans le cercle, avant first use
- **But** : demander les permissions iOS/Android contextualisées
- **Contenu** : 3 cartes séquentielles, une à la fois
  - **Carte 1 — Notifications** : icône horloge, « Pour les rappels du matin et du soir, Kinhale envoie une notification neutre. Aucune donnée santé n'y apparaît. » ; CTA « Autoriser » / lien « Plus tard »
  - **Carte 2 — Caméra** (si parcours B ou pour futurs QR) : icône caméra, « Pour scanner un QR d'invitation. » ; CTA « Autoriser » / « Plus tard »
  - **Carte 3 — Face ID / Touch ID / Empreinte** : icône empreinte, « Pour déverrouiller l'app rapidement sans mot de passe. » ; CTA « Activer » / « Plus tard »
- **Actions** : autoriser → prompt OS natif → passage à carte suivante ; « Plus tard » → passage suivant
- **États** : idle, prompted, granted, denied
- **Responsive** : centré
- **a11y** : les prompts OS sont natifs et accessibles par défaut
- **i18n** : textes courts
- **Motion** : transition entre cartes 250 ms slide horizontal
- **Risques UX** : demandes multiples en série peuvent agacer. **Arbitrage** : séparer dans le temps (1 par action future) ou tout de suite avec copy très courte. Recommandation : **tout de suite avec copy courte + option « Plus tard » visible**.
- **Règles** : DP1 (une chose à la fois), DP7 (contexte des notifications opaques)

#### [16] E1.16 — Tutorial rapide (3 écrans)

- **ID** : `onboarding-tutorial`
- **Route** : `/onboarding/tutorial`
- **Persona** : tous
- **But** : montrer en 3 écrans comment enregistrer une prise en 10 secondes
- **Contenu** : carrousel 3 slides
  - **Slide 1** : capture d'écran stylisée de l'accueil + flèche vers le CTA « J'ai donné la pompe » ; texte « Un tap suffit pour enregistrer une prise. »
  - **Slide 2** : capture de la prise de secours + flèche vers icônes symptômes ; texte « Pour une prise de secours, choisissez ce que Léa ressent. »
  - **Slide 3** : capture du journal ; texte « Retrouvez l'historique partagé avec votre cercle. »
  - Indicateur de page + CTA **« Commencer »** (sur le dernier slide) / « Passer » (sur les 2 premiers)
- **Actions** : swipe, passer, commencer → E2.01
- **États** : idle
- **Responsive** : images adaptatives
- **a11y** : chaque slide a un alt-text explicite
- **i18n** : légendes courtes
- **Motion** : transitions slide 250 ms
- **Risques UX** : -
- **Règles** : DP4, DP10

---

### FLOW 2 — Usage quotidien (journal & prises) — 7 écrans

#### [17] E2.01 — Accueil / tableau de bord du cercle

- **ID** : `home`
- **Route** : `/home`
- **Persona** : P1, P2, P3 (Contributeur)
- **Contexte** : cuisine, voiture, bureau, lit — matin, soir, entre les deux
- **But** : en 3 secondes, savoir où en est l'enfant et pouvoir enregistrer une prise en 1 tap
- **Contenu** (par ordre de hiérarchie visuelle) :
  1. **Bandeau offline** (si applicable) : chip ardoise « Hors ligne · 2 actions en attente » (DP5)
  2. **Identité enfant** : prénom « Léa · 5 ans » (Fraunces 24 px, centré) + photo optionnelle (48 × 48 px cercle souple, pas un avatar dur)
  3. **Carte « Prochaine prise »** : fond crème, titre ardoise « Prochaine prise du soir », heure grande « 20:00 » Fraunces 48 px, statut vert sauge « dans 4 h » ou ambre « en retard de 12 min »
  4. **CTA primaire** plein largeur ≥ 56 px : « Je viens de donner la pompe de fond » (vert sauge `#2F6B5A`)
  5. **CTA secondaire** plein largeur ≥ 48 px : « Pompe de secours » (outline terracotta `#B94A3E`, icône pompe rouge petite)
  6. **Section « Dans votre cercle »** (collapse collapsible sur mobile si écran petit) :
     - « ✓ Élodie, vous » (statut actuel)
     - « Marc a donné la pompe du matin à 07:42 »
     - « Mamie Lise — dernière activité il y a 2 h »
  7. **Disclaimer pied d'écran** : body-sm ardoise « Kinhale est un journal de suivi. Il ne remplace pas l'avis de votre médecin. » (spec RM27, conformité §12)
  8. **Tab bar** : Accueil (actif) · Journal · Plus
- **Actions** :
  - CTA fond → E2.03 (saisie rapide avec confirmation 5 s undo)
  - CTA secours → E2.06
  - tap carte prochaine prise → E5.01 rappels
  - tap activité cercle → E3.01 membres
  - tab Journal → E2.04
  - tab Plus → menu
- **États** :
  - idle
  - online
  - offline (bandeau)
  - en retard de prise (ambre `#C9883C` sur carte)
  - empty (pas de plan encore → E2.01-empty avec CTA « Créer un plan »)
  - loading (skeleton des cartes)
- **Responsive** :
  - mobile portrait : unique colonne
  - mobile paysage : 2 colonnes (carte + CTAs)
  - tablette : split 50/50 carte prochaine / cercle
  - desktop : sidebar gauche + main content + rail droit « cercle »
- **a11y** :
  - Le CTA primaire est annoncé en premier après le prénom de l'enfant
  - Statut « en retard » annoncé via `aria-live="polite"`
  - Contraste vert sauge sur ivoire : 6.8:1 (AAA)
- **i18n** : « Je viens de donner la pompe de fond » (FR) vs « I just gave the maintenance inhaler » (EN) — FR 12 % plus long, layout doit absorber
- **Motion** :
  - Carte « dernière prise » mise à jour : fade + slide from top 250 ms
  - CTA tap : échelle 98 % 100 ms puis retour, haptique légère (iOS `UIImpactFeedbackStyle.light`)
  - Statut en retard : icône horloge qui se remplit en ambre 400 ms, pas de pulse persistant (DP9)
- **Risques UX** :
  - Si CTA secours trop proche du CTA fond → risque de tap accidentel. Arbitrage : espacement ≥ 16 px + CTA secours en outline (moins proéminent) (DP4).
  - Affichage « dose manquée » ne doit pas culpabiliser. Mot exact : « Prise du soir non confirmée » (UX research §3 J6, branding §4.5).
- **Règles** : DP4, DP3, DP10, UX research §5 MV3

#### [18] E2.02 — Accueil kiosque (Contributeur restreint)

- **ID** : `home-kiosk`
- **Route** : `/home-kiosk`
- **Persona** : P4 Fatou, P5 Aïcha
- **Contexte** : CPE 12h05, 4 enfants autour, 5 secondes pour enregistrer
- **But** : 1 écran, 2 boutons max, session 8 h
- **Contenu** :
  - Prénom Léa + photo large (120 × 120 px) — Fraunces 32 px
  - Body-lg « Prise de midi prévue à 12:00 · dans 5 min »
  - CTA primaire ultra-large 72 px haut : « Je viens de donner la pompe de fond »
  - CTA secondaire 56 px : « Pompe de secours »
  - Pas de tab bar. Pas de menu.
  - Pied : « Session Kinhale CPE · expire à 18:00 » (body-sm ardoise)
  - Micro-lien « Quitter la session » en bas à droite (pas de déconnexion involontaire)
- **Actions** : CTA fond → E2.03 simplifié sans retour au journal (retour à E2.02) ; CTA secours → E2.06 ; quitter → confirmation
- **États** : idle, session expirée (redirige vers E1.11)
- **Responsive** : pensé tablette partagée (10-12") par défaut ; mobile OK
- **a11y** : texte énorme, contrastes AAA, feedback haptique + visuel très marqué
- **i18n** : FR primaire P4/P5
- **Motion** : confirmation de prise = coche vert sauge plein écran 600 ms, puis fade vers retour E2.02
- **Risques UX** : Aïcha ne doit **jamais** pouvoir sortir du cercle par erreur. Bouton « quitter » discret + confirmation forte.
- **Règles** : UX research §2.5, RM12 (session 8 h), DP1, DP4, DP10, Insight 5

#### [19] E2.03 — Saisie rapide (prise de fond)

- **ID** : `dose-fond`
- **Route** : `/dose/new/maintenance`
- **Persona** : tous sauf médecin
- **Contexte** : geste en 10 s
- **But** : confirmer une prise de fond avec heure, pompe, doses
- **Contenu** :
  - H1 « Prise de la pompe de fond »
  - Pompe sélectionnée (card grise avec nom) — si une seule : pré-sélectionnée ; sinon sélecteur
  - Heure : « Maintenant · 19:47 » avec lien « Modifier » (ouvre picker heure jusqu'à 24 h arrière — RM17)
  - Doses : par défaut valeur du plan (ex 1), modifiable par pastilles −/+
  - CTA primaire « Confirmer » vert sauge
  - Lien « Annuler »
- **Actions** : confirmer → toast undo 5 s + retour E2.01 ; modifier heure → picker
- **États** : idle, time-picker-open, loading, success (toast)
- **Responsive** : modale bottom-sheet mobile, centrée desktop
- **a11y** : champs labellés, heure en ISO 8601 sous-label accessible (`administered_at_local`)
- **i18n** : -
- **Motion** : confirmation = toast « Prise enregistrée » avec bouton « Annuler » glissant depuis le bas 250 ms, disparaît après 5 s
- **Risques UX** : si l'utilisateur veut juste annuler → bouton « Annuler » doit être clairement visible 5 s. Après 30 min → plus possible (RM18), message explicite.
- **Règles** : spec W2, RM14, RM15, RM17, RM18, DP4

#### [20] E2.04 — Détail d'une prise

- **ID** : `dose-detail`
- **Route** : `/dose/:id`
- **Persona** : P1/P2/P3
- **Contexte** : consultation historique
- **But** : voir tous les détails d'une prise, modifier ou voider si droit
- **Contenu** :
  - Header : type (fond/secours) avec chip couleur + heure + statut
  - Identité aidant : avatar + nom + rôle
  - Pompe utilisée + doses
  - Heure : « donnée à 19:47 » + si sync différée : « synchronisée à 20:03 »
  - Symptômes + circonstances (si secours)
  - Commentaire libre (si présent)
  - Source : « manuelle », « rattrapage », « depuis un rappel »
  - Hash intégrité (audit)
  - **Actions conditionnelles** :
    - si auteur et < 30 min : « Modifier », « Annuler la prise » (RM18)
    - si Admin : « Annuler la prise » (avec raison texte obligatoire)
  - Audit trail compact (3 dernières modifs)
- **Actions** : back → E2.04 journal ; modifier → E2.05 ; annuler → modale confirmation
- **États** : idle, editable, read-only, voided
- **Responsive** : mobile = plein écran ; desktop = side panel depuis journal
- **a11y** : sections labellées, audit trail accessible par expand collapse
- **i18n** : -
- **Motion** : none
- **Risques UX** : confusion « modifier vs annuler » → libellés explicites, raison obligatoire pour annuler Admin
- **Règles** : spec E5, RM18

#### [21] E2.05 — Correction d'une prise

- **ID** : `dose-edit`
- **Route** : `/dose/:id/edit`
- **Persona** : auteur (< 30 min) ou Admin
- **But** : modifier heure, doses, symptômes, note
- **Contenu** : form identique à E2.03/E2.06 mais pré-rempli avec valeurs actuelles, header « Modification d'une prise du 19 avril »
- **Actions** : enregistrer → retour E2.04 ; annuler → retour sans save
- **États** : idle, dirty, saving, saved
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : confirmation = toast discret
- **Risques UX** : si hors délai → désactivé avec message clair « Les prises ne peuvent plus être modifiées après 30 minutes. Seul l'Admin peut les annuler. »
- **Règles** : RM18

#### [22] E2.04bis — Journal complet filtrable

- **ID** : `journal`
- **Route** : `/journal`
- **Persona** : P1/P2/P3
- **But** : voir la timeline complète filtrable
- **Contenu** :
  - Header : **onglets Timeline / Calendrier**
  - Barre de filtres (chips) : « Toutes les pompes », « Fond », « Secours », « Cet aidant », sélecteur période
  - Timeline chronologique inversée, regroupement par jour
  - Chaque entrée = carte avec heure + icône pompe + nom aidant + statut
    - Fond confirmée : chip vert sauge
    - Secours : chip terracotta avec symptômes
    - Manquée : chip ambre « non confirmée »
    - Voided : chip ardoise barrée
  - Infinite scroll ou pagination desktop
  - Bouton flottant « Exporter » (Admin seul, lien vers E6.03)
- **Actions** : tap entrée → E2.04 détail ; filtres en temps réel ; scroll
- **États** : idle, loading (skeleton 7 cartes), empty (« Aucune prise enregistrée pour le moment »), offline (montre cache 30 jours)
- **Responsive** :
  - mobile : timeline 1 colonne
  - tablette : timeline + filtres en sidebar
  - desktop : 3 colonnes (filtres | timeline | détail side-panel)
- **a11y** : liste avec `role="list"`, chaque entrée `role="listitem"`. Filtres = toolbar. Scroll keyboard (arrow keys).
- **i18n** : dates localisées via `Intl.DateTimeFormat`
- **Motion** : entrée fade-in 200 ms
- **Risques UX** : -
- **Règles** : RM20 (30 jours offline), spec E4

#### [23] E2.04cal — Vue calendrier mensuelle

- **ID** : `journal-calendar`
- **Route** : `/journal/calendar`
- **Persona** : P1/P2
- **But** : repérer visuellement les oublis sur un mois
- **Contenu** :
  - Sélecteur de mois (flèches prev/next + label « Avril 2026 »)
  - Grille 7 × 5 ou 6 (selon mois)
  - Chaque case jour :
    - 2 points (matin/soir) si plan daily_twice
    - Point vert sauge = confirmé
    - Point ambre = non confirmé
    - Point ardoise barré = voided
    - Flamme terracotta = prise de secours ce jour (petite icône coin)
    - Aujourd'hui : cercle vert sauge autour
  - Légende en bas
- **Actions** : tap jour → ouvre détail jour (modale) ; swipe horizontal mois suivant/précédent
- **États** : idle, loading, empty
- **Responsive** : calendrier responsive, sur mobile peut basculer en liste accordéon
- **a11y** : grille `role="grid"`, chaque jour `role="gridcell"` avec `aria-label="19 avril, prise du matin confirmée, prise du soir non confirmée"`
- **i18n** : noms jours/mois locale
- **Motion** : slide mois 250 ms
- **Risques UX** : visualiser les oublis sans culpabiliser — pas de rouge vif, ambre seulement
- **Règles** : DP3, branding §5.2

#### [24] E2.06 — Prise de secours

- **ID** : `dose-secours`
- **Route** : `/dose/new/rescue`
- **Persona** : tous
- **Contexte** : enfant tousse, stress léger, geste sous 20 s
- **But** : documenter prise de secours avec symptômes (RM4)
- **Contenu** : voir wireframe MV5 ci-dessus
  - Header terracotta « Pompe de secours »
  - Section « Ce que Léa ressent » : grille 6 icônes multi-sélection (toux, sifflement, essoufflement, réveil, gêne thoracique, autre) — touch ≥ 88 × 88 pt
  - Section « Contexte » : grille 6 icônes (effort, allergène, rhume, nuit, fumée, autre)
  - Lien optionnel « Ajouter une note »
  - Heure (comme E2.03)
  - CTA primaire terracotta « Enregistrer la prise » — grisé tant que RM4 non satisfaite (au moins 1 symptôme OU 1 contexte)
  - Lien « Annuler »
- **Actions** : multi-select icônes, enregistrer → E2.01
- **États** : idle, invalid (RM4 non satisfaite, CTA grisé), saving, success
- **Responsive** : mobile portrait = grille 3 × 2 icônes, tablette 6 × 1
- **a11y** : chaque icône = `<button aria-pressed>` avec label texte sous icône (jamais icône seule)
- **i18n** : labels courts (« Toux », « Sifflement ») — pas de termes médicaux
- **Motion** : icône tap = scale 96→100 % + background terracotta fill 150 ms ; confirmation = toast discret, **pas de fanfare**
- **Risques UX** : paralysie si 20+ icônes (UX research §3 J6). **6 + "autre" max** par section.
- **Règles** : UX research §5 MV4, RM4, DP3, DP6, DP9

#### [25] E2.07 — Rattrapage d'une prise oubliée

- **ID** : `dose-backfill`
- **Route** : `/dose/new/backfill`
- **Persona** : P1/P2/P3
- **Contexte** : matin, réalise qu'hier soir la prise n'a pas été faite
- **But** : enregistrer une prise dans le passé jusqu'à 24 h (RM17)
- **Contenu** :
  - H1 « Rattraper une prise »
  - Body « Vous pouvez enregistrer une prise donnée il y a moins de 24 h. »
  - Time picker sophistiqué (date + heure) avec plage forcée [now-24h, now]
  - Sélecteur pompe + doses
  - Confirmation explicite : « Je confirme que cette prise a bien été donnée à [heure saisie]. »
  - CTA primaire « Enregistrer le rattrapage »
- **Actions** : saisir, confirmer → toast spécifique « Rattrapage enregistré à ... »
- **États** : idle, out-of-range (> 24 h = refus avec message), saving
- **Responsive** : modale
- **a11y** : time picker accessible natif
- **i18n** : format date/heure locale
- **Motion** : none
- **Risques UX** : utilisateur veut rattraper une prise d'il y a 3 jours → refus clair + explication
- **Règles** : RM17, spec W2 étape 4

---

### FLOW 3 — Cercle de soin & partage — 6 écrans

#### [26] E3.01 — Liste des membres du cercle

- **ID** : `circle`
- **Route** : `/circle`
- **Persona** : P1 (gestion) / P2/P3 (consultation)
- **But** : voir qui compose le cercle
- **Contenu** :
  - H1 « Cercle de soin de Léa »
  - Illustration cercle souple avec toutes les silhouettes
  - Liste des membres :
    - Avatar (initiale ou photo)
    - Nom affiché
    - Rôle (Admin, Famille proche, Garderie/nounou)
    - Statut (« Active maintenant », « Il y a 2 h »)
    - Chip « Vous » si c'est l'utilisateur courant
  - Section « Invitations en cours » (pour Admin)
  - CTA primaire « Inviter un aidant » (Admin uniquement)
- **Actions** : tap membre → E3.02 ; inviter → E3.03 ; tap invitation → modale détail
- **États** : idle, loading, empty (« Vous êtes seul(e) dans le cercle pour le moment »)
- **Responsive** : liste mobile, grille tablette/desktop
- **a11y** : liste accessible, statut `aria-live="polite"` pour mise à jour temps réel
- **i18n** : « Cercle de soin » / « Care circle »
- **Motion** : nouveau membre → fade-in 300 ms + avatar qui pulse une fois (subtile, 600 ms)
- **Risques UX** : -
- **Règles** : spec E8

#### [27] E3.02 — Détail d'un membre

- **ID** : `circle-member-detail`
- **Route** : `/circle/:memberId`
- **Persona** : P1 (toutes actions) / P2/P3 (lecture seule)
- **But** : voir stats d'un aidant et gérer son accès (si Admin)
- **Contenu** : voir wireframe MV7 ci-dessus
  - Avatar + nom + rôle
  - Dates (rejoint le, dernière activité)
  - Compteur « 14 prises enregistrées » (factuel, pas gamifié)
  - Actions Admin : modifier nom affiché, modifier rôle → E3.04, retirer → modale confirmation
  - Actions pour soi-même : modifier mon nom, quitter le cercle
- **Actions** : comme ci-dessus
- **États** : idle, self-view, admin-view
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : none
- **Risques UX** : retrait trop facile → modale confirmation forte + explications
- **Règles** : RM1 (Admin permanent), spec W11, UX research §5 MV7

#### [28] E3.03 — Inviter un nouvel aidant (génération QR)

- **ID** : `circle-invite`
- **Route** : `/circle/invite`
- **Persona** : P1 (Admin)
- **But** : générer QR + code court
- **Contenu** : voir wireframe MV4 ci-dessus (côté Élodie)
  - Sélecteur rôle (Famille proche / Garderie ou nounou)
  - Champ nom affiché pré-rempli
  - QR code 256 × 256 px
  - Code court à 6 chiffres JetBrains Mono 24 px
  - Expiration visible
  - Boutons « Partager le lien », « Imprimer »
- **Actions** : partager (sheet native), imprimer, copier code
- **États** : idle, generating, ready, expired (avec CTA « Regénérer »)
- **Responsive** : QR adaptatif, min 200 px
- **a11y** : QR avec texte alternatif = le code court ; instructions claires
- **i18n** : -
- **Motion** : génération QR = fade-in 300 ms
- **Risques UX** : confusion sur durée validité → compteur live
- **Règles** : spec W5, RM21 (max 10 invitations actives)

#### [29] E3.04 — Gérer les rôles

- **ID** : `circle-roles`
- **Route** : `/circle/:memberId/role`
- **Persona** : P1 Admin
- **But** : changer le rôle d'un membre
- **Contenu** :
  - H1 « Rôle de Marc »
  - Liste de rôles avec radio + description longue :
    - **Admin** — « Gère le cercle, invite des aidants, génère les rapports »
    - **Famille proche** — « Enregistre des prises, voit l'historique complet, reçoit les rappels »
    - **Garderie ou nounou** — « Enregistre une prise, voit la dernière prise seulement, session 8 h »
  - Note « Un cercle doit toujours avoir au moins 1 Admin. » (RM1)
  - Option « Transférer l'admin à... » (spécial, W11)
  - CTA « Enregistrer »
- **Actions** : sélection, enregistrer, cas spécial transfert admin
- **États** : idle, saving, last-admin-warning (« Vous êtes le seul Admin. Transférez d'abord. »)
- **Responsive** : -
- **a11y** : radio native
- **i18n** : -
- **Motion** : none
- **Risques UX** : libellés de rôles en langage de cuisine (DP6)
- **Règles** : RM1, spec W11, DP6

#### [30] E3.05 — Retirer un aidant (confirmation forte)

- **ID** : `circle-remove` (modale depuis E3.02)
- **Persona** : P1 Admin
- **But** : confirmer un retrait irréversible
- **Contenu** : voir wireframe MV7
  - H1 Fraunces « Retirer Mamie Lise ? »
  - Conséquences en 3 puces
  - CTA primaire terracotta « Confirmer le retrait »
  - Lien « Annuler »
- **Actions** : confirmer → side effects (audit, notif Lise, wipe local) + toast « Mamie Lise a été retirée »
- **États** : idle, confirming, done
- **Responsive** : modale
- **a11y** : modale avec `role="alertdialog"`, focus trapped, ESC pour fermer
- **i18n** : -
- **Motion** : slide-up 250 ms
- **Risques UX** : retrait accidentel — pas de swipe-to-delete, nécessite le tap explicite
- **Règles** : UX research §5 MV7

#### [31] E3.06 — Historique du cercle (audit log local)

- **ID** : `circle-audit`
- **Route** : `/circle/history`
- **Persona** : P1 Admin (RPRP local)
- **But** : voir les changements du cercle (membres rejoint/quittent, rôles modifiés, invitations)
- **Contenu** :
  - H1 « Historique du cercle »
  - Timeline chronologique inversée
  - Entrées : « 12 avril · Mamie Lise a rejoint en tant que Famille proche », « 18 avril · Invitation envoyée à la Garderie CPE »
  - Filtres : type d'événement, période
  - Export CSV (conformité)
- **Actions** : filtrer, exporter
- **États** : idle, loading, empty
- **Responsive** : -
- **a11y** : liste accessible
- **i18n** : -
- **Motion** : -
- **Risques UX** : -
- **Règles** : spec 3.11 audit trail, conformité §3 (RPRP access)

---

### FLOW 4 — Pompes & plan de traitement — 4 écrans

#### [32] E4.01 — Liste des pompes

- **ID** : `pumps`
- **Route** : `/pumps`
- **Persona** : P1 (CRUD) / autres (lecture)
- **But** : voir les pompes actives et leur niveau
- **Contenu** :
  - H1 « Pompes de Léa »
  - Cartes par pompe :
    - Icône pompe (vert sauge fond / terracotta secours)
    - Nom commercial
    - Type (fond/secours)
    - Barre de doses restantes (vert sauge → ambre dès seuil → terracotta à vide)
    - Péremption si applicable
    - Statut
  - CTA « Ajouter une pompe » (Admin)
  - Onglet « Pompes retirées » (historique)
- **Actions** : tap carte → E4.02 ; ajouter → E4.03
- **États** : idle, low (ambre chip), empty pump (terracotta chip + CTA « Remplacer »), expiring soon
- **Responsive** : -
- **a11y** : barre doses avec `aria-valuenow` `aria-valuemax`
- **i18n** : -
- **Motion** : barre doses = transition width 300 ms quand mise à jour
- **Risques UX** : seuil « pompe bientôt vide » → ambre, pas rouge
- **Règles** : spec E7, RM7, RM19

#### [33] E4.02 — Détail d'une pompe

- **ID** : `pump-detail`
- **Route** : `/pumps/:id`
- **Persona** : P1 / autres
- **But** : voir détails + actions
- **Contenu** :
  - Header : nom commercial + icône + type
  - Infos : substance active (info), dose/inhalation, doses initiales, doses restantes (+ barre), péremption
  - Date ajout + date péremption
  - Photo optionnelle de la boîte (utile pour Lise qui peut identifier visuellement)
  - Historique des 5 dernières prises sur cette pompe
  - Actions Admin : Modifier, Remplacer (→ E4.03), Archiver
- **Actions** : comme ci-dessus
- **États** : idle, active, expired, replaced, empty
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : pompe expirée → refus de saisie nouvelle prise + CTA « Remplacer » (W7)
- **Règles** : spec W7, RM19

#### [34] E4.03 — Ajouter / éditer une pompe

- **ID** : `pump-form`
- **Route** : `/pumps/new` ou `/pumps/:id/edit`
- **Persona** : P1 Admin
- **But** : saisir informations pompe
- **Contenu** :
  - Champ nom commercial (libre, pas auto-complétion — UX research §3 J1.7)
  - Sélecteur type (Fond/Secours)
  - Champs doses par inhalation, doses totales initiales
  - Date péremption (optionnelle)
  - Upload photo boîte (optionnel, stockée chiffrée localement)
  - CTA primaire « Enregistrer »
- **Actions** : saisir, enregistrer → E4.02 ou E4.01
- **États** : idle, dirty, saving
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : -
- **Règles** : spec E7, DP6

#### [35] E4.04 — Plan de traitement

- **ID** : `plan`
- **Route** : `/plan`
- **Persona** : P1 Admin
- **But** : visualiser et ajuster les prises prévues hebdo (saisie libre, pas de recommandation)
- **Contenu** :
  - H1 « Plan de Léa »
  - Plan actif : pompe + fréquence (Matin+Soir / Matin / Soir / Personnalisé) + heures + doses par prise + date de début
  - Bouton « Modifier »
  - Section « Plans précédents » (archivés)
  - Disclaimer : « Kinhale ne recommande pas de dose. Suivez les consignes de votre médecin. » (RM27, non-DM)
- **Actions** : modifier → form similaire à E1.09, pause, reprise, remplacement
- **États** : idle, paused, completed
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : dérive DM si formulation type « recommandé » — **interdit**
- **Règles** : RM3 (pas de plan sur secours), RM27, DP6, spec E6

---

### FLOW 5 — Rappels & notifications — 4 écrans

#### [36] E5.01 — Liste des rappels configurés

- **ID** : `reminders`
- **Route** : `/reminders`
- **Persona** : P1 Admin
- **But** : voir les rappels actifs et leur planning
- **Contenu** :
  - H1 « Rappels »
  - Liste des rappels par pompe × heure :
    - « Pompe de fond · Matin 08:00 · Notifie tout le cercle »
    - « Pompe de fond · Soir 20:00 · Notifie tout le cercle »
  - CTA « Ajouter un rappel »
- **Actions** : tap → E5.02 édition ; ajouter → E5.02 création
- **États** : idle, empty (« Aucun rappel. Voulez-vous en créer un ? »)
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : -
- **Règles** : spec §9

#### [37] E5.02 — Ajouter / éditer un rappel

- **ID** : `reminder-form`
- **Route** : `/reminders/new` ou `/reminders/:id/edit`
- **Persona** : P1 Admin
- **But** : configurer un rappel
- **Contenu** :
  - Sélecteur pompe (parmi pompes de fond actives)
  - Sélecteur fréquence : Quotidien / Matin+Soir / Personnalisé
  - Time picker heure(s)
  - Sélecteur aidants à notifier (tous, ou liste à cocher)
  - Fenêtre de tolérance (par défaut ±30 min, RM2)
  - Options avancées (dépliables) : canal de rappel (push, local, email fallback)
  - CTA primaire « Enregistrer »
- **Actions** : comme ci-dessus
- **États** : idle, dirty, saving
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : trop d'options → cacher le avancé par défaut (DP2)
- **Règles** : RM2, RM25 (max 2 relances)

#### [38] E5.03 — Écran de notification reçue (in-app)

- **ID** : `notification-detail`
- **Route** : `/notifications/:id`
- **Persona** : tous
- **But** : voir le contenu de la notification après ouverture (détail chiffré localement)
- **Contenu** : voir wireframe MV3
  - Header sobre : type de notif (Rappel / Dose manquée / Prise par un autre / Pompe faible / Double saisie)
  - Corps factuel : « Prise du soir donnée par Marc à 19:47 »
  - Liens d'action :
    - « Voir le détail » → E2.04
    - Selon type : « Je viens de donner la pompe » (en cas de rappel non-confirmé) ; « Résoudre le conflit » (cas double saisie)
- **Actions** : contextuelles
- **États** : idle
- **Responsive** : -
- **a11y** : `aria-live="polite"` pour in-app banner
- **i18n** : -
- **Motion** : slide-in depuis le haut 300 ms
- **Risques UX** : notif opaque non comprise → éduquer à l'onboarding (UX research Insight 7)
- **Règles** : DP7, RM5, RM16

#### [39] E5.04 — Paramètres de notifications

- **ID** : `notification-preferences`
- **Route** : `/settings/notifications`
- **Persona** : tous
- **But** : opt-in/opt-out granulaire
- **Contenu** :
  - Section « Canaux »
    - Toggle Push (OS) — défaut on
    - Toggle Notifications locales (OS) — défaut on
    - Toggle Email fallback — défaut on
  - Section « Types » (chaque type avec description)
    - Rappel — opt-in on
    - Dose manquée — **non désactivable** (sécurité, spec §9)
    - Prise par un autre — opt-in on
    - Pompe faible — opt-in on (Admin)
    - Double saisie — opt-in on
    - Sécurité — **non désactivable**
  - Section « Heures de calme » : plage horaire (ex 22:00-07:00), toggle on/off ; note « Sauf dose manquée tardive pour votre sécurité »
- **Actions** : toggles, enregistrer auto
- **États** : idle, saving
- **Responsive** : -
- **a11y** : switches natives
- **i18n** : -
- **Motion** : -
- **Risques UX** : désactivation en masse → garde-fou sur missed_dose et security
- **Règles** : spec §9

---

### FLOW 6 — Profil enfant & exports — 4 écrans

#### [40] E6.01 — Fiche enfant

- **ID** : `child`
- **Route** : `/child`
- **Persona** : P1 (édition) / autres (lecture)
- **But** : voir et modifier les infos enfant
- **Contenu** :
  - Avatar large + prénom (Fraunces 32 px)
  - Âge (calculé depuis année de naissance)
  - Section « Allergènes connus » (texte libre, non clinique — PRD §7.1)
  - Section « Photo » (avec option « Floue / Nette / Pas de photo »)
  - Bouton « Modifier » (Admin)
- **Actions** : modifier → E6.02
- **États** : idle, empty (pas de photo)
- **Responsive** : -
- **a11y** : photo avec alt-text
- **i18n** : -
- **Motion** : -
- **Risques UX** : photo → prompt explicite (UX research §2.6 « photo optionnelle, floue ou absente par défaut »)
- **Règles** : spec E9, conformité §3 minimisation

#### [41] E6.02 — Édition fiche enfant

- **ID** : `child-edit`
- **Route** : `/child/edit`
- **Persona** : P1 Admin
- **But** : modifier champs
- **Contenu** : form (prénom, année, photo, allergènes texte libre)
- **Actions** : enregistrer → E6.01
- **États** : idle, dirty, saving
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : RM13 (un seul enfant v1.0) — pas d'option « Ajouter enfant »
- **Règles** : RM13, conformité §3

#### [42] E6.03 — Export PDF pour médecin

- **ID** : `export-report`
- **Route** : `/export`
- **Persona** : P1 Admin seul
- **But** : générer PDF en 1 clic
- **Contenu** : voir wireframe MV6 ci-dessus
  - Sélecteur période (30j / 3 mois / personnalisée)
  - Sélecteur destinataire (Pour moi / Pour un médecin)
  - Aperçu miniature PDF
  - Infos : taille, nombre pages, hash intégrité
  - CTAs : Télécharger PDF, Envoyer par email, Télécharger CSV
  - Disclaimer : « Le document inclut une mention indiquant qu'il ne constitue ni un diagnostic ni une recommandation médicale. » (RM27)
- **Actions** : générer → download/email
- **États** : idle, generating (progress bar), done (CTAs visibles), error
- **Responsive** : -
- **a11y** : aperçu PDF avec alt-text synthétique
- **i18n** : PDF généré en langue du foyer
- **Motion** : génération = progress discret
- **Risques UX** : génération > 5 s → message « Nous préparons votre rapport, nous vous l'enverrons par email. » (async)
- **Règles** : UX research §5 MV6, spec W9, RM24, RM27

#### [43] E6.04 — Historique des exports

- **ID** : `export-history`
- **Route** : `/export/history`
- **Persona** : P1 Admin
- **But** : voir exports passés
- **Contenu** :
  - Liste des exports avec date, période couverte, format, destinataire, hash intégrité tronqué
  - Bouton « Télécharger à nouveau » (si lien signé non expiré)
  - Bouton « Révoquer le lien » (si envoyé par email et partagé)
- **Actions** : comme ci-dessus
- **États** : idle, empty
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : -
- **Règles** : spec 3.12

---

### FLOW 7 — Paramètres & sécurité — 8 écrans

#### [44] E7.01 — Paramètres principal

- **ID** : `settings`
- **Route** : `/settings`
- **Persona** : tous
- **But** : hub paramètres
- **Contenu** : liste sections avec icônes
  - Mon profil d'aidant → E7.02
  - Sécurité → E7.03
  - Biométrie / PIN → E7.04
  - Sauvegarde → E7.05
  - Récupération → E7.06
  - Mes appareils → E7.07
  - Préférences → E7.08
  - Notifications → E5.04
  - Cercle → E3.01
  - Plan de traitement → E4.04
  - Informations légales → Flow 9
  - **Exporter mes données** (bouton)
  - **Supprimer mon compte** (bouton, modale confirmation forte)
- **Actions** : navigation
- **États** : idle
- **Responsive** : -
- **a11y** : liste navigation
- **i18n** : -
- **Motion** : -
- **Risques UX** : suppression trop facile → modale avec mot « SUPPRIMER » à retaper (spec W10)
- **Règles** : spec E11, conformité §4

#### [45] E7.02 — Mon profil d'aidant

- **ID** : `profile`
- **Route** : `/settings/profile`
- **Persona** : tous
- **But** : gérer mon identité dans le cercle
- **Contenu** :
  - Avatar + bouton « Changer »
  - Nom affiché dans le cercle (modifiable, ex « Maman »)
  - Langue FR / EN (radio)
  - Email (lecture seule, magic link réinitialisation séparée)
  - Action « Quitter le cercle » (avec garde-fou RM1)
- **Actions** : modifier, enregistrer, quitter
- **États** : idle, saving
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : -
- **Règles** : -

#### [46] E7.03 — Sécurité (gestion recovery seed)

- **ID** : `security`
- **Route** : `/settings/security`
- **Persona** : tous sauf restreint
- **But** : gérer les mots de sécurité
- **Contenu** :
  - H1 « Sécurité »
  - Section « Mots de sécurité »
    - « Vos 12 mots ont été créés le 19 avril 2026 »
    - Bouton **« Afficher à nouveau mes mots »** (derrière double auth : Face ID + PIN ou mot de passe magic link)
    - Bouton **« Régénérer mes mots »** (rotation de clés — avertissement : « Les anciens mots ne fonctionneront plus »)
  - Section « Conseils pour sauvegarder vos mots » (mini FAQ)
  - Lien « Je n'ai plus mes mots » → E8.04 seed perdue
- **Actions** : comme ci-dessus
- **États** : idle, auth-required, showing-seed, regenerating
- **Responsive** : -
- **a11y** : auth prompts natifs
- **i18n** : -
- **Motion** : seed reveal avec fade-in progressif 600 ms
- **Risques UX** : exposition accidentelle → double auth + screen capture blocking
- **Règles** : DP2, UX research §5 MV1

#### [47] E7.04 — Biométrie / PIN

- **ID** : `biometrics`
- **Route** : `/settings/biometrics`
- **Persona** : tous
- **But** : gérer verrouillage app (Face ID / empreinte / PIN)
- **Contenu** :
  - Toggle « Déverrouillage biométrique » (selon support OS)
  - Bouton « Configurer un PIN de 4 chiffres » (fallback)
  - Sélecteur délai avant re-lock (1 min / 5 min / 15 min / Jamais)
- **Actions** : toggles, PIN setup
- **États** : idle, setting-pin, disabled (OS unsupported)
- **Responsive** : -
- **a11y** : prompts OS natifs
- **i18n** : -
- **Motion** : -
- **Risques UX** : -
- **Règles** : spec §8 chiffrement local, conformité §3

#### [48] E7.05 — Sauvegarde (export chiffré local)

- **ID** : `backup`
- **Route** : `/settings/backup`
- **Persona** : P1 Admin
- **But** : exporter la base locale chiffrée vers un fichier externe
- **Contenu** :
  - Explication : « Kinhale vous permet d'exporter une copie chiffrée de votre cercle. Vous pourrez la restaurer sur un nouvel appareil avec vos 12 mots de sécurité. »
  - Dernière sauvegarde : date/heure
  - Bouton « Créer une nouvelle sauvegarde »
  - Liste des sauvegardes récentes
- **Actions** : créer, télécharger, supprimer
- **États** : idle, generating, done
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : confusion sauvegarde vs export PDF → libellés distincts, section séparée
- **Règles** : spec §8

#### [49] E7.06 — Récupération depuis seed

- **ID** : `restore`
- **Route** : `/restore` (hors auth)
- **Persona** : tous (changement d'appareil)
- **But** : restaurer sur nouvel appareil à partir des 12 mots
- **Contenu** :
  - H1 « Récupérer mes données »
  - Body « Saisissez vos 12 mots de sécurité dans l'ordre. »
  - 12 cellules JetBrains Mono vides
  - Auto-complétion depuis la wordlist BIP39 (prévention des fautes de frappe)
  - CTA « Restaurer »
  - Lien « Je n'ai pas mes 12 mots » → E8.04
- **Actions** : saisie, restore → loading + E2.01
- **États** : idle, validating, success, invalid-words
- **Responsive** : -
- **a11y** : chaque cellule avec `aria-label="Mot 1 sur 12"` ; clavier accessible
- **i18n** : wordlist FR ou EN selon locale
- **Motion** : restoration progress bar
- **Risques UX** : fautes de frappe → auto-complétion dès 2-3 lettres
- **Règles** : DP2, spec §8 MASVS

#### [50] E7.07 — Mes appareils connectés

- **ID** : `devices`
- **Route** : `/settings/devices`
- **Persona** : tous
- **But** : voir et révoquer les appareils liés à mon identité
- **Contenu** :
  - Liste des appareils :
    - Icône (iPhone / iPad / Android / Web)
    - Nom (« iPhone d'Élodie »)
    - Dernière activité
    - Cet appareil : chip « Actuel »
  - Action « Déconnecter cet appareil » (tous sauf courant)
- **Actions** : révoquer
- **États** : idle, revoking
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : suppression accidentelle → confirmation
- **Règles** : -

#### [51] E7.08 — Préférences générales

- **ID** : `preferences`
- **Route** : `/settings/preferences`
- **Persona** : tous
- **But** : langue, thème, registre, accessibilité
- **Contenu** :
  - Langue (FR / EN)
  - Thème (Clair / Sombre / Auto)
  - Vouvoiement (défaut on FR, explication « Kinhale s'adresse à vous avec vouvoiement par défaut »)
  - Accessibilité :
    - Taille texte globale (Normal / Grande / Très grande)
    - Contraste élevé
    - Réduction des animations (miroir `prefers-reduced-motion`)
    - Feedback haptique (on / off)
  - Unités / formats (heure 24h / 12h, date format)
- **Actions** : toggles, sélecteurs
- **États** : idle, saving
- **Responsive** : -
- **a11y** : tous les contrôles natifs, labels explicites
- **i18n** : -
- **Motion** : thème switch = transition color 400 ms
- **Risques UX** : -
- **Règles** : branding §4.2, DP8

---

### FLOW 8 — États critiques & edge cases — 6 écrans

#### [E8.01] Mode hors-ligne (bandeau transverse)

- **Persona** : tous
- **Contexte** : CPE sous-sol, métro, zone blanche
- **But** : signaler discrètement + permettre saisie
- **Contenu** : **chip en haut de tous les écrans** (120 × 28 px)
  - Icône nuage barré
  - Texte « Hors ligne · 2 actions en attente de sync »
  - Tap → ouvre E8.06 détail file d'attente
- **Règles** : DP5, UX research §2.5 Insight 5, RM20

#### [E8.02] Conflit de synchronisation

- **Route** : `/sync/conflict/:id`
- **Persona** : aidants concernés
- **But** : résoudre une double saisie détectée (RM6)
- **Contenu** :
  - H1 « Deux prises enregistrées proches »
  - Body factuel : « Lise a enregistré une prise à 08:02. Vous avez enregistré une prise à 08:10 (rattrapage). Est-ce que ce sont deux prises différentes ou un doublon ? »
  - Carte A : « 08:02 · Lise · pompe de fond »
  - Carte B : « 08:10 · Moi · rattrapage »
  - 3 choix :
    - **Conserver les deux** (elles sont différentes)
    - **Garder celle de Lise, annuler la mienne**
    - **Garder la mienne, annuler celle de Lise**
  - CTA « Valider ma décision »
- **Actions** : sélection, valider → synchro, audit, notif
- **États** : idle, resolving, resolved
- **Responsive** : -
- **a11y** : radio natives
- **i18n** : -
- **Motion** : -
- **Risques UX** : décision silencieuse side-effects forts → libellés explicites
- **Règles** : RM6, UX research §3 J4

#### [E8.03] Notification ratée / manquée (dose manquée)

- **Route** : `/notifications/missed-dose/:id`
- **Persona** : tous
- **But** : expliquer + proposer actions (spec W4)
- **Contenu** :
  - Header ambre (pas rouge)
  - H1 « Prise du soir non confirmée »
  - Body « À 20:30, aucune prise du soir n'avait été enregistrée. »
  - 3 CTA :
    - **« Je l'ai donnée »** → time picker jusqu'à 24h → E2.07 rattrapage
    - **« Non, elle a été oubliée »** → marque manquée, visible en gris dans le journal
    - **« Je vais la donner maintenant »** → E2.03 saisie rapide
  - Section FAQ « Pourquoi cette notification ? » (discret)
- **Actions** : comme ci-dessus
- **États** : idle, resolving
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : culpabilisation. Microcopie factuelle, **pas** « vous avez oublié » (UX research §3 J6, branding §4.5).
- **Règles** : DP3, DP9, RM25, spec W4

#### [E8.04] Recovery seed perdue

- **Route** : `/recovery/seed-lost`
- **Persona** : tous
- **But** : avertissement honnête
- **Contenu** :
  - H1 Fraunces « Vos mots de sécurité »
  - Body-lg « Si vous avez perdu vos 12 mots, voici ce que cela implique : »
  - 3 puces
    - « Les données de Léa qui sont **sur votre appareil actuel** resteront accessibles tant que vous ne le réinitialisez pas. »
    - « Vous ne pourrez **pas** les récupérer sur un nouvel appareil. »
    - « **Même Kamez ne peut pas les retrouver pour vous** — c'est le prix de votre vie privée. »
  - Actions :
    - **« Régénérer de nouveaux mots »** (fait une rotation de clés, réinvite tous les aidants)
    - **« Consulter l'aide »** → FAQ E9.04
    - Lien discret « J'ai retrouvé mes mots »
- **Actions** : comme ci-dessus
- **États** : idle, regenerating
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : -
- **Risques UX** : **ton non-culpabilisant**, factuel, honnête (DP3). Ne pas dire « C'est de votre faute ».
- **Règles** : DP2, DP3, branding §1.3 (valeur *Confiance*)

#### [E8.05] Erreurs globales (réseau, serveur, version obsolète)

- **Routes** : modales contextuelles
- **Persona** : tous
- **But** : informer sans faire peur
- **Variantes** :
  - **Erreur réseau temporaire** : toast ardoise « Connexion instable. Vos modifications seront synchronisées. » (pas de rouge, DP5)
  - **Serveur indisponible (5xx)** : modale calme « Notre relais est temporairement indisponible. Vos données locales sont préservées. Nous reviendrons dès que possible. »
  - **Version obsolète** : écran plein « Mise à jour nécessaire » avec CTA « Mettre à jour » (deep link store) et explication brève ; si update critique (sécurité), force obligation
- **États** : selon variante
- **Responsive** : -
- **a11y** : -
- **i18n** : -
- **Motion** : slide-up modale 250 ms
- **Risques UX** : panique inutile → microcopie sobre
- **Règles** : DP3, DP5

#### [E8.06] Écrans vides (empty states)

- **Variantes** :
  - **Cercle seul** : « Vous êtes seul(e) dans le cercle. Invitez un aidant pour partager le suivi de Léa. » + CTA invite
  - **Journal vide** : « Aucune prise enregistrée pour le moment. Dès la première prise, l'historique apparaîtra ici. »
  - **Aucun rappel** : « Aucun rappel actif. Créez-en un pour être alerté aux heures de prise. »
  - **Aucun export** : « Aucun rapport généré. Préparez un résumé pour votre rendez-vous médical. »
  - **Aucune pompe** : « Ajoutez la pompe que Léa utilise. »
- **Éléments communs** : illustration sobre (branding §5.5), texte factuel, CTA primaire clair
- **Règles** : DP3, DP10

#### [E8.06bis] File de synchronisation en attente

- **Route** : `/sync/queue`
- **Persona** : tous
- **But** : transparence sur les actions en attente
- **Contenu** :
  - Liste des événements locaux non synchronisés : type, date saisie, état
  - Bouton « Forcer la synchronisation » (si en ligne)
  - Liste des conflits en attente de résolution (liens vers E8.02)
- **États** : idle, syncing, all-synced
- **Règles** : spec E13, RM15

---

### FLOW 9 — Informations légales & support — 5 écrans

#### [47] E9.01 — À propos / version / licence

- **ID** : `about`
- **Route** : `/settings/about`
- **But** : transparence produit
- **Contenu** :
  - Logo Kinhale + wordmark
  - Version (ex 1.0.3)
  - Licence AGPL v3 (avec lien public vers LICENSE)
  - Lien « Code source sur GitHub »
  - Manifeste court (branding §1.4)
  - Coordonnées Kamez Conseils
  - Hash du build en JetBrains Mono (pour auditabilité)
- **Règles** : branding §1.4, §7

#### [48] E9.02 — Politique de confidentialité (zero-knowledge en langage clair)

- **ID** : `privacy-policy`
- **Route** : `/legal/privacy`
- **But** : expliquer le zero-knowledge en langage clair
- **Contenu** :
  - Résumé en 4 puces au top :
    - « Vos données restent chiffrées sur vos appareils. »
    - « Même Kamez ne peut pas les lire. »
    - « Hébergées au Canada (ca-central-1). »
    - « Exportables et supprimables à tout moment. »
  - Sections (expand/collapse) :
    - Quelles données sont collectées
    - Qui peut y accéder
    - Combien de temps elles sont conservées
    - Vos droits (accès, rectification, effacement, portabilité, opposition, limitation)
    - Comment exercer vos droits (email `privacy@kinhale.health` + RPRP)
    - Transferts internationaux
    - Modifications de la politique
  - Version + hash SHA-256 tronqué visible
- **Règles** : conformité §4, §6

#### [49] E9.03 — Conditions d'utilisation

- **ID** : `terms`
- **Route** : `/legal/terms`
- **But** : CGU
- **Contenu** : sections CGU avec disclaimer non-DM explicite et emphase (RM27)
- **Règles** : RM27, conformité §6

#### [50] E9.04 — Centre d'aide / FAQ

- **ID** : `help`
- **Route** : `/help`
- **But** : auto-support
- **Contenu** :
  - Champ recherche
  - Catégories : Démarrer · Inviter un aidant · Rappels et notifications · Sécurité et mots de sécurité · Récupération · Rapport médecin · Facturation (N/A) · Contact
  - Chaque article collapsible avec body court
- **Règles** : -

#### [51] E9.05 — Contact / signalement de vulnérabilité

- **ID** : `contact-security`
- **Route** : `/help/security`
- **But** : signaler un problème de sécurité
- **Contenu** :
  - H1 « Signaler un problème de sécurité »
  - Body « Kinhale prend la sécurité très au sérieux. Si vous avez découvert une vulnérabilité, merci de nous écrire à **security@kinhale.health**. Nous répondons sous 48h ouvrables. »
  - Clé publique PGP Kamez (pour chiffrement optionnel)
  - Lien vers la page `/.well-known/security.txt`
  - Politique de divulgation responsable
  - Formulaire fallback (pour les non-techniques)
- **Règles** : CLAUDE.md *« signaler toute vulnérabilité à `security@kinhale.health` »*

---

## 5. Composants UI récurrents

Ces patterns seront transformés en composants Tamagui par le design-system (livrable suivant). Ils sont listés ici avec leurs variantes, pour passage direct à la tokenisation.

| Composant | Variantes | Usage | Règles |
|---|---|---|---|
| `Button` | primary vert sauge / primary terracotta / secondary outline / tertiary text / danger | CTA principaux et secondaires | DP1 (≥ 56 px) |
| `CTACard` | routine vert sauge / secours terracotta / attention ambre / voided ardoise barré | Résumé de prise | DP3, DP4 |
| `MemberChip` | avatar + nom + rôle + statut | Affichage d'un aidant dans listes | - |
| `DoseTimeline` | timeline jour + chips prises | Journal | spec E4 |
| `DoseStatusChip` | vert sauge confirmed / ambre missed / terracotta rescue / ardoise voided | Statut prise | branding §5.2 |
| `PumpLevelBar` | vert sauge → ambre → terracotta selon doses restantes | Niveau pompe | RM7, RM19 |
| `FABRecord` | bouton flottant 72×72 px sur kiosque, haptic | Raccourci saisie | DP4, DP1 |
| `OfflineBadge` | chip top-bar | Statut réseau | DP5, RM20 |
| `ConfirmationModal` | modale confirmation forte pour actions destructrices (retrait, suppression) | Sécurisation | spec W10 |
| `ProgressBar` | 7 étapes linéaire onboarding | Onboarding | UX research §3 J1 |
| `SeedCell` | JetBrains Mono 18 px, numéro + mot, copy-free | Recovery seed | DP2 |
| `PermissionCard` | icône + titre + body + CTA | Autorisations OS | - |
| `InfoBanner` | ambre / bleu discret | Info non-bloquante | DP3 |
| `DisclaimerFooter` | body-sm ardoise en pied de E1, E4, E10 | RM27 | RM27, conformité §12 |
| `SymptomsGrid` | grille 3×2 icônes terracotta multi-select | Prise secours | RM4 |
| `SwitchRow` | label + switch | Settings | - |
| `SectionHeader` | titre Inter 600 24 px + sous-titre ardoise | Organisation | - |
| `RadioGroupDescribed` | radio + titre + description longue | Sélection de rôle | DP6 |
| `TimePicker` | natif OS | Horaires plan | - |
| `SyncStatusCard` | dernière sync, file d'attente, conflits | Transparence | DP5 |

---

## 6. Grille et breakpoints

### 6.1. Breakpoints (alignés avec CLAUDE.md et Tamagui standards)

| Breakpoint | Largeur | Devices cibles |
|---|---|---|
| `xs` | < 375 px | iPhone SE 1re gén. (min supporté) |
| `sm` | 375 px | iPhone 13 mini, plupart des Android compacts |
| `md` | 414 px | iPhone 14 Pro Max, Pixel Pro |
| `lg` | 428 px | iPhone 14 Plus, grands Android |
| `tab-sm` | 768 px | iPad mini, tablettes 7-8" |
| `tab-lg` | 1024 px | iPad, iPad Pro 11" |
| `desktop-sm` | 1280 px | Laptops compacts |
| `desktop-lg` | 1440 px+ | Écrans externes |

### 6.2. Grille

- **Mobile** : colonne unique, padding horizontal 16 px (xs/sm) ou 20 px (md/lg)
- **Tablette** : 12 colonnes, gutter 16 px, padding 24 px
- **Desktop** : 12 colonnes, gutter 24 px, max-width 1280 px centré

### 6.3. Espacements (tokens 4 px scale)

`space-1` = 4 px, `space-2` = 8 px, `space-3` = 12 px, `space-4` = 16 px, `space-5` = 20 px, `space-6` = 24 px, `space-8` = 32 px, `space-10` = 40 px, `space-12` = 48 px, `space-16` = 64 px

### 6.4. Règles d'adaptation transversales

- **Tab bar mobile → sidebar desktop** : à partir de `tab-lg` (1024 px), la tab bar 3 items devient une sidebar 240 px avec 6-8 entrées
- **Modales mobile bottom-sheet → desktop centered** : bottom-sheet en mobile, modale centrée en desktop à partir de `tab-sm`
- **Form mono-colonne** en tout viewport (pas de 2 colonnes pour les formulaires, simplicité)
- **Images adaptatives** via `srcset` / `sizes` web et `@1x @2x @3x` mobile

---

## 7. Principes d'accessibilité (WCAG 2.1 AA minimum)

### 7.1. Critères minimaux

| Critère | Seuil | Application |
|---|---|---|
| Contraste texte normal | ≥ 4.5:1 | Texte corps sur fond |
| Contraste texte large (≥ 18 px ou 14 px bold) | ≥ 3:1 | Titres |
| Contraste composants UI | ≥ 3:1 | Icônes actives, bordures de champs, focus rings |
| Touch target | ≥ 44 × 44 pt | Tout élément interactif |
| Dynamic Type | 100 %-200 % sans rupture | Tous les écrans |
| Navigation clavier | complète | Web et desktop |
| Focus visible | ring vert sauge 2 px offset 2 px | Tous composants interactifs |
| Lecteurs d'écran | labels explicites, roles ARIA | Testé sur VoiceOver + TalkBack + NVDA |
| Animations | variante sans mouvement | `prefers-reduced-motion` honoré |
| Captchas / tests visuels | interdits | - |
| Contenu flashant | interdit | - |

### 7.2. Labels VoiceOver / TalkBack spécifiques

- **CTA fond** : `aria-label="Enregistrer une prise de pompe de fond pour Léa, maintenant"`
- **CTA secours** : `aria-label="Enregistrer une prise de pompe de secours pour Léa"`
- **Chip prise passée** : `aria-label="Prise de fond confirmée par Marc le 19 avril à 19:47"`
- **Icône symptôme** : `aria-label="Toux, sélectionné"` / `aria-label="Toux, non sélectionné"`
- **Recovery seed cell** : `aria-label="Mot 3 sur 12 : calme"`
- **Barre doses pompe** : `role="progressbar" aria-valuenow=45 aria-valuemax=120 aria-label="45 doses restantes sur 120"`
- **Offline badge** : `role="status" aria-live="polite"` « Mode hors-ligne »

### 7.3. Tests obligatoires en CI

- axe-core sur chaque écran en CI Playwright (bloque sur violations critiques HAUTS)
- Tests manuels VoiceOver iOS + TalkBack Android sur J1, J2, J3, J5, J6 (UX research §8 P8)
- Dynamic Type 200 % Playwright screenshots
- `prefers-reduced-motion` Playwright tests

---

## 8. Principes de motion

### 8.1. Tokens

| Token | Durée | Courbe | Usage |
|---|---|---|---|
| `motion-instant` | 0 ms | - | `prefers-reduced-motion` |
| `motion-fast` | 150 ms | `cubic-bezier(0.4, 0, 0.2, 1)` ease-out | Hover, press |
| `motion-standard` | 200-250 ms | ease-out | Transitions, toasts |
| `motion-emphasized` | 300-400 ms | ease-out | Entrées d'élément, révélations |
| `motion-onboarding` | 400-600 ms | ease-out | Cinématique onboarding, reveal seed |

### 8.2. Règles d'usage

- **Durée max absolue** : 600 ms, **sauf** pour illustration onboarding
- **Aucun bounce, aucun élastique, aucun spring overshoot** (branding §5.6 : *« Rien ne rebondit dans la santé d'un enfant. »*)
- **Aucune célébration** : pas de confetti, pas de feu d'artifice, pas de pulse persistant (DP9)
- **Haptique iOS/Android** :
  - Tap confirmation prise fond : `UIImpactFeedbackStyle.light`
  - Tap confirmation prise secours : `UIImpactFeedbackStyle.medium` (plus marqué, sans panique)
  - Double saisie détectée : `UINotificationFeedbackStyle.warning` (ambre, pas error)
  - **Jamais** `error` sur un événement santé
- **`prefers-reduced-motion`** : toute animation a une variante statique (opacity only, pas de transform)

### 8.3. Exemples normés

- Toast apparition : slide + fade 250 ms ease-out, disparition 200 ms ease-in
- Modale apparition : slide-up 300 ms, scrim fade 200 ms
- Skeleton loading : shimmer 1200 ms loop ease-in-out (désactivé si reduced-motion → statique gris clair)
- Progress bar onboarding : remplissage 400 ms ease-out à chaque étape

---

## 9. Conventions de nommage

### 9.1. Routes

- Format : `/module/action/:id?` en kebab-case
- Exemples :
  - `/onboarding/create/security-words`
  - `/dose/new/rescue`
  - `/circle/invite`
  - `/settings/notifications`
  - `/legal/privacy`

### 9.2. Composants

- Format : `PascalCase` avec préfixe contextuel si applicable
- Exemples : `DoseCard`, `MemberChip`, `PumpLevelBar`, `SeedGrid`, `CircleInviteQR`

### 9.3. Écrans (techniques)

- Format : `Screen<Flow><Purpose>` ou abrégé en IDs `E<flow>.<num>`
- Exemples : `ScreenHomeCircle`, `ScreenDoseQuickRecord`, `ScreenOnboardingSeed`

### 9.4. Tokens design

- Format : `category-role-variant` en kebab
- Exemples :
  - `color-action-routine` (vert sauge)
  - `color-action-rescue` (terracotta)
  - `color-alert-soft` (ambre)
  - `space-4`, `motion-fast`, `typography-body`

### 9.5. i18n keys

- Format hiérarchique : `module.screen.element` en camelCase
- Exemples :
  - `onboarding.welcome.slide1.title`
  - `home.card.nextDose.label`
  - `dose.rescue.symptoms.cough`
  - `legal.privacy.summary.bullet1`
- **Pas de chaîne hardcodée en code applicatif** (règle ESLint `i18next/no-literal-string`, CLAUDE.md)

---

## 10. Risques UX résiduels (à valider en test utilisateur avant lock)

Les risques ci-dessous ne peuvent pas être tranchés sans test utilisateur terrain. Ils doivent être traités **avant** l'implémentation finale (soft launch + pilotes UX research §1.2).

### R1 — Recovery seed (critique)

- **Risque** : 30-50 % d'abandon estimé selon UX research §3 J1.5
- **Mitigation** : tester E1.08 avec Martial, Marc (tech), Lise (non-tech), 2 amis parents ; itérer 2-3 fois avant lock ; mesurer drop-off réel en A/B
- **Métrique succès** : > 85 % de complétion seed en prototype

### R2 — Vocabulaire « pompe » vs « inhalateur » FR-FR

- **Risque** : public FR-FR pourrait considérer « pompe » comme familier/bas registre
- **Mitigation** : test qualitatif avec 3-5 parents français ; valider tolérance ; sinon introduire variable i18n `inhaler_term` par locale fr-CA / fr-FR

### R3 — Notifications opaques

- **Risque** : utilisateur ne comprend pas pourquoi la notif dit rien de précis (UX research §3 J5.2)
- **Mitigation** : éducation au tutorial (E1.16), message onboarding explicite, FAQ dédiée

### R4 — Prise de secours sans alarmisme

- **Risque** : parents veulent une alerte forte (« Crise en cours ! »), frustrés par la sobriété
- **Mitigation** : expliquer le non-DM dans onboarding + FAQ ; test utilisateur sur acceptabilité ; garder la ligne rouge (refus d'ajouter « appelez votre médecin »)

### R5 — Invitation QR sans scanner connu

- **Risque** : Lise (68 ans) ne sait pas scanner un QR code
- **Mitigation** : parcours assisté (Élodie scan pour elle), code court fallback 6 chiffres, tutoriel vidéo FAQ

### R6 — Mode hors-ligne qui inquiète

- **Risque** : Lise voit le chip offline et pense que ça ne marche pas
- **Mitigation** : microcopie rassurante « Vous pouvez continuer normalement », test avec Lise par téléphone

### R7 — Confusion entre « retirer un aidant » et « supprimer le cercle »

- **Risque** : Admin clique « Retirer » sur elle-même, risque RM1
- **Mitigation** : prompts distincts (« Vous êtes le seul Admin — transférez d'abord »), test d'erreur

### R8 — Paradoxe Lise : écran épuré vs besoin d'historique pour confiance

- **Risque** : P3 Lise veut voir que la prise d'hier soir a été donnée ; si l'écran ne l'indique pas, elle appelle Élodie
- **Mitigation** : accueil Contributeur (pas restreint) affiche la dernière activité du cercle (déjà prévu E2.01, à valider)

### R9 — Dynamic Type 200 % mobile

- **Risque** : grille symptômes secours ne passe pas en une vue à 200 %
- **Mitigation** : passage en liste verticale dès 150 %, test Playwright screenshots

### R10 — Registre P4/P5 FR-FR vs FR-CA

- **Risque** : vocabulaire CPE (fr-CA) incompréhensible à Fatou (P4, fr-FR). Ex : « éducatrice » (CA) vs « assistante maternelle » (FR)
- **Mitigation** : locales séparées `fr-CA` / `fr-FR`, chaînes contextuelles

---

## 11. Points d'arbitrage restants pour le consultant

Certaines décisions ne peuvent pas être tranchées au niveau designer seul et requièrent validation produit / conformité / consultant.

### A1 — Export PDF : Admin seul ou aussi Contributeur ?

- **Option A (recommandée)** : **Admin seul** en v1.0 (spec W9 recommandation).
- **Option B** : Admin + Contributeur (co-parent), mais pas Restreint.
- **Impact** : affecte visibilité bouton Export dans E2.04bis journal et Plus menu.
- **Recommandation designer** : **A**, aligné UX research §7 AP1 (médecin non-utilisateur).

### A2 — Onboarding assisté par un proche (Élodie onboarde Lise)

- **Statut** : mentionné en UX research §3 J3.1 et §9.3 question 5, non formalisé
- **Arbitrage** : avant implementation, valider avec kz-conformite le workflow exact (audit trail consentement explicite de Lise sauvegardée par Élodie)
- **Impact design** : nouveau mini-flow dans onboarding (E1.13 alternative)

### A3 — Widget iOS / Android v1.0 ?

- UX research §6 Insight 1 le place v1.1. Designer confirme : **hors v1.0** pour respecter le budget/délai.
- Si le consultant veut pousser en v1.0 : ajouter 2 écrans (widget + settings widget), ~5-10 jours effort.

### A4 — Mode sombre forcé à la sortie ?

- Le branding §5.2 fournit les tokens dark. Production v1.0 :
  - **Option A** : Sortie avec light uniquement, dark en v1.0.1
  - **Option B** : Sortie avec les deux
- **Recommandation designer** : **B**, car la parité thème est triviale avec Tamagui tokens et bénéfique pour accessibilité nuit (UX research §6 Insight 12)

### A5 — Photo enfant floue par défaut ou nette ?

- UX research §2.6 suggère « floue ou absente par défaut »
- **Arbitrage** : valider avec consultant. Recommandation designer : **absente** par défaut (initiale pastille), toggle « Activer la photo » dans paramètres.

### A6 — Baseline à afficher dans l'app

- Branding §7.3 liste 3 baselines
- **Recommandation designer** : afficher **Baseline 1** (fonctionnelle) dans la landing E1.02 slide 1, **Baseline 3** (confiance) slide 2. Confirmer avec kz-copywriting.

### A7 — Vocabulaire « pompe » confirmé FR-FR ?

- UX research §0.1 dit « pompe » pour tous. À valider test FR-FR (R2 ci-dessus) : si taux d'incompréhension > 20 %, introduire `fr-FR.inhaler_term = "inhalateur"`.

### A8 — Révocation = wipe historique local immédiat ou à prochaine connexion ?

- UX research §9.3 question 6 : à trancher avec kz-securite et kz-conformite
- **Impact designer** : affecte la microcopie de E3.05 modale retrait

### A9 — Désactivation bouton « Je le ferai plus tard » sur recovery seed ?

- **Option stricte** : bloquer l'onboarding tant que la seed n'est pas confirmée
- **Option tolérante (recommandée, UX research Insight 3)** : permettre report avec rappels J+1 et J+3
- **Recommandation designer** : **tolérante** — un utilisateur bloqué ici est perdu. Préserver son funnel avec rappels.

### A10 — Page `/trust` publique

- Branding §3.2 et Insight 9 recommandent page `/trust` sur `kinhale.health`
- **Arbitrage** : couverture scope web marketing (hors apps) — à coordonner avec kz-marketing et kz-dev pour implementation

---

## 12. Annexe — Matrice de mapping écrans × moments de vérité × personas

| Écran | Flow | MV lié | Personas primaires | Contexte type |
|---|---|---|---|---|
| E1.01 Splash | 1 | - | tous | installation |
| E1.02 Welcome | 1 | - | tous | découverte |
| E1.03 Choose path | 1 | - | P1 ou P2-P5 | décision initiale |
| E1.04 Consent | 1 | - | P1 | assis, calme |
| E1.05 Check email | 1 | - | P1 | attente |
| E1.06 Child profile | 1 | - | P1 | calme |
| E1.07 First pump | 1 | - | P1 | calme |
| **E1.08 Seed** | 1 | **MV1** | P1, P2 | **critique, moment de confiance** |
| E1.09 Plan | 1 | - | P1 | configuration |
| E1.10 Invite or done | 1 | MV2 prélude | P1 | fin onboarding |
| **E1.11-14 Parcours B** | 1 | **MV4** | P2, P3, P4, P5 | **invité** |
| E1.15 Permissions | 1 | - | tous | setup |
| E1.16 Tutorial | 1 | - | tous | apprentissage |
| **E2.01 Home** | 2 | **MV2** | P1, P2, P3 | **quotidien, matin/soir** |
| **E2.02 Home kiosk** | 2 | - | P4, P5 | **pointe CPE midi** |
| **E2.03 Dose fond** | 2 | MV2 | tous | **geste 10 s** |
| E2.04 Dose detail | 2 | - | tous | consultation |
| E2.05 Dose edit | 2 | - | auteur, Admin | correction |
| E2.04bis Journal | 2 | - | tous | rétrospective |
| E2.04cal Calendar | 2 | - | P1, P2 | vue mensuelle |
| **E2.06 Dose secours** | 2 | **MV5** | tous | **stress, enfant tousse** |
| E2.07 Backfill | 2 | - | tous | rattrapage |
| **E3.01-06 Cercle** | 3 | **MV7** | P1 Admin | **gestion, révocation** |
| E4.01-04 Pompes plan | 4 | - | P1 Admin | maintenance |
| E5.01-04 Rappels notifs | 5 | **MV3** | tous | configuration + réception |
| E6.01-02 Enfant | 6 | - | P1 Admin | gestion fiche |
| **E6.03 Export PDF** | 6 | **MV6** | P1 Admin | **veille rendez-vous pneumo** |
| E6.04 Export history | 6 | - | P1 Admin | audit |
| E7.01-08 Paramètres | 7 | MV1 (seed repeat) | tous | configuration |
| E8.01-06 Edge cases | 8 | tous MV | tous | crise imprévue |
| E9.01-05 Légal support | 9 | - | tous | curiosité, incident |

---

## 13. Validation du livrable

### 13.1. Critères de sortie

Ce livrable est considéré comme produit si :

1. 10 principes designer sont formulés et tracés sur les 51 écrans.
2. L'architecture de l'information est cartographiée (9 flows, 51 écrans).
3. Les 7 moments de vérité sont illustrés en wireframes ASCII (MV1-MV7).
4. Chaque écran est spécifié avec : ID, route, persona, contexte, but, contenu, actions, états, responsive, a11y, i18n, motion, risques UX, règles applicables.
5. Les composants UI récurrents sont listés pour passage au design-system.
6. La grille et les breakpoints sont définis (mobile 375+, tablette 768/1024, desktop 1280/1440).
7. Les principes d'accessibilité WCAG 2.1 AA sont opérationnalisés (seuils, ARIA labels, CI tests).
8. Les principes de motion sont tokenisés (durées, courbes, haptique).
9. Les conventions de nommage (routes, composants, écrans, tokens, i18n) sont définies.
10. Les risques UX résiduels sont listés pour test utilisateur.
11. Les 10 points d'arbitrage restants sont explicités pour décision consultant.

### 13.2. Chaînage aval recommandé

```
kz-designer (livré)
   ↓
kz-design-system (tokens Tamagui, composants réutilisables) ← volet suivant
   ↓
kz-copywriting (microcopie FR-CA / FR-FR / EN-CA / EN-INT respectant branding §4)
   ↓
kz-frontend (implémentation React Native + Next.js)
   ↓
kz-qa (tests E2E Maestro + Playwright, axe-core CI)
   ↓
kz-design-review (validation visuelle et interactive pre-merge)
```

### 13.3. Dépendances bloquantes avant début implémentation

1. **Validation kz-conformite** du consentement parcours B (E1.12) et onboarding assisté (A2)
2. **Test seed recovery** sur 5 personas pour valider taux de complétion
3. **Validation 1 pneumo-pédiatre** sur format PDF E6.03 (MV6) — DoD v1.0 PRD §11.2
4. **Décision A1-A10** par le consultant
5. **Locales fr-CA / fr-FR** séparées dans `packages/i18n/locales/` (R2 et R10)

---

*Fin du livrable conception UI/UX — prêt à être consommé par kz-design-system (volet suivant), kz-copywriting, kz-frontend, kz-qa.*
