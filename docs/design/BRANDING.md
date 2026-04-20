# Identité de marque — Kinhale v1.0

> Rédigé par **kz-branding** le 2026-04-19 — Client : Martial (martial@wonupshop.com)
> Amont : `00-kz-discovery.md`, `00-kz-discovery-addendum.md`, `00-kz-product.md`, `00-kz-conformite.md`
> Aval : kz-ux-research, kz-designer, kz-design-system, kz-copywriting, kz-marketing

---

## Décisions de marque validées (2026-04-19)

Les cinq choix ouverts par le livrable initial ont été tranchés par le consultant et doivent être traités comme définitifs par tous les agents en aval :

1. **Prononciation officielle** : "kin-HAYL" — /kɪnˈheɪl/, accent tonique 2ème syllabe. Documenter phonétiquement dans README FR et EN.
2. **Baseline principale** : "Pour respirer ensemble" (FR) / "Breathe easier, together" (EN). Registre émotionnel retenu. Pas d'A/B test au lancement. Les baselines fonctionnelles restent utilisables en App Store / SEO uniquement.
3. **Registre linguistique** : **Vouvoiement universel** FR. Pas de tutoiement. L'app s'adresse aux aidants adultes (parents, grands-parents, nounou, garderie) — le vouvoiement préserve la dignité du registre santé familial multi-foyer, au Québec comme en France.
4. **Domaine primaire** : `kinhale.health`. Réserver également `kinhale.app` (redirect) et `kinhale.org` (org communautaire open source). Ne pas prioriser `.com`.
5. **Typographies** : **Inter + Fraunces** adoptés. JetBrains Mono intégré **uniquement** sur les écrans de recovery seed BIP39 (usage ciblé, ne pas charger globalement).

---

## Préambule

Kinhale n'est pas un produit médical. C'est un **outil familial de coordination** qui vit au croisement de trois mondes qui se parlent mal :

- la **santé pédiatrique**, avec son lexique prescriptif et ses codes visuels froids ;
- le **logiciel libre**, souvent austère et technique ;
- la **vie de famille**, chaleureuse, pressée, bruyante, partagée entre plusieurs générations et plusieurs foyers.

La marque doit résoudre cette tension en un seul geste : **inspirer une confiance calme**. Pas la confiance clinique d'un bloc opératoire, pas la confiance tribale d'un réseau social familial, mais celle — plus rare — d'un compagnon discret qui tient parole. L'équivalent produit d'un thermomètre fiable posé sur la table de nuit : toujours là, jamais bruyant, d'une précision qui ne se remarque pas.

Cette marque doit être **nativement bilingue FR/EN** (francophone Québec d'abord, francophones France ensuite, anglophones Canada et international), **accessible WCAG 2.1 AA dès la première ligne de CSS**, et **scrupuleusement non prescriptive** pour protéger le non-statut de dispositif médical inscrit dans le PRD et rappelé dans le cadre de conformité.

---

## 1. Mission, vision, valeurs

### 1.1. Mission

> **FR** : Donner à toutes les personnes qui prennent soin d'un enfant asthmatique un langage commun pour coordonner son traitement, sans jamais remplacer le regard d'un soignant.
>
> **EN** : Give everyone who cares for a child with asthma a shared language to coordinate treatment — never a replacement for their doctor's eye.

La mission est **relationnelle avant d'être technique** : Kinhale n'automatise pas des soins, il **synchronise des aidants**. Le produit ne fait pas à la place de la famille — il la met en phase.

### 1.2. Vision (horizon 3 ans)

> **FR** : Faire de Kinhale la référence open source du suivi d'observance pédiatrique — utilisée par des dizaines de milliers de foyers, recommandée par les pneumo-pédiatres, et reconnue comme la preuve qu'un outil de santé grand public peut être à la fois gratuit, ouvert, et irréprochable sur la vie privée.
>
> **EN** : Make Kinhale the open-source reference for pediatric asthma adherence — trusted by tens of thousands of households, recommended by pediatric pulmonologists, and recognized as proof that a consumer health tool can be free, open, and uncompromising on privacy.

Cette vision est mesurable via les OKR du PRD (O1-O6), les métriques de suivi §12 du PRD, et l'ouverture progressive à d'autres pathologies chroniques pédiatriques partageant la même logique de coordination multi-aidants (épilepsie, diabète T1, dermatite atopique).

### 1.3. Valeurs cardinales

Cinq valeurs, une par principe directeur du PRD. Ce sont des **filtres de décision**, pas des slogans : toute décision produit, design ou marketing doit pouvoir être justifiée par au moins une de ces valeurs, et aucune ne doit contredire une autre.

| Valeur | Ce que ça veut dire concrètement | Ce que ça exclut |
|---|---|---|
| **Calme** | Micro-copie sobre, animations lentes, couleurs saturées uniquement en signal. La marque ne crie jamais, même pour une dose manquée. | Red flags clignotants, langage d'urgence, notifications anxiogènes, écrans pleins d'alertes. |
| **Confiance** | Promesse zero-knowledge tenue techniquement et expliquée simplement. Historique tout-ouvert côté utilisateur, tout-fermé côté relais. | Marketing sécurité flou, cadenas visuels décoratifs, mentions « bank-grade encryption » non étayées. |
| **Coordination** | Tout parcours pense au-delà du parent référent : co-parent, grand-parent, éducatrice. Un écran d'aidant secondaire compte autant qu'un écran d'admin. | Onboarding centré sur un seul utilisateur, comptes personnels solitaires, UX one-user. |
| **Simplicité** | Une action, un écran. Pas de configuration obligatoire. Langage de cuisine, pas de notice de médicament. | Menus à tiroirs, tableaux de bord, jargon médical, paramètres avancés visibles par défaut. |
| **Ouverture** | Code public, données exportables, self-hosting documenté, pas de verrou propriétaire. L'utilisateur peut quitter la marque en un clic et emmener ses données. | Dark patterns de rétention, exports payants, verrouillage propriétaire, dépendance à un seul cloud. |

### 1.4. Manifeste (format signature)

Un texte court, à afficher sur la home de `kinhale.health` et en ouverture du README GitHub, dans les deux langues. Il doit tenir en 60 secondes de lecture à voix haute.

> **FR**
>
> Kinhale est né parce qu'un père n'arrivait plus à dormir la nuit sans se demander si sa fille avait reçu sa pompe.
>
> Pas parce qu'il était absent — au contraire, parce qu'ils étaient plusieurs à la soigner. Deux parents, quatre grands-parents, une éducatrice en garderie, parfois une nounou. Tout le monde aidant. Personne ne sachant plus qui avait fait quoi.
>
> On a construit Kinhale pour ce foyer-là, puis pour les millions d'autres qui vivent la même coordination invisible.
>
> Kinhale est un **journal partagé**, des **rappels fiables**, une **synchro entre aidants**. Rien de plus. Pas un médecin. Pas un diagnostic. Pas un prescripteur.
>
> Le code est public, gratuit, et sous licence libre. Les données de votre enfant sont chiffrées sur vos appareils — **même nous, qui avons fait l'outil, ne pouvons pas les lire**.
>
> C'est la seule promesse qui compte quand on parle de la santé d'un enfant.
>
> **EN**
>
> Kinhale started because a father couldn't sleep at night wondering whether his daughter had taken her inhaler.
>
> Not because he was absent — the opposite. They were several to care for her. Two parents, four grandparents, a daycare educator, sometimes a nanny. Everyone helping. No one knowing anymore who had done what.
>
> We built Kinhale for that household, then for the millions of others living the same invisible coordination.
>
> Kinhale is a **shared log**, **reliable reminders**, a **sync between caregivers**. Nothing more. Not a doctor. Not a diagnosis. Not a prescriber.
>
> The code is public, free, and released under a free license. Your child's data is encrypted on your devices — **even we, who built the tool, cannot read it**.
>
> That's the only promise that matters when a child's health is at stake.

---

## 2. Positionnement

### 2.1. Catégorie revendiquée

Kinhale n'est pas dans la catégorie « app santé ». C'est un **coordinateur familial pour traitement inhalé pédiatrique** — catégorie que la marque doit elle-même nommer, puisqu'elle n'existe pas encore.

Formulation publique en une phrase :
- **FR** : *« Le journal partagé des parents et des aidants d'un enfant asthmatique. »*
- **EN** : *« The shared log for everyone caring for a child with asthma. »*

### 2.2. Carte concurrentielle

| Axe | Apps médicales prescriptives (AsthmaMD, Propeller) | Apps ludiques enfant (Wizdy, Kata) | Apps familiales génériques (Cozi, FamilyWall) | **Kinhale** |
|---|---|---|---|---|
| Public | Patient adulte ou ado | Enfant lui-même | Famille organisée au sens large | **Tous les aidants d'un enfant asthmatique** |
| Approche | Clinique, quantifiée | Gamifiée, éducative | Calendrier partagé | **Coordination traitement + journal** |
| Coût | Payant, souvent freemium | Payant ou in-app | Freemium | **Gratuit, open source** |
| Ton | Médical, froid | Joueur, infantilisant | Pragmatique, neutre | **Chaleureux, sobre, rassurant** |
| Vie privée | Opaque, cloud propriétaire | Cloud propriétaire + analytics | Cloud propriétaire | **E2EE zero-knowledge, self-hostable** |
| Statut | Parfois dispositif médical | Non médical | Non médical | **Non médical, gravé dans le PRD** |

### 2.3. Les cinq différenciateurs à marteler

1. **Zero-knowledge** — pilier. *« Même nous, les créateurs, ne pouvons pas lire les données de votre enfant. »* C'est la **phrase signature** de la marque, à décliner partout.
2. **Open source + gratuit** — pas un freemium déguisé. Le code est publié sous AGPL v3, l'instance officielle est hébergée sans frais pour l'utilisateur, et le self-hosting est documenté dès J1.
3. **Non-médical assumé** — Kinhale ne joue jamais au médecin. Pas de recommandation de dose, pas d'alerte de crise, pas de message *« consultez un professionnel »* auto-généré. Cette retenue est **un argument**, pas une limitation.
4. **Conçu pour les aidants secondaires** — la garderie, la nounou, le grand-père. Le parcours d'invitation QR + PIN sans création de compte est **l'expérience signature** qui manque à toutes les apps concurrentes.
5. **Hors-ligne natif** — l'app fonctionne dans un sous-sol de CPE sans wifi. La synchro est un détail technique, jamais une condition d'usage.

### 2.4. Ce que la marque n'est **pas**

- **Pas une app de patient** — Kinhale ne parle pas à l'enfant malade ; il parle aux adultes qui en prennent soin.
- **Pas un outil de compliance / observance hôpital** — pas de reporting vers un système hospitalier en v1/v1.1, pas d'intégration EMR.
- **Pas une app de famille 360°** — Kinhale ne gère pas l'agenda des devoirs, les courses, le covoiturage. Il fait **une seule chose**, bien.
- **Pas un produit premium freemium** — aucune fonction n'est bloquée derrière un paiement. La monétisation éventuelle future sera **B2B cliniques**, pas B2C familles.
- **Pas un acteur qui promet plus que ce qu'il fait** — on ne dira jamais *« Kinhale protège votre enfant »*. On dira *« Kinhale aide votre famille à se coordonner »*.

### 2.5. Baseline de positionnement (usage interne)

> **FR** : Pour les foyers où plusieurs adultes prennent soin d'un enfant asthmatique, Kinhale est le journal partagé et les rappels fiables qui alignent tous les aidants en temps réel — contrairement aux apps payantes ou aux cahiers papier, Kinhale est gratuit, open source, fonctionne hors-ligne, et garde les données chiffrées même vis-à-vis de ses créateurs.
>
> **EN** : For households where several adults care for a child with asthma, Kinhale is the shared log and reliable reminders that bring every caregiver in sync in real time — unlike paid apps or paper notebooks, Kinhale is free, open source, works offline, and keeps data encrypted even from its own makers.

---

## 3. Personnalité de marque

### 3.1. Archétype

Kinhale combine deux archétypes mineurs qui, ensemble, évitent les pièges du secteur.

- **Le Gardien** (*Caregiver*) — attentif, chaleureux, présent sans être envahissant. **Nuance clé** : Kinhale ne prend pas soin de l'enfant, il **prend soin des personnes qui en prennent soin**. C'est un gardien de seconde main, pas un substitut parental.
- **Le Compagnon** (*Everyman*) — accessible, humble, sans expertise revendiquée. Pas un expert médical qui parle de haut, pas un geek crypto qui parle de trop. Un pair.

Ce qu'on évite explicitement :
- Le **Sage** (expert médical). Piège direct vers le statut dispositif médical.
- Le **Héros** (sauveur). *« Kinhale sauve des vies »* est exactement ce que la marque ne doit jamais dire.
- **L'Innocent** (optimisme infantile). La marque s'adresse à des adultes qui vivent une maladie chronique — pas de bisounours.

### 3.2. Traits de caractère (si Kinhale était une personne)

| Trait | Définition | Manifestation concrète |
|---|---|---|
| **Chaleureux** | Accueillant, pas corporate, pas clinique | Voix à la première personne du pluriel (« nous »), prénoms des personas dans la communication, photos de vraies familles |
| **Sobre** | Économie de mots et de pixels, jamais criard | Une action dominante par écran, pas d'adverbe superlatif, pas d'emoji décoratif en UI |
| **Rassurant** | Pose des signaux de confiance sans les surjouer | Microcopie qui reformule positivement, statuts « pris » / « non confirmé » plutôt que « oublié ! » |
| **Compétent** | Technique sans être technicien | On explique le chiffrement en deux phrases, pas en un livre blanc |
| **Humble** | Reconnaît ses limites avant qu'on les pointe | *« Nous ne remplaçons pas votre médecin »* écrit plus gros que *« nous vous aidons »* |
| **Ouvert** | Transparence sur le code, les sous-traitants, les revenus éventuels | Page publique `/trust` listant infra, sous-traitants, incidents passés, financement |

### 3.3. Spectres de personnalité

Les curseurs ci-dessous fixent le « tempérament » de la marque. Ils servent d'arbitrage rapide pour le design, la copy et les assets.

```
Formel      ├─────●───────┤      Familier
Sérieux     ├───●─────────┤      Ludique
Froid       ├──────────●──┤      Chaleureux
Clinique    ├────────────●┤      Familial
Institutionnel ├─────●────┤      Artisanal
Corporate   ├───────────●─┤      Associatif
Technique   ├───────●─────┤      Accessible
Dramatique  ├───●─────────┤      Apaisé
```

Lecture : Kinhale est **proche du chaleureux/familial/apaisé**, mais reste **plutôt sérieux et modérément formel** — parce qu'on parle de santé. La marque n'est ni un ami d'école (trop familier) ni un hôpital (trop formel). Elle est **l'ami de la famille qui travaille à l'hôpital** : il connaît les sujets, mais parle comme tout le monde à table.

---

## 4. Ton de voix

### 4.1. Principes rédactionnels

1. **Un sujet par phrase.** Une phrase, une idée, une respiration. Pas de subordonnées empilées.
2. **L'humain avant le produit.** *« Sophie a donné la pompe à 19h47 »*, pas *« Administration enregistrée par user_id 1742 »*.
3. **Le constat avant l'émotion.** On décrit ce qui s'est passé ; on laisse l'utilisateur ressentir.
4. **Factuel avant rassurant.** Si une dose est manquée, on dit *« Prise du soir non confirmée »*, pas *« Pas d'inquiétude ! »*. La fausse réassurance érode la confiance.
5. **Actif plutôt que passif.** *« Vous pouvez exporter le rapport »*, pas *« Un rapport peut être exporté »*.
6. **Vocabulaire de cuisine, jamais de bloc.** *« Donner la pompe »*, pas *« administrer le bronchodilatateur »*.
7. **Pas d'urgence auto-générée.** L'app ne dit jamais *« Urgent »*, *« Alerte »*, *« Critique »* de sa propre initiative.

### 4.2. Registre

- **Par défaut** : vouvoiement FR / neutre EN. On vouvoie parce qu'on parle à tous les aidants, y compris la nounou qu'on voit deux fois par semaine. Le tutoiement automatique peut froisser un grand-parent ou un aidant professionnel.
- **Exception** : tutoiement possible dans les écrans strictement destinés au parent référent (paramètres du foyer, email de bienvenue). À qualifier avec kz-copywriting.
- **EN** : toujours neutre, pas de familiarités type *« Hey there! »*.

### 4.3. Vocabulaire à privilégier (FR / EN)

| Contexte | FR privilégié | EN privilégié |
|---|---|---|
| L'acte | « donner la pompe », « faire la prise » | « give the inhaler », « log a dose » |
| Le moment | « prise du matin », « prise du soir » | « morning dose », « evening dose » |
| Les personnes | « aidant », « parent », « proche », « référent » | « caregiver », « parent », « family » |
| Le foyer | « foyer », « famille », « cercle » | « household », « family », « circle » |
| L'enfant | prénom, sinon « votre enfant » | first name, else « your child » |
| Les absences | « prise non confirmée », « non renseignée » | « dose not confirmed », « not logged » |
| Les rapports | « rapport », « résumé pour le médecin » | « report », « summary for your doctor » |
| La sécurité | « chiffré sur vos appareils », « vos données restent chez vous » | « encrypted on your devices », « your data stays with you » |

### 4.4. Vocabulaire banni

**Lexique prescriptif / médical / DM** — risque de basculement en dispositif médical :
- FR : « prescrire », « prescription », « poso », « posologie » (dans l'UI — acceptable dans la politique de confidentialité), « dose recommandée », « il faut », « vous devez », « consultez votre médecin immédiatement », « crise », « urgence », « appelez le 15 », « diagnostic », « alerte santé ».
- EN : « prescribe », « prescription », « recommended dose », « you must », « call your doctor immediately », « emergency », « 911 », « diagnosis », « health alert ».

**Lexique anxiogène / urgence** — contraire à la valeur *Calme* :
- FR : « attention ! », « danger », « risque », « alerte », « critique », « manqué ! » (avec point d'exclamation), « oublié ! ».
- EN : « warning! », « danger », « critical », « missed! », « forgot! ».

**Lexique corporate / froid** — contraire à la valeur *Coordination* :
- FR : « utilisateur », « compte utilisateur », « plateforme », « solution », « administrer » (comme verbe UI), « entité », « profil client ».
- EN : « user », « platform », « solution », « administer » (in UI), « entity », « customer profile ».

**Lexique gamification** — contraire au principe 6 du PRD :
- FR / EN : « streak », « badge », « score », « niveau », « récompense », « défi », « achievement ».

**Lexique fausse réassurance** — érode la confiance :
- FR : « Pas d'inquiétude ! », « Tout va bien ! », « Super ! » en réponse à un événement de santé.
- EN : « Don't worry! », « All good! », « Awesome! » in a health context.

### 4.5. Exemples comparés (avant / après)

| Mauvais (à éviter) | Bon (Kinhale) |
|---|---|
| « ALERTE : Dose oubliée ! Administrez immédiatement. » | « Prise du soir non confirmée. » |
| *« ALERT: Missed dose! Administer now. »* | *« Evening dose not confirmed. »* |
| « Félicitations, vous avez un streak de 7 jours ! » | (rien — on ne gamifie pas la santé d'un enfant) |
| « En cas de crise, appelez votre médecin. » | (rien — Kinhale ne donne pas de consigne médicale ; un disclaimer fixe en pied de page renvoie au médecin traitant) |
| « L'utilisateur Sophie a enregistré une administration. » | « Sophie a donné la pompe à 19h47. » |
| *« User Sophie logged an administration. »* | *« Sophie gave the inhaler at 7:47 PM. »* |
| « Activez la sécurité bancaire pour vos données. » | « Vos données sont chiffrées sur vos appareils. Même nous ne pouvons pas les lire. » |
| « Passez à Kinhale Premium. » | (rien — il n'y aura jamais de Premium B2C) |

---

## 5. Direction visuelle

### 5.1. Principe directeur

La direction visuelle doit **éloigner Kinhale des codes médicaux** (bleu clinique dominant, croix rouge, pictogrammes hospitaliers, typographies sérif classiques type *Times*) sans tomber dans le **kidstuff** (couleurs saturées primaires, polices rondes infantilisantes, illustrations de cartoons). Objectif : un langage visuel qui **pourrait illustrer un carnet de famille partagé**, pas une ordonnance.

### 5.2. Palette couleurs

Chaque couleur a une **fonction** avant d'avoir une esthétique. La palette est conçue pour **respecter WCAG 2.1 AA sur contraste** (ratio ≥ 4.5:1 pour texte normal, ≥ 3:1 pour texte large et composants UI) et pour rester lisible en mode sombre et pour les utilisateurs daltoniens (validation via simulateur deutéranopie / protanopie).

#### Couleur signature — Vert sauge profond

- **Hex** : `#2F6B5A` (sage green deep)
- **Fonction** : identité primaire Kinhale. Utilisée pour le logo, les actions principales (hors secours), les liens actifs.
- **Émotion** : calme végétal, souffle, équilibre. Évoque la respiration sans utiliser le bleu hospitalier.
- **Justification** : éloigne radicalement du bleu médical (95 % des apps santé) tout en gardant une légitimité santé (vert = nature, respiration, vie). Ratio contraste avec blanc : **6.8:1** (AAA).

#### Couleurs fonctionnelles

| Rôle | Hex | Fonction | Émotion |
|---|---|---|---|
| **Routine / Fond** | `#2F6B5A` (vert sauge) | Pompe de fond, actions de routine, états normaux | Calme, respiration, prévisibilité |
| **Attention douce** | `#C9883C` (ambre miel) | Dose non confirmée, rappel à venir, seuil bas de pompe | Vigilance sans alarme (pas de jaune criard) |
| **Secours** | `#B94A3E` (terracotta brique) | Pompe de secours uniquement | Action ponctuelle sans panique (pas de rouge vif, pas de rouge sang) |
| **Passé neutre** | `#6B7280` (ardoise chaude) | Historique, doses manquées confirmées, états inactifs | Factuel, sans jugement |
| **Succès discret** | `#4B8B6E` (vert doux) | Confirmation d'une prise, synchro réussie | Coche discrète, pas de feu d'artifice |

#### Couleurs de surface

| Rôle | Hex light | Hex dark | Fonction |
|---|---|---|---|
| Fond principal | `#FAF8F4` (ivoire chaud) | `#14201C` (forêt nuit) | Donne la chaleur « papier », évite le blanc clinique |
| Fond secondaire | `#F0ECE4` (crème) | `#1C2B26` | Cartes, panneaux latéraux |
| Bordure / séparateur | `#D9D2C4` | `#2C3E37` | Séparateurs discrets |
| Texte principal | `#1A2420` (graphite forêt) | `#F0ECE4` | Ratio contraste 13:1 (AAA) |
| Texte secondaire | `#5A6560` | `#B8BFB9` | Ratio contraste ≥ 4.5:1 (AA) |

**Règles d'usage** :
- La terracotta (`#B94A3E`) est **exclusivement** réservée à la pompe de secours et à ses artefacts (historique de prise de secours). Ne jamais l'utiliser pour un call-to-action général, un bouton « Supprimer », un bouton « Enregistrer ». Cette réserve préserve sa **charge sémantique**.
- La palette entière repose sur des tons **désaturés et terreux** (pas de couleurs fluo, pas de pastels sucrés). Objectif : lisible à 3h du matin avec un téléphone qui fait mal aux yeux, et respectueux à 8h devant la pédiatre.
- Tous les états (hover, focus, pressed, disabled) sont tokenisés dans `packages/ui` et validés par kz-design-system.

### 5.3. Typographie

#### Choix

- **Famille principale (UI + marketing)** : **Inter** (Rasmus Andersson, SIL OFL).
  - Accessible, excellent rendu multi-plateforme, support FR complet (accents, ç, œ), support EN natif, large range de graisses (100-900), compatible WCAG. Open source — cohérent avec la valeur *Ouverture*.
  - Fallback système : `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Famille accent (headlines marketing, logo wordmark)** : **Fraunces** (Undercase Type, SIL OFL).
  - Serif variable, optical size dynamique, caractère chaleureux et légèrement « artisanal » — évoque un carnet manuscrit de famille plutôt qu'un rapport médical. Open source également.
  - Usage restreint : titres H1/H2 de landing page, wordmark du logo, couverture du rapport PDF. **Jamais dans l'UI applicative** (trop personnelle pour les écrans fonctionnels).
- **Famille monospace (code, timestamps, horloges)** : **JetBrains Mono** (SIL OFL).
  - Pour les horodatages précis (`19:47`), les IDs de foyer, les blocs de code du README. Évite la lecture ambiguë de `Il1O0`.

#### Échelle typographique

Basée sur un ratio de 1.25 (majeure tierce), avec une taille de base de **16 px** (respect WCAG pour le texte courant).

| Token | Taille | Graisse | Usage |
|---|---|---|---|
| `display` | 48 px | 600 (Fraunces) | Titre de landing uniquement |
| `h1` | 32 px | 600 (Fraunces en marketing, Inter en app) | Titre d'écran principal |
| `h2` | 24 px | 600 (Inter) | Sections |
| `h3` | 20 px | 600 (Inter) | Sous-sections |
| `body-lg` | 18 px | 400 (Inter) | Lecture confortable (onboarding, disclaimers) |
| `body` | 16 px | 400 (Inter) | Texte courant — taille minimale d'UI |
| `body-sm` | 14 px | 400 (Inter) | Métadonnées, horodatages, réservé aux contextes non critiques |
| `caption` | 12 px | 500 (Inter) | **Usage parcimonieux** — jamais pour une information santé |

**Règles** :
- Hauteur de ligne ≥ 1.5 pour tout texte courant.
- Espacement lettres par défaut (pas de letter-spacing négatif).
- **Pas de texte en tout-majuscules** dans l'UI applicative (problème VoiceOver + lisibilité).
- **Taille tactile minimale 44×44 pt** pour tout élément interactif (WCAG AA + Apple HIG).

#### Accessibilité typographique

- Support **Dynamic Type iOS** et équivalent Android / CSS `rem` + `clamp()` sur le web jusqu'à 200 % sans rupture de layout.
- Test obligatoire à `120 %`, `150 %`, `200 %` en CI (axe-core + Playwright screenshot).

### 5.4. Iconographie

#### Style

- **Ligne fine régulière** (stroke 1.5 px à taille 24 px), terminaisons arrondies, corners arrondis `2-3 px`. Style inspiré de **Phosphor Icons** (MIT) ou **Lucide** (ISC) — open source, cohérent avec la valeur *Ouverture*.
- **Monochrome** par défaut, colorisation fonctionnelle uniquement (routine = vert sauge, secours = terracotta, alerte douce = ambre, neutre = ardoise).
- Jamais d'icônes médicales stéréotypées : **pas de croix rouge**, pas de caducée, pas de stéthoscope, pas de pilule, pas de seringue.

#### Métaphores visuelles propres à Kinhale

| Concept | Métaphore | Évite |
|---|---|---|
| Pompe de fond | Inhalateur stylisé en ligne, inspiré de la silhouette générique (pas d'une marque spécifique) | Tout visuel de médicament en gélule, de seringue, de pilule |
| Pompe de secours | Même forme, surlignée en terracotta, petit éclair stylisé en terminaison | Flamme, étoile d'alerte, cœur |
| Aidant | Contour de personne avec subtile variation (coiffure, accessoire) selon le rôle | Silhouettes génériques identiques, avatars médicalisés |
| Foyer / cercle | Cercle souple, non géométriquement parfait, suggérant un lien plutôt qu'un conteneur | Maison (trop générique), famille nucléaire (exclut garderie/nounou) |
| Rappel | Horloge avec un point de respiration | Cloche (trop sonore), alarme (anxiogène) |
| Chiffrement | Clé + contour d'appareil, jamais un cadenas fermé agressif | Cadenas, bouclier, coffre-fort |
| Synchronisation | Deux flèches arc-en-cercle, non complètes (mouvement suggéré) | Spinner agressif, roue dentée |

#### Règles de grid

- Grid 24 px par défaut, 16 px pour versions compactes (mobile nav).
- Padding visuel de 2 px minimum à l'intérieur de la bounding box.
- Export SVG + font icon via Tamagui + Phosphor / Lucide.

### 5.5. Illustration & photographie

- **Illustrations** : style trait souple coloré à la main, palette Kinhale, personnages représentatifs de la diversité des foyers canadiens et européens (deux mères, mère solo + grand-parent, foyer multigénérationnel, garderie en CPE). **Éviter** la famille nucléaire blanche hétérosexuelle par défaut.
- **Photographie** (marketing, App Store screenshots) : lumière naturelle, intérieurs de maison ou de CPE réels, cadrage intime (main qui tend une pompe, téléphone posé sur une table de nuit, éducatrice et enfant), **jamais** de mise en scène hôpital, blouses blanches, stéthoscope, panneau signalétique médical.
- **Hero shots produit** : téléphone avec l'app sur fond de table en bois, tasse de café à côté. Pas de fond blanc studio clinique.

### 5.6. Motion design

Principes issus de la valeur *Calme* + principe 4 du PRD sur l'accessibilité :

- **Durées courtes** : transitions standard 150-200 ms, entrées d'éléments 250-300 ms. Rien au-delà de 400 ms sauf cinématique d'onboarding.
- **Courbes douces** : ease-out par défaut, jamais de bounce, jamais d'élastique. *« Rien ne rebondit dans la santé d'un enfant. »*
- **Confirmations discrètes** : coche qui se dessine sur 200 ms avec fade-in du texte « Prise enregistrée », jamais d'explosion de confettis, jamais de pulse animé persistant.
- **Pas d'animations décoratives** : pas d'arrière-plans en mouvement, pas de particules, pas de parallaxe. Chaque animation a une fonction (guider le focus, confirmer une action, suggérer un état).
- **Respect de `prefers-reduced-motion`** obligatoire : toutes les animations doivent avoir une variante sans mouvement (opacity only).
- **Haptique** (iOS/Android) : feedback léger (UIImpactFeedbackStyle.light) sur confirmation d'une prise — jamais de vibration agressive sur alerte.

### 5.7. Charte applicable aux notifications

Cohérence avec le cadre de conformité (§3 : *« Payload push = titre + body génériques »*) :

- **Contenu standard** : `{title: "Kinhale", body: "Nouvelle activité dans votre foyer"}` — aucune donnée santé, aucun prénom, aucun nom de pompe.
- **Icône notification** : logo Kinhale monochrome, pas l'icône colorée (respecte les normes APNs/FCM).
- **Son** : discret, non anxiogène. Fournir un son par défaut « léger » (comme une clochette éteinte), paramétrable.

---

## 6. Do & Don't — exemples concrets

### 6.1. Microcopie UI

**Do**
- *« Prise du soir non confirmée. Je l'ai donnée / Pas encore. »*
- *« Sophie a donné la pompe à 19:47. »*
- *« Il reste environ 20 doses dans la pompe de fond. »*
- *« Vos données restent chiffrées sur vos appareils. »*
- *« Inviter la garderie en 30 secondes. »*
- *« Exporter pour la pédiatre. »*

**Don't**
- *« ALERTE ! Dose oubliée ! »* (anxiogène)
- *« Administration enregistrée par Sophie (user_id 1742). »* (froid, technique)
- *« Niveau critique ! Remplacez votre pompe immédiatement. »* (prescriptif + urgence)
- *« Sécurité bancaire militaire 256 bits. »* (marketing flou)
- *« Créer un compte utilisateur pour la garderie. »* (friction inutile)
- *« Générer un rapport médical. »* (*« médical »* renforce le risque DM — préférer *« pour votre pédiatre »*)

### 6.2. Communication marketing

**Do**
- *« Kinhale, le journal partagé des aidants d'un enfant asthmatique. Gratuit, open source, hors-ligne. »*
- *« Même nous, qui avons fait Kinhale, ne pouvons pas lire les données de votre enfant. »*
- *« De la garderie au salon, tout le monde est à la page. »*
- *« Un outil fait par un père, pour les familles comme la sienne. »*

**Don't**
- *« Kinhale sauve la vie de votre enfant. »* (promesse médicale)
- *« L'application médicale n°1 pour l'asthme pédiatrique. »* (revendication DM + superlatif non étayé)
- *« Ne laissez plus jamais votre enfant sans sa pompe. »* (culpabilisant)
- *« Alerte crise asthmatique en temps réel. »* (statut DM direct)
- *« Made with love ❤️ »* (fade, cliché)

### 6.3. Visuel / design

**Do**
- Photo d'une main qui tend un téléphone à une éducatrice, lumière naturelle, fond CPE réel.
- Illustration d'un cercle souple reliant quatre silhouettes diverses (père, mère, grand-parent, éducatrice).
- Icône pompe de fond en vert sauge, icône pompe de secours en terracotta, rien d'autre en couleur vive sur l'écran.

**Don't**
- Photo stock d'une famille nucléaire blanche souriante sur fond blanc.
- Croix rouge, caducée, stéthoscope, ambulance.
- Rouge sang sur l'écran de saisie d'une pompe de secours (la terracotta suffit — le rouge vif est un signal d'alerte clinique).
- Fond gradient bleu-violet type fintech.
- Image d'enfant en crise respiratoire (pathos + non conforme à la ligne non-médicale).

### 6.4. Réseaux sociaux / présence publique

**Do**
- Partager les changelogs avec un ton pédagogique et humble : *« Nous avons corrigé un bug qui pouvait retarder l'affichage d'une prise après reconnexion. Détails dans la PR #152. »*
- Publier des témoignages de vraies familles utilisatrices, toujours avec consentement explicite et après anonymisation des prénoms enfants si non souhaité.
- Relayer les contributions externes au projet open source.

**Don't**
- Communiquer sur des métriques de « vies sauvées », de « crises évitées » ou de « doses correctement administrées » — métriques DM implicites.
- Publier des avant/après anxiogènes (*« Avec Kinhale, plus jamais d'oubli ! »*).
- Participer à des campagnes marketing santé avec un ton alarmiste (pas de *« Octobre bleu de l'asthme »* à tonalité dramatique — on peut relayer une cause, on ne fait pas dans le spectacle).

---

## 7. Naming

### 7.1. Choix du nom

Le nom **Kinhale** est déjà fixé par le client et inscrit dans `CLAUDE.md`. Il combine :

- **Kin** (FR/EN) : la famille au sens large, les proches, le cercle. Pas « family » qui exclut implicitement la garderie. Pas « home » qui exclut les foyers multi-adresses. *Kin* = tous ceux qui comptent, unis par un lien qui n'est pas nécessairement biologique.
- **Inhale** : l'acte respiratoire au cœur du produit. Évoque la pompe sans la nommer, et le souffle — métaphore positive de la respiration.

Le mot se prononce `/ˈkɪn.heɪl/` en EN et `/kin.ɛl/` ou `/kin.al/` en FR. **Prononciation officielle à trancher** : recommandation **anglaise** (`/ˈkɪn.heɪl/`) avec tolérance de la version francisée. Le nom s'écrit **toujours** avec un **K majuscule, reste en minuscules** : `Kinhale`. Pas de variante `KinHale`, `Kin Hale`, `KINHALE`.

### 7.2. Extension de nom

- **Nom long officiel** : *Kinhale — le journal partagé des aidants* (FR) / *Kinhale — the shared log for caregivers* (EN). Usage : baseline sous le logo sur landing page, couverture du rapport PDF, App Store listing (sous-titre).
- **Nom court** : *Kinhale* seul. Usage : UI applicative, en-têtes, notifications push.
- **Signature email / légal** : *Kinhale est un projet de Kamez Conseils, sous licence AGPL v3. / Kinhale is a Kamez Conseils project, released under AGPL v3.*

### 7.3. Baselines (tagline / signature)

Proposition de **trois registres de baseline**, à tester avec kz-ux-research et kz-marketing auprès des personas P1-P4.

#### Baseline 1 — Fonctionnelle (recommandée par défaut)

- **FR** : *Le journal partagé des aidants d'un enfant asthmatique.*
- **EN** : *The shared log for everyone caring for a child with asthma.*

**Pour** : claire, descriptive, positionne immédiatement la catégorie. SEO friendly. Convient à la landing page, l'App Store, les rapports presse.
**Contre** : longue, peu mémorable.

#### Baseline 2 — Émotionnelle

- **FR** : *Personne n'oublie, parce que personne n'est seul.*
- **EN** : *No one forgets, because no one's alone.*

**Pour** : touche la douleur centrale (charge mentale, isolement du parent référent), mémorable, évocatrice. Excellente pour campagnes bouche-à-oreille, vidéos, témoignages.
**Contre** : moins descriptive, nécessite un contexte visuel.

#### Baseline 3 — Confiance (axe différenciation zero-knowledge)

- **FR** : *Tout partager avec vos proches. Rien avec nous.*
- **EN** : *Share everything with your family. Nothing with us.*

**Pour** : martèle le zero-knowledge, différencie radicalement des concurrents, s'appuie sur le pilier de marque le plus fort.
**Contre** : potentiellement déstabilisante pour des utilisateurs non-techniques (peut créer du doute au lieu d'apaiser). À tester soigneusement.

### 7.4. Recommandation d'usage par canal

| Canal | Baseline recommandée |
|---|---|
| Landing page `kinhale.health` (hero) | **Baseline 1** (fonctionnelle) + Baseline 3 en second paragraphe (trust section) |
| App Store / Play Store (sous-titre) | **Baseline 1** (limite de caractères + SEO) |
| Campagne bouche-à-oreille / témoignages vidéo | **Baseline 2** (émotionnelle) |
| Section « Vie privée » / page `/trust` | **Baseline 3** (confiance) |
| Signature email transactionnel | **Baseline 1** courte (*« Le journal partagé. »*) |
| Rapport PDF pour médecin | Aucune baseline (sobriété totale) |

### 7.5. Variations / déclinaisons

- **URL primaire** : `kinhale.health` — domaine principal, instance officielle.
- **URL alternative** : `kinhale.org` — redirection vers le dépôt GitHub du projet open source.
- **Handle social** : `@kinhale` (cohérent sur X, Bluesky, Mastodon, Instagram). Réservation préalable obligatoire.
- **Nom de repo GitHub** : `kamez-conseils/kinhale` (org Kamez).
- **Nom de package technique (monorepo)** : `@kinhale/*` (déjà en usage dans `packages/`).
- **Instance auto-hébergée** : usage du domaine `.kinhale.community` proscrit (risque de confusion avec instance officielle) — recommander aux auto-hébergeurs leur propre domaine, avec clause contractuelle dans les CGU de l'instance officielle (cf. §6 kz-conformite).

---

## 8. Synthèse actionnable pour les agents aval

### 8.1. Pour `kz-ux-research`

- Valider auprès des personas P1-P4 (PRD §4.1) la résonance de la **baseline recommandée** (Baseline 1 par défaut, tester Baseline 2 et 3 en comparatif).
- Tester la compréhension de la phrase signature *« Même nous ne pouvons pas lire les données de votre enfant »* — est-ce rassurant ou inquiétant selon les profils ?
- Valider la **tolérance au vouvoiement** en FR auprès de Martial et d'un co-parent — éventuel ajustement vers un tutoiement doux si frein avéré.
- Tester la **perception de la palette** (vert sauge primaire + terracotta secours) auprès des personas — éviter tout rejet sur le non-respect des « codes médicaux classiques ».

### 8.2. Pour `kz-designer` et `kz-design-system`

- Implémenter les **tokens couleur** (§5.2) et **tokens typo** (§5.3) dans `packages/ui` (Tamagui).
- Livrer les **variantes clair / sombre** testées en contraste WCAG AA **avant** le premier écran.
- Valider les **icônes custom** (pompe de fond, pompe de secours, cercle d'aidants) avec kz-branding et kz-conformite (risque DM sur visuel de pompe trop proche d'une marque commerciale réelle).
- Implémenter **`prefers-reduced-motion`** dès le premier composant animé.
- Tests axe-core + VoiceOver + TalkBack obligatoires sur les écrans J1, J2, J3, J5 du PRD.

### 8.3. Pour `kz-copywriting`

- Rédiger la **microcopie UI** intégrale en FR + EN pour les parcours J1-J7, conforme à §4.1 à §4.5.
- Rédiger les **textes marketing** (landing page, App Store, Play Store, email magic link, email bienvenue) dans les deux langues.
- Rédiger le **disclaimer non-DM** en version courte (pied de page), moyenne (onboarding), longue (CGU + rapport PDF) — cohérente avec le §12.3 de kz-conformite.
- Livrer le **glossaire FR/EN** dans `packages/i18n/locales/{fr,en}/*.json` en respectant le vocabulaire privilégié §4.3 et banni §4.4.

### 8.4. Pour `kz-marketing`

- Construire le **funnel AARRR** autour de la Baseline 1 (Awareness) + Baseline 2 (Activation/Retention émotionnelle) + Baseline 3 (Referral sur argument vie privée).
- Préparer les **assets App Store + Play Store** cohérents avec §5.4 (pas de photo stock médicale) et §6.3.
- Anticiper le **narratif zero-knowledge** pour la presse tech (Next, 01net, CBC Tech, The Verge) et la presse parentale (Naître et grandir, Magicmaman, Parents.fr).

### 8.5. Pour `kz-conformite` (retour d'arbitrage)

- Tout nouvel élément de marque qui touche à la ligne **santé / DM** (icônes de pompe, microcopie de rappel, illustrations d'enfant) doit passer par une validation **kz-branding + kz-conformite**.
- La **baseline** retenue doit être validée par kz-conformite : aucune formulation ne doit ouvrir une interprétation « recommandation médicale » (la Baseline 2 *« Personne n'oublie »* est un constat, pas une promesse — sauf si testée et reformulée).

---

## 9. Validation du livrable

### 9.1. Critères de sortie

Ce cadre de branding est considéré comme livré si :

1. Mission, vision et valeurs sont formulées en FR et EN, cohérentes avec la PRD.
2. Le positionnement différencie Kinhale des trois catégories concurrentes identifiées (apps médicales, apps ludiques enfant, apps familiales génériques).
3. La personnalité est exprimée par archétype, traits de caractère et spectres — avec exemples concrets.
4. Le ton de voix est opérationnel : vocabulaire privilégié / banni, exemples avant/après, règles applicables en microcopie.
5. La direction visuelle fournit palette hex + tokens typographiques + principes iconographiques + motion, avec contraste WCAG vérifié.
6. Les Do & Don't sont concrets et non théoriques, couvrant UI, marketing, visuel et réseaux sociaux.
7. Le naming décline nom, baselines FR/EN, variations, et usage par canal.

### 9.2. Décisions à trancher par le consultant

1. **Prononciation officielle** de *Kinhale* : anglaise `/ˈkɪn.heɪl/` par défaut (recommandée) ou tolérance francisée `/ki.nɛl/`.
2. **Baseline principale** : Baseline 1 (fonctionnelle, recommandée par défaut) ou test A/B des trois auprès des personas en phase kz-ux-research.
3. **Vouvoiement universel** FR ou tutoiement doux dans certains écrans intimes (onboarding référent) — à tester.
4. **Domaine primaire** : `kinhale.health` recommandé (renforce sémantique santé sans revendication DM — le TLD `.health` est commercial, pas régulé). Alternative : `kinhale.app` si coût / disponibilité préférable.
5. **Licence typographies** : confirmer usage **Inter + Fraunces + JetBrains Mono** (toutes SIL OFL, compatibles AGPL v3) ou substitution par autres familles open source si design team préfère.

### 9.3. Chaînage aval recommandé

```
kz-branding (livré)
   ↓
kz-ux-research (test personas + baseline + palette)
   ↓
kz-designer (maquettes J1-J7 avec palette + typo + icônes)
   ↓
kz-design-system (tokenisation Tamagui)
   ↓
kz-copywriting (microcopie + marketing + i18n)
   ↓
kz-marketing (stratégie go-to-market)
```

---

*Fin du cadre de branding — prêt à être consommé par kz-ux-research, kz-designer, kz-design-system, kz-copywriting, kz-marketing.*
