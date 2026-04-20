# Recherche utilisateur — Kinhale v1.0

> Rédigé par **kz-ux-research** le 2026-04-19 — Client : Martial (martial@wonupshop.com)
> Amont : `00-kz-discovery.md`, `00-kz-discovery-addendum.md`, `00-kz-product.md`, `00-kz-specs.md`, `00-kz-branding.md`, `00-kz-conformite.md`
> Aval : kz-designer, kz-design-system, kz-copywriting, kz-stories, kz-marketing

---

## Décisions UX validées (2026-04-19)

Les arbitrages ouverts par le livrable initial ont été tranchés par le consultant et doivent être traités comme définitifs par tous les agents en aval :

1. **Vocabulaire officiel** : **"pompe"** retenu pour l'ensemble de l'UI, y compris pour les utilisateurs français. Justification : le fondateur et la cible première sont québécois, "pompe" est également compris en France via le lexique populaire (contrairement à "inhalateur" qui sonne médical). Cohérent avec l'identité de marque non-prescriptive. Le terme "inhalateur" est banni de l'UI ; il peut apparaître uniquement dans le PDF d'export médical si un pneumologue le valide en v2.

2. **Validation du PDF d'export par un pneumo-pédiatre** : **reportée en v2**. La v1.0 livre un PDF fonctionnel basé sur le vécu fondateur + littérature GINA 2024. La validation clinique formelle sera menée avant la v2.0.

3. **Observation terrain CPE / garderie** : **hors périmètre v1.0**. Le persona Aïcha reste dans le livrable comme guide de design (basé sur littérature + vécu reporté), mais aucun travail terrain ne sera conduit. À reconsidérer en v1.1 si des retours utilisateurs CPE remontent.

4. **Onboarding des aidants non-tech (ex : Lise, grand-mère 68 ans)** : **double parcours coexistants en v1.0**.
   - **Parcours A — Auto-onboarding** : tout aidant peut ouvrir l'app seul et se configurer. Obligatoire : respecter le "test Lise" (utilisable seule sans assistance).
   - **Parcours B — Onboarding assisté par QR code d'invitation (flux recommandé par défaut)** : l'aidant principal (parent référent) génère depuis son device un code d'invitation court + QR code dans l'app. L'aidant secondaire (Lise, Marc, Fatou, Aïcha) scanne le QR code avec son téléphone, l'app génère localement ses propres clés cryptographiques, le device est ajouté au cercle de soin en 3 taps. Aucune clé privée ne transite par le relais — seul un ticket opaque d'invitation circule.
   - **Principe cryptographique** : compatible zero-knowledge. Le QR code contient uniquement un identifiant d'invitation + une clé publique éphémère ; la clé privée de Lise est générée sur son device et n'en sort jamais.
   - **Consentement Loi 25 / RGPD** : validation conformité requise avant lock design. Le consentement de Lise s'exprime au moment du scan (acceptation explicite de rejoindre le cercle de soin de l'enfant), pas avant.
   - Le designer doit maquetter les deux parcours comme deux entrées possibles au même funnel d'onboarding.

---

## Préambule

Ce document n'est pas un résumé des PRD ou des specs — il est leur **traduction humaine**. Là où `00-kz-product.md` décrit le quoi et `00-kz-specs.md` décrit le comment, ce livrable documente **pour qui**, **dans quel état émotionnel**, **à quel moment de la journée**, **avec quelle main libre**, **avec quel niveau d'anxiété résiduelle** Kinhale sera utilisé. Il a vocation à être le filtre d'arbitrage du designer quand aucune règle formelle ne tranche.

Kinhale n'est pas une app qu'on utilise posément assis à son bureau. C'est une app qu'on utilise **debout dans la cuisine à 7h42 avec un enfant à habiller**, **en pleine nuit quand on se réveille en sursaut**, **dans le hall d'une CPE bondée à 12h05**, **au téléphone avec sa mère à qui on vient de laisser l'enfant pour trois heures**. Chaque décision UX doit être jugée contre ces contextes, pas contre un Figma en chambre calme.

---

## 1. Méthodologie

### 1.1. Posture de recherche

La recherche utilisateur Kinhale s'appuie sur **trois sources primaires**, en l'absence — assumée, contrainte par le délai de 3 mois — de campagne d'interviews externes formelles.

1. **Le vécu direct du fondateur** comme *terrain primaire*. Martial est père d'une fille de 5 ans asthmatique, et son témoignage dans `00-kz-discovery.md` décrit les douleurs **vécues et non théoriques** qui ont fait naître le projet : réveils nocturnes pour vérifier si sa femme a donné la pompe, SMS perdus dans la coordination avec les grands-parents et la garderie, cahier papier oublié, anxiété de ne pas savoir répondre à la pneumologue. Ce vécu est **autoritatif** : il définit le persona P1 du PRD (Martial lui-même) sans approximation.

2. **La littérature scientifique pédiatrique et psycho-sociale** sur l'asthme et la coordination de soins chroniques :
   - **Global Initiative for Asthma (GINA) 2024** : protocoles de traitement étagés, importance de l'adhérence au traitement de fond, définition médicale du contrôle.
   - **Guidelines canadiennes** (Société canadienne de thoracologie, Société canadienne de pédiatrie) : posologies de référence, seuils de prise de secours, bonnes pratiques de plan d'action.
   - **Études psycho-sociales caregivers** : charge mentale différenciée entre parent référent et co-parent (Wood et al., 2018 ; Miadich et al., 2015), anxiété parentale comme prédicteur du contrôle de l'asthme de l'enfant, rôle des grands-parents et gardes non-parentales dans l'adhérence médicamenteuse (Mosnaim et al., 2021).
   - **Recherche en ergonomie des apps santé familiales** : Cozi, FamilyWall, MyTherapy — pattern du compte partagé, seuils d'abandon à l'onboarding.

3. **L'analyse concurrentielle directe** des apps asthme existantes, avec leurs limites documentées par le fondateur (`00-kz-discovery-addendum.md` Q16) et complétées ici :

| App | Plateforme | Force | Limite fondamentale pour Kinhale |
|---|---|---|---|
| **Inhalator / Wizdy** | iOS/Android | Simplicité d'usage, code couleur clair (le modèle cité par Martial) | **Mono-utilisateur**. Pas de partage, pas de coordination. Ludique pour l'enfant mais ne répond pas au problème familial. |
| **AsthmaMD** | iOS/Android | Journal détaillé, export PDF médecin | Payante, interface dense, pas de partage temps réel, onboarding de 20+ minutes. |
| **Kaia Asthma** | iOS | Exercices respiratoires, coaching | Payante, adulte asthmatique uniquement, posture de coaching qui flirte avec le statut DM. |
| **My Asthma Tracker (American Lung Association)** | Web | Gratuite, formulaires cliniques | Formulaires médicaux bruts, mono-utilisateur, UX datée, aucune notification push fiable. |
| **Propeller Health** | iOS/Android + capteur IoT | Capteur connecté sur l'inhalateur | Nécessite matériel propriétaire, données dans cloud US, B2B assureur, non accessible grand public francophone. |
| **Cozi / FamilyWall** | Multiplateforme | Compte partagé famille | Généralistes, pas de modèle traitement inhalé, pas de rapport médecin. |

**Verdict** : aucune app n'adresse la combinaison *multi-aidants + asthme pédiatrique + gratuit + hors-ligne + open source + respect vie privée*. Kinhale est seul sur sa catégorie — **ce qui signifie qu'il n'y a pas de benchmark ergonomique direct à copier**, et que chaque choix UX est à dériver du vécu et de la littérature, pas de l'observation concurrentielle.

### 1.2. Limites de la méthode — à adresser en v1.1

- **Pas d'interviews externes conduites** : les personas P3 (nounou), P4 (éducatrice CPE), P5 (grand-parent), P6 (enfant) sont **reconstruits** à partir du vécu fondateur + littérature. Ils doivent être confrontés à des utilisateurs réels dans les **2 premières semaines post-soft-launch** (Martial + 3-5 familles proches pilotes) avant la version publique.
- **Pas de tests de concept** : le nom Kinhale, la baseline, la palette vert sauge + terracotta n'ont pas été A/B testés. Recommandation : test qualitatif sur 5-8 personnes (réseau de Martial) **avant figeage du design system**.
- **Pas de recherche terrain en CPE** : l'observation directe d'une éducatrice administrant une pompe à 3-4 enfants n'a pas été conduite. Recommandation : 1 demi-journée d'observation en CPE de Laval ou Montréal, en phase de design détaillé, avec consentement direction + éducatrices (pas d'enregistrement enfants).

Ces limites sont **acceptables pour la v1.0** (Martial est son propre pilote, sa fille son propre terrain) mais doivent être formellement adressées en v1.1.

---

## 2. Personas d'aidants

Kinhale ne se différencie pas par son parent référent — **il se différencie par sa capacité à rendre invisibles les transitions entre aidants**. Six personas sont documentés, classés de l'usage le plus intense au plus ponctuel.

### 2.1. Persona P1 — Élodie, mère référente (34 ans, Montréal)

> *« Je sais que j'ai la charge mentale, mais je ne sais pas comment la partager sans devoir répéter cinq fois. »*

**Démographie**
- Âge : 34 ans.
- Profession : chargée de projet en communication, horaires semi-flexibles, télétravail 3 jours/semaine.
- Lieu : Montréal, arrondissement Rosemont. Locataire d'un 5½. RAMQ active.
- Composition familiale : conjoint Marc, 36 ans ; fille Léa, 5 ans, asthmatique diagnostiquée à 3 ans ; fils Noé, 2 ans, pas d'asthme.
- Profil numérique : iPhone 14, MacBook pro, Apple Watch. À l'aise avec Notion, Apple Santé, Slack. Utilise iMessage, WhatsApp, Safari. **Anti-abonnements** (évalue systématiquement le free tier).

**Contexte de vie**
- La famille est suivie au CHU Sainte-Justine. Rendez-vous tous les 3-4 mois avec la pneumo-pédiatre. Plan d'action papier conservé sur le frigo, mis à jour annuellement.
- Traitement de fond : Flovent 125 µg, 2 puffs matin + 2 puffs soir. Pompe de secours : Ventolin 100 µg, au besoin.
- Garderie : CPE à Rosemont, 4 jours/semaine. Éducatrice principale : Aïcha. Léa y prend sa dose de midi les jours d'école (plan d'action médical transmis).
- Grands-parents maternels vivent à Québec, gardent Léa un week-end par mois. Grands-parents paternels à Laval, gardent occasionnellement.
- Marc voyage 3-4 fois/an pour le travail (2-3 nuits), Élodie assume alors seule.

**Objectifs**
- Ne plus jamais **oublier une prise de fond** et ne plus **jamais en douter** après coup.
- Savoir en **3 secondes** si Marc a fait la prise avant de partir ce matin.
- Pouvoir répondre à la pneumo-pédiatre sur « combien de prises de secours ce mois-ci ? » **avec une vraie donnée**.
- Partager la charge mentale sans avoir à tout expliquer à chaque aidant.
- Ne pas ajouter un énième outil qui réclame de la maintenance.

**Douleurs**
- Impression que **même quand elle partage, elle reste responsable** (« si Marc oublie, c'est quand même à moi de vérifier »).
- **SMS multi-aidants qui se noient** dans le fil familial (alternés avec photos, liens, conversations scolaires).
- **Cahier de bord papier** oublié à la garderie, non-restituable à la maison.
- A déjà vécu un **double dosage** (elle a donné la pompe pensant que Marc ne l'avait pas fait) et une **dose manquée en pleine nuit** dont elle s'est rendu compte à 4h du matin.
- **Sentiment de culpabilité permanente** d'être la « gardienne du traitement ».

**Peurs spécifiques**
- Qu'une crise se déclenche **parce qu'elle a mal coordonné**.
- Qu'un **nouvel outil ajoute une tâche** au lieu d'en retirer une.
- Que ses **données de santé** d'enfant se retrouvent chez un géant US qui les exploite.
- D'avoir à expliquer **techniquement** à sa mère comment utiliser l'app (« ma mère et le numérique… »).

**Moments de vulnérabilité**
- **Vendredi soir quand elle dépose Léa chez ses parents** pour le week-end : elle veut une garantie que la pompe du soir et du matin seront faites, sans avoir à téléphoner trois fois.
- **Dimanche soir à 21h** quand elle réalise qu'elle n'a plus que 15 doses dans la pompe de fond et que le CLSC est fermé.
- **4h du matin** : réveillée par la toux de Léa, elle se demande « est-ce que j'ai donné la pompe hier soir ou pas ? ».
- **La veille d'un rendez-vous pneumo** à 9h le lendemain, elle veut un résumé propre, pas un cahier à déchiffrer.

**Rapport au numérique**
- Pragmatique. Installe une app, l'essaie 2 minutes, l'abandonne si friction. Ne lit pas les tutos.
- Méfiante du tracking publicitaire depuis le scandale Cambridge Analytica.
- **Cocher un consentement n'est pas une formalité pour elle** : si la politique est opaque, elle abandonne.

**Rapport au médical**
- Respect pour la pneumo-pédiatre, mais sait qu'elle a 20 minutes de consultation pour poser des questions précises. Prépare une **liste papier** avant chaque rendez-vous.
- Considère que l'asthme de Léa est **sa responsabilité à elle avant celle du médecin** — elle est la première ligne de surveillance.
- Refuse les apps qui « jouent au docteur ». Son exigence : Kinhale ne doit **jamais** donner de conseil médical, mais doit **toujours** être prêt à nourrir un dialogue avec la vraie médecin.

**Besoins Kinhale prioritaires**
1. **Onboarding < 2 minutes** (cf. O5 du PRD) : sinon elle abandonne.
2. **Visibilité temps réel** sur ce que Marc / Aïcha / sa mère ont fait.
3. **Rappel fiable** de la prise du soir, **redondant** (push + local + email), parce qu'elle peut rater un push avec la sonnerie coupée.
4. **Rapport PDF 1 page** imprimable ou à envoyer par email à la pneumo-pédiatre.
5. **Invitation des grands-parents sans leur demander de créer un compte** — ou avec une procédure qu'elle peut faire à leur place.
6. **Promesse vie privée tenue** et expliquée simplement : « même vous, vous ne pouvez pas lire mes données ? »

**Citations reconstituées (verbatims)**
- *« En fait, je veux juste savoir en ouvrant mon téléphone si c'est fait ou pas. Point. »*
- *« La dernière fois, j'ai donné la pompe deux fois parce que j'étais pas sûre. J'ai pas aimé ça. »*
- *« Si ça me prend trois écrans pour noter une prise, je vais arrêter au bout de trois jours. »*
- *« La pneumo m'a demandé "combien de secours ce mois-ci" et j'ai dit "euh… deux ? trois ?". Je veux plus jamais faire ça. »*
- *« Ma mère, elle va m'appeler pour me demander si elle doit appuyer sur OK. »*

---

### 2.2. Persona P2 — Marc, co-parent (36 ans, Montréal)

> *« Je la donne cette pompe, mais je suis jamais sûr si c'est moi qui devais ou si Élodie l'a déjà faite. »*

**Démographie**
- Âge : 36 ans.
- Profession : développeur senior, horaires flexibles, hybride 2 jours bureau / 3 jours maison.
- Lieu : même logement qu'Élodie.
- Profil numérique : iPhone 15, très à l'aise technique. Utilise volontiers les apps open source, apprécie la transparence.

**Contexte de vie**
- Implication parentale réelle mais **asymétrique** : Marc assume la prise du matin ~50 % des jours, la prise du soir ~30 % des jours. Il dépose Léa à la CPE 3 matins par semaine.
- A conscience de la charge mentale d'Élodie et **cherche à en prendre sa part**, mais reconnaît qu'il ne la pilote pas.
- Voyage professionnel 3-4 fois/an (2-3 nuits).

**Objectifs**
- **Savoir en ouvrant l'app si c'est son tour** (sans avoir à demander à Élodie).
- **Enregistrer une prise en un geste** (littéralement un tap).
- **Recevoir une notification si une prise prévue n'a été faite par personne**, pour agir.
- **Ne pas avoir à penser** à des paramètres, rappels, configuration.

**Douleurs**
- A déjà donné une **deuxième dose** parce qu'il pensait qu'Élodie avait oublié (elle l'avait faite 5 minutes avant).
- **Reçoit les SMS de planif** comme des reproches implicites, même quand ce n'est pas le cas.
- **Se sent responsabilisé par à-coups** (quand Élodie est absente), pas en continu.

**Peurs spécifiques**
- Être perçu comme **le parent qui décroche** sur la santé de sa fille.
- Que Kinhale devienne un **outil de contrôle mutuel** plutôt qu'un outil de coordination — c'est un piège à éviter dans la conception.
- Rater la prise du soir **pendant un déplacement professionnel** et ne pas avoir vu le rappel à temps.

**Moments de vulnérabilité**
- **Lundi matin 7h42**, cuisine, café dans une main, téléphone dans l'autre, Léa qui cherche son sac, Noé qui pleure. Il veut un bouton unique.
- **En voyage, mardi 20h, hôtel** : il veut vérifier à distance qu'Élodie a donné la pompe, sans la déranger.
- **Retour de voyage jeudi soir** : il veut voir d'un coup d'œil ce qui s'est passé en son absence.

**Rapport au numérique**
- Technique, curieux, **contribue à l'occasion à des projets open source**.
- Installerait Kinhale sur son NAS personnel si self-hosting était facile.
- **Exigeant sur la qualité technique** : un bug crypto ou une sync foireuse, et il évangélise contre le produit.

**Rapport au médical**
- Délègue à Élodie pour les consultations. Lit les ordonnances et les plans d'action. Comprend les notions de posologie, dose, fréquence.
- **Respecte la frontière non-DM** : ne veut pas que l'app lui dise quoi faire.

**Besoins Kinhale prioritaires**
1. **Écran d'accueil qui dit tout en 3 secondes** : « prise du soir faite par Élodie à 19:47 ».
2. **Widget iOS** ou raccourci Siri pour enregistrer une prise (hors scope v1.0 mais à anticiper v1.1).
3. **Notifications croisées neutres** : *« Élodie a donné la pompe à 19:47 »* — factuel, pas de reproche implicite s'il ne l'a pas faite.
4. **Zero-knowledge** expliqué correctement techniquement, pas juste « bank-grade encryption ». Il veut pouvoir lire le white paper.
5. **Self-hosting documenté** : optionnel pour lui, mais sa présence signale le sérieux du projet.

**Citations**
- *« Si ça marche bien, j'oublierai Kinhale — c'est le meilleur compliment que je puisse faire à un outil santé. »*
- *« Je veux pas qu'elle me fasse la leçon quand j'oublie. Factuel, c'est tout. »*
- *« Tu me dis c'est chiffré bout en bout ? Montre-moi le code. »*

---

### 2.3. Persona P3 — Lise, grand-mère (68 ans, Québec)

> *« J'ai tellement peur de mal faire que parfois je préfère appeler Élodie. »*

**Démographie**
- Âge : 68 ans, retraitée (ancienne enseignante).
- Lieu : Québec, appartement en résidence pour retraités autonomes.
- Profil numérique : iPad mini reçu à Noël. Sait faire FaceTime, Safari, lire des e-mails, prendre des photos. **Ne comprend pas les notifications push** (les laisse s'accumuler).
- Mari (grand-père Léa) : Jean, 72 ans, encore moins numérique.

**Contexte de vie**
- Garde Léa un week-end par mois (vendredi soir à dimanche soir). Parfois vacances scolaires (1 semaine l'été).
- Plan d'action asthme écrit par Élodie sur un **post-it collé sur le frigo**, complété par des explications orales au téléphone.
- Lise a eu une **crise d'angoisse** il y a 6 mois quand Léa a eu une petite toux et qu'elle ne savait pas quelle pompe donner. A appelé Élodie à 22h.

**Objectifs**
- **Ne pas faire d'erreur** avec sa petite-fille.
- **Être rassurée** que ce qu'elle fait est correct.
- **Pouvoir demander de l'aide simplement** sans se sentir diminuée.

**Douleurs**
- **Peur de mal faire** est son émotion dominante. Préfère sous-utiliser que se tromper.
- **Confusion pompe de fond / pompe de secours** (elle les confond si les boîtes se ressemblent).
- Les applications la **débordent visuellement** (trop de boutons, trop de textes, notifications qui font peur).

**Peurs spécifiques**
- **Casser l'appareil** en appuyant au mauvais endroit.
- **Envoyer par erreur** un message à quelqu'un.
- **Que ses données partent on-ne-sait-où**.
- **Se sentir jugée** si elle n'arrive pas à faire fonctionner l'app.
- Une **crise de Léa** pendant qu'elle est seule avec elle.

**Moments de vulnérabilité**
- **Dimanche 20h, moment de la pompe du soir** : elle veut un écran **immense, un seul bouton**, et une confirmation visuelle **très claire**.
- **Vendredi 19h, arrivée de Léa** : elle veut qu'on lui rappelle « pompe du soir à 20h » sans se perdre dans un menu.
- **Si Léa tousse** : elle veut savoir quoi faire, sans que l'app prétende être médecin.

**Rapport au numérique**
- **Déférent, prudent, facilement dépassée**. Évite les menus. Lit lentement.
- Préfère les **icônes claires et les mots courts**.
- Accepte l'aide de sa fille par téléphone (Élodie lui fait l'onboarding à distance).

**Rapport au médical**
- **Très respectueuse du médecin**, parfois jusqu'à l'excès (« je vais appeler pour rien »).
- Ne veut **surtout pas** qu'une app lui dise quoi faire « à la place du docteur ».
- Souvenir d'enfance de la peur de l'asthme (une cousine asthmatique dans les années 50-60).

**Besoins Kinhale prioritaires**
1. **Un seul écran, un seul gros bouton** : « Je viens de donner la pompe du soir ».
2. **Texte gros (body ≥ 18 px, idéalement 20 px) et contraste maximal**.
3. **Invitation sans création de compte** : Élodie lui envoie un lien, elle clique, elle est dedans.
4. **Pas de notification push agressive** : au maximum un rappel doux, un email fallback envoyé aussi à Élodie pour redondance.
5. **Accès facile à un bouton « J'appelle Élodie »** (ou équivalent visuel d'aide humaine) sans que ce soit un aveu d'échec.
6. **Lecture de l'historique simple et rassurante** : « dernière pompe de fond donnée par Élodie à 20h02 hier soir ». Juste pour vérifier.

**Citations**
- *« Je ne veux pas me tromper. Sinon, je préfère appeler ma fille. »*
- *« Écris-moi plus gros, je vois mal. »*
- *« Si ça me pose une question que je comprends pas, je ferme tout. »*
- *« Je ne sais pas c'est quoi "synchroniser". »*

**Note design critique** : Lise représente **30-40 % des aidants occasionnels** selon les études sur la garde familiale au Québec. **Un échec UX sur Lise = un échec de l'UVP Kinhale** (coordination multi-aidants). Chaque écran doit passer le « test Lise » : lisible en 5 secondes, sans menu, sans jargon.

---

### 2.4. Persona P4 — Fatou, assistante maternelle (41 ans, Paris)

> *« Je garde quatre enfants. J'ai pas le temps de remplir dix carnets différents. »*

**Démographie**
- Âge : 41 ans.
- Profession : assistante maternelle agréée (PMI Paris). 4 ans d'expérience. Garde 3-4 enfants à son domicile (agrément PMI).
- Lieu : Paris 19ème, appartement transformé en mini-MAM.
- Profil numérique : Android Samsung, WhatsApp, Facebook, app de paie (Pajemploi). Capable, mais pragmatique.

**Contexte de vie**
- Un des enfants qu'elle garde (Sofia, 3 ans) est asthmatique. Plan d'action signé par le pédiatre, transmis aux parents à l'inscription.
- Administre la **pompe de midi** à Sofia tous les jours, occasionnellement une prise de secours si toux à l'effort.
- Tient un **cahier de liaison papier** pour chacun des enfants, transmis aux parents le soir.
- A **4 enfants à gérer simultanément** : heure d'arrivée, sieste, goûter, activités, transmissions.

**Objectifs**
- **Enregistrer une prise en < 15 secondes**, idéalement 5 secondes, sans interrompre la surveillance du groupe.
- **Apporter une valeur ajoutée professionnelle** : preuves de prises, traçabilité en cas de litige.
- **Éviter la paperasse supplémentaire** : si Kinhale remplace son cahier, c'est un gain.
- **Ne pas avoir à créer de compte personnel** (protection vie perso / pro).

**Douleurs**
- **Interruptions constantes** : difficile d'ouvrir une app et de remplir 3 écrans.
- Parents qui lui demandent des **rappels texto** toute la journée.
- **Responsabilité juridique** : si elle oublie la pompe, ce peut être grave.
- Les apps de garde existantes sont **généralistes** et ne font pas le lien médicament (Babilou Family, Kinougarde, etc.).

**Peurs spécifiques**
- **Litige avec un parent** en cas de crise de Sofia : « vous aviez pas donné la pompe » / « si, je l'ai donnée à 12h08 ».
- **Contrôle PMI** : être en capacité de démontrer qu'elle respecte le plan d'action.
- **Surcharge technique** : devoir apprendre un outil spécifique pour **chaque** famille qu'elle accueille.

**Moments de vulnérabilité**
- **12h05, moment de la pompe de midi** : table à mettre, 4 enfants affamés, Sofia qui court partout. Elle veut **un bouton, une confirmation, terminé**.
- **Fin de journée, 18h30, parent qui arrive** : elle veut pouvoir dire « c'est fait, c'est dans l'app, vous avez la notif ».
- **Situation de toux à l'effort** : elle doit enregistrer vite, avec un minimum de symptômes, sans taper un roman.

**Rapport au numérique**
- **Opérationnel**. Si ça marche, elle utilise. Si ça bug, elle retourne au papier.
- Pas d'intérêt pour la technique sous-jacente, mais **vigilante sur la vie privée** (elle-même et les enfants).
- **Android-first** : si l'expérience Android est buggée, perte immédiate de ce segment.

**Rapport au médical**
- **Agent non-soignant conscient**. Elle administre un médicament prescrit à un enfant qui n'est pas le sien. Responsabilité lourde.
- **Respecte strictement** le plan d'action signé. Ne veut **pas** que l'app l'interprète à sa place.

**Besoins Kinhale prioritaires**
1. **Mode kiosque** ou accès via **QR + PIN sans création de compte** (RM4 de la spec).
2. **Interface mono-tâche** : pas d'historique global des autres enfants visible, pas de navigation parasite.
3. **Prise de secours avec symptômes en 2 taps** : grille d'icônes, multi-sélection, validation.
4. **Preuve horodatée** : horodatage serveur pour protéger en cas de litige (confirmation : « donnée à 12h08 »).
5. **Fonctionne hors-ligne** : son wifi personnel tombe parfois, et certaines sorties (parc, médiathèque) sont sans réseau.
6. **i18n FR parfaite** (vocabulaire métier : « prise », « pompe », pas « administration » ni « dose »).
7. **Possibilité pour les parents de révoquer son accès** en un clic quand l'enfant quitte la structure (règle RM5).

**Citations**
- *« Si c'est plus long que mon cahier, je prends pas. »*
- *« J'ai besoin d'une preuve horodatée, pas d'un ressenti. »*
- *« Pas question que je me crée un compte avec mon vrai email pour chaque famille. »*
- *« Si c'est chiffré même pour vous, c'est rassurant — les parents aimeront. »*

---

### 2.5. Persona P5 — Aïcha, éducatrice CPE (27 ans, Laval)

> *« Dans une pointe, j'ai vingt secondes pour tout ce qui n'est pas un enfant en train de pleurer. »*

**Démographie**
- Âge : 27 ans.
- Profession : éducatrice petite enfance, 4 ans d'expérience, CPE installation 64 places à Laval.
- Profil numérique : Android (téléphone pro partagé avec sa collègue) + tablette partagée de groupe. iPhone perso.
- Formation : DEC en techniques d'éducation à l'enfance. **A suivi une formation courte sur l'administration de médicaments prescrits** (protocole ministère Famille Québec).

**Contexte de vie**
- Gère un groupe de **10-12 enfants** de 3-4 ans, sous le protocole pédagogique de la CPE.
- **3 enfants** de son groupe ont un plan d'action pour administration de médicaments prescrits (1 asthme, 1 allergie sévère EpiPen, 1 antiépileptique).
- Administre la **pompe de midi** de Léa (fille d'Élodie), signée par la pneumo-pédiatre, avec protocole CPE : registre papier du CPE obligatoire + signature.
- **Wifi CPE médiocre** au sous-sol (salle de sieste, salle motrice), correct en salle principale.
- Environnement **bruyant** (10+ enfants), **sollicité en continu**, pression temporelle (repas 11h45-12h15, sieste 13h).

**Objectifs**
- **Respecter le protocole** (médicament donné à l'heure prescrite, journalisé, parent informé).
- **Gagner du temps** vs registre papier CPE (dans un monde idéal, Kinhale **complète** mais ne **remplace pas** le registre CPE — voir douleurs).
- **Être couverte juridiquement** : preuve horodatée de la prise.

**Douleurs**
- **Double saisie** : registre papier CPE obligatoire + app parentale = redondance non absorbable.
- Wifi qui coupe au sous-sol → l'app doit fonctionner **offline obligatoire**.
- Un téléphone pro partagé → **pas de compte perso à créer pour chaque enfant**.
- **Parents différents attendent des choses différentes** : Kinhale, Cozi, juste un texto… elle se perd.

**Peurs spécifiques**
- **Rupture de protocole CPE** : la direction doit valider toute nouvelle pratique. Kinhale ne peut pas remplacer le registre papier en v1.0 (c'est une contrainte réglementaire provinciale).
- Être **responsable** d'un oubli via une app bug.
- Un parent qui lit un rapport PDF et tire des conclusions sans contexte CPE.

**Moments de vulnérabilité**
- **12h07, pompe de Léa** : Léa finit son repas, les autres enfants réclament le dessert, la collègue aide à l'habillage. Elle a **5 secondes** pour enregistrer.
- **Début de journée, 7h50**, elle reçoit une invitation Kinhale d'Élodie. Elle a besoin qu'en **< 60 secondes** elle soit opérationnelle sur le téléphone pro partagé.
- **Fin de journée, 17h00**, parent qui arrive : elle veut que l'app confirme visuellement « prise faite à 12h07, transmise ».

**Rapport au numérique**
- Compétente, pragmatique. Zéro patience pour les apps lentes ou avec login qui se perd.
- **Ne lit aucune documentation**. Apprend par essai-erreur.
- **Android Samsung** : l'app doit être parfaite sur les modèles milieu de gamme (Samsung A-series).

**Rapport au médical**
- Forte culture de **protocole écrit** : ne fait que ce qui est formellement autorisé par le plan d'action signé.
- **Distinction stricte** entre son rôle (exécutante du protocole) et le rôle du pédiatre (prescripteur).

**Besoins Kinhale prioritaires**
1. **Écran d'accueil restreint CPE** : juste le prénom et la photo de Léa + un bouton « Pompe de midi donnée ». Pas d'historique des autres aidants (respect vie privée parents + évite distraction).
2. **QR + PIN, session 8 h** (RM5 de la spec) — rechargée chaque matin par un nouveau code si besoin.
3. **Saisie en < 10 secondes réels** (objectif O1 du PRD), mesurée en condition réelle.
4. **Confirmation haptique + visuelle** discrète (petite coche verte qui se dessine).
5. **Hors-ligne parfait** : saisie à 12h07 dans le sous-sol, synchro automatique en remontant vers 13h30 en salle principale.
6. **Traçabilité horodatée à la seconde** pour qu'Aïcha soit couverte en cas de litige.
7. **Révocation instantanée** par Élodie en fin de garde (Léa change de CPE en septembre).

**Citations**
- *« Si j'ai un compte à faire pour chaque enfant, j'arrête. »*
- *« Montre-moi un écran. Un bouton. J'appuie. Je retourne aux enfants. »*
- *« Le wifi au sous-sol, c'est mort. »*
- *« Mon cahier CPE, je peux pas m'en passer. Kinhale, c'est en plus, pas à la place. »*

---

### 2.6. Persona P6 — Léa, enfant asthmatique (5 ans aujourd'hui, grandira vers l'autonomie)

> *« Je veux choisir ma couleur de pompe moi-même. »*

**Note importante** : Léa **n'est pas utilisatrice directe de Kinhale v1.0**. Elle est l'**enfant au centre du dispositif**, et le design doit prendre position sur **quelle place** lui accorder, dès aujourd'hui, pour préparer son autonomie progressive (v2.0+ : âge 10-12 ans, portail enfant léger).

**Démographie & développement**
- 5 ans aujourd'hui, en maternelle grande section.
- Asthme diagnostiqué à 3 ans, modéré, bien contrôlé sous traitement de fond.
- Sait nommer « ma pompe bleue » et « ma pompe rouge » (secours). Ne comprend pas le mot « inhalateur ».

**Objectifs (vécus à travers les parents)**
- **Se sentir comme un enfant normal**. Ne pas être rappelée à son asthme en permanence.
- **Ne pas être traitée comme un malade**. L'asthme fait partie d'elle, mais ne la définit pas.
- **Avoir son mot à dire** (à 5 ans : choisir sa couleur de pompe préférée ; à 8 ans : savoir pourquoi elle prend sa pompe ; à 12 ans : prendre la responsabilité d'elle-même).

**Douleurs observées**
- Moquée à la maternelle (« t'es malade ») si la pompe est donnée à la vue des autres.
- **Ne veut plus** donner la pompe devant sa cousine qui lui pose des questions.
- **Fatigue** d'un traitement quotidien à son âge.

**Peurs spécifiques**
- **La crise elle-même** (mémoire somatique de la sensation de ne pas pouvoir respirer).
- Être **grondée** si elle oublie de dire qu'elle tousse.
- Perdre sa pompe de secours à l'école.

**Rapport à Kinhale**
- **Indirect en v1.0**. L'app est utilisée par les adultes autour d'elle.
- **Présence symbolique** recommandée : son **prénom en grand** sur l'écran d'accueil, une **photo optionnelle**, un **avatar choisi par elle** (v1.1). Kinhale tourne autour d'elle, pas des aidants.

**Ce qu'il ne faut jamais faire**
- **Pas de gamification** : pas de badges « 7 jours sans oubli ». Sa santé n'est pas un jeu, même encouragé.
- **Pas de pression symbolique** : pas de compteur rouge qui clignote, pas de message « Léa n'a pas reçu sa pompe ».
- **Pas de "profil enfant"** qui transforme Kinhale en outil de surveillance. C'est un outil de coordination **d'adultes qui coordonnent autour d'elle**, jamais un outil sur elle.

**Anticiper v2.0+**
- À 10-12 ans, un **volet enfant** pourra apparaître (vue simplifiée, auto-enregistrement de sa prise, lecture de son propre plan d'action).
- Cette évolution doit être **architecturalement prévue** dès v1.0 (compte enfant séparé, consentement parental / enfant distinct, droits granulaires).
- Le **respect de sa voix** doit être un principe fondateur, même avant qu'elle ait un accès direct.

**Citations reconstituées (parents rapportant)**
- *« Léa, elle veut pas qu'on en parle à table. »*
- *« Elle a dit "maman, ma pompe c'est mon affaire." Elle a 4 ans et demi. »*
- *« Quand elle sera grande, elle aura le droit d'être au courant de tout ce qu'on dit d'elle. »*

**Implication design**
- **Prénom enfant omniprésent mais digne** : jamais *« patient »*, *« profil enfant »*, *« subject »*. Juste « Léa ».
- **Photo optionnelle**, **floue ou absente par défaut** (respect vie privée mineur).
- **Langage respectueux** : on parle de « la pompe de Léa », pas de « sa médication ».
- **Préparer le terrain de l'autonomie** : la donnée doit être portable, exportable, transférable à un compte enfant le jour où il existe.

---

### 2.7. Synthèse matricielle des personas

| Dimension | Élodie (P1) | Marc (P2) | Lise (P3) | Fatou (P4) | Aïcha (P5) | Léa (P6) |
|---|---|---|---|---|---|---|
| Rôle Kinhale | Admin | Contributeur | Contributeur | Contributeur restreint | Contributeur restreint | Sujet, non-utilisatrice v1 |
| Fréquence d'usage | Plusieurs fois/jour | 1-2 fois/jour | 2-4 fois/mois | 1 fois/jour | 1 fois/jour | n/a |
| Appareil | iPhone | iPhone | iPad | Android | Android pro partagé | n/a |
| Aisance numérique | Haute | Très haute | Faible | Moyenne | Moyenne | n/a |
| Temps max tolérable par saisie | 10 s | 3 s | 20 s | 15 s | 5 s réels | n/a |
| Tolérance à l'erreur | Nulle | Basse | Nulle (peur) | Basse (pro) | Nulle (pro) | n/a |
| Connexion | Wifi + 5G | Wifi + 5G | Wifi appart | Wifi + 4G | Wifi CPE défaillant | n/a |
| Langue | FR Québec | FR Québec | FR Québec | FR France | FR Québec | FR Québec |
| Priorité vie privée | Haute | Très haute | Moyenne (si expliqué) | Haute | Haute | Maximale (enfant) |
| Sensibilité vouvoiement | Accepte | Accepte | Exige | Exige | Accepte | n/a |

---

## 3. Parcours utilisateur J1-J7 détaillés

Ces parcours correspondent aux 7 premiers jours d'usage type d'un foyer. Ils s'alignent avec les **User Journeys J1-J7** du PRD (`00-kz-product.md` §6) et avec les **workflows W1-W11** des specs (`00-kz-specs.md` §4) mais sont ici rédigés **du point de vue de l'utilisateur**, pas du système.

### J1 — Découverte, onboarding, recovery seed, profil enfant

**Contexte** : Élodie vient de sortir d'un rendez-vous avec la pneumo-pédiatre qui lui a suggéré de tenir un journal plus précis. Dans le métro (ligne verte, réseau cellulaire instable), elle cherche « asthme enfant app » sur l'App Store.

**Étape 1.1 — Découverte (durée < 30 s)**
- **Intention** : « comprendre en 5 secondes si cette app peut m'aider ».
- **Action** : ouverture App Store, lecture du sous-titre et des 3 premières captures d'écran.
- **Émotion** : sceptique (« encore une app de santé qui va me demander un abonnement »).
- **Friction potentielle** : si le sous-titre App Store parle de « health tracker » générique, elle zappe. **Nécessite** une formulation centrée *« journal partagé des aidants d'un enfant asthmatique »* (Baseline 1 du branding).
- **Opportunité de rassurer** : mention *« Gratuit, open source, chiffré de bout en bout »* lisible dès la première capture.

**Étape 1.2 — Installation et premier lancement (durée 15 s)**
- **Intention** : « voir le premier écran pour juger ».
- **Action** : tap « Installer », ouverture de l'app.
- **Émotion** : curiosité + prudence.
- **Friction potentielle** : écran de bienvenue trop long (texte de 3 paragraphes à lire). Abandon immédiat.
- **Recommandation** : écran d'accueil avec **1 phrase**, **1 illustration sobre**, **1 bouton Commencer**.

**Étape 1.3 — Consentement (durée 20-40 s)**
- **Intention** : « savoir ce que je signe, sans lire 10 pages ».
- **Action** : lecture du résumé de confidentialité (format **3 puces courtes** + lien vers politique complète).
- **Émotion** : lecture attentive quand elle voit « données de votre enfant », puis apaisement quand elle lit « chiffrées sur vos appareils, illisibles par nous ».
- **Friction potentielle** : case pré-cochée (interdit par Loi 25 + RGPD). Case non-cochée + obligation de cocher = bonne friction.
- **Recommandation** : affichage clair des consentements **granulaires** (identité enfant obligatoire, e-mail pour rapports optionnel, crash reports anonymisés optionnel).

**Étape 1.4 — Magic link (durée 30-60 s)**
- **Intention** : « utiliser mon email, pas inventer un énième mot de passe ».
- **Action** : saisie email, attente, bascule vers app Mail, tap lien.
- **Émotion** : léger agacement de l'aller-retour, mais rassurée de ne pas avoir de mot de passe à créer.
- **Friction potentielle** : lien magic link expiré (> 15 min). **Parade** : message clair de renvoi + bouton « renvoyer un nouveau lien ».
- **Recommandation** : **passkey** proposée en priorité sur iOS récents (biométrie native), magic link en fallback.

**Étape 1.5 — Génération de la recovery seed (durée 60-120 s — MOMENT CRITIQUE)**
- **Intention** : « comprendre pourquoi on me demande de noter 12 mots ».
- **Action** : affichage de 12 mots BIP39, instruction de les écrire et les conserver hors-ligne.
- **Émotion** : **angoisse potentielle** (« c'est comme la crypto, je vais tout perdre si je perds les mots »). Possible abandon.
- **Friction potentielle majeure** : **si la seed fait peur, elle crée l'effet inverse du produit.** Élodie doit comprendre que c'est **pour protéger Léa**, pas un geste technique gratuit.
- **Recommandation critique** : 
  - Écran d'explication **avant** l'affichage de la seed : *« Pour que même nous ne puissions pas lire les données de Léa, nous avons besoin que vous gardiez 12 mots de récupération. Ce sont VOS mots — personne d'autre ne les verra. Si vous perdez votre téléphone ET ces mots, nous ne pourrons pas vous aider à récupérer les données. C'est la contrepartie de notre promesse. »*
  - **Pas le mot "seed"**, trop technique. Préférer *« mots de sécurité »* / *« recovery words »*.
  - **Proposer plusieurs options de sauvegarde** : imprimer, copier dans un gestionnaire de mots de passe, écrire à la main. **Pas "noter dans les Notes iCloud"** (contradictoire avec le zero-knowledge).
  - **Vérification** : demander de re-saisir 3 mots aléatoires sur 12 pour confirmer qu'elle a bien noté (WCAG : clavier accessible).
  - **Bouton discret "Je comprends les risques et je continue sans noter maintenant"** en option de repli pour les utilisateurs qui veulent avancer — avec rappel à J+1 et J+3.

**Étape 1.6 — Profil enfant (durée 30-60 s)**
- **Intention** : « donner le minimum pour que ça marche ».
- **Action** : prénom de Léa, âge (5 ans — pas de date de naissance, minimisation RGPD/Loi 25), photo optionnelle (explicitement optionnelle).
- **Émotion** : neutre à positif (reconnaissance de l'enfant sur l'écran).
- **Recommandation** : pré-remplissage zéro, champs courts, un seul écran.

**Étape 1.7 — Première pompe de fond (durée 45-90 s)**
- **Intention** : « dire à l'app ce que Léa prend ».
- **Action** : sélectionner "Pompe de fond", nom générique (« Flovent 125 ») — **pas d'auto-complétion vers une base de médicaments** (risque DM), pas de recherche médicamenteuse — saisie libre avec placeholder d'exemple. Posologie : 2 puffs matin + 2 puffs soir (pré-sélection fréquente, configurable).
- **Friction potentielle** : si l'app suggère des noms de médicaments, elle flirte avec le DM.
- **Recommandation** : champ texte libre. Le nom de la pompe est une **étiquette utilisateur**, pas une information clinique vérifiée par l'app.

**Durée J1 totale cible** : **< 3 minutes** (dépassement du critère O5 du PRD de 2 minutes à cause de la recovery seed — **compromis acceptable** si la confiance gagnée compense).

**Risques de décrochage J1** :
- **Recovery seed** : 30-50 % de risque d'abandon si mal expliquée (d'après les études UX crypto-wallets grand public). Impératif d'en faire un moment rassurant.
- **Consentement trop long** : 15-20 % de risque si > 5 puces à lire.
- **Magic link qui n'arrive pas** : 10 % de risque (spam mail).

---

### J2 — Première prise, invitation co-parent

**Contexte** : Le lendemain matin, 7h38, cuisine, café, Léa qui cherche son sac.

**Étape 2.1 — Première saisie réelle d'une prise de fond (durée 5-8 s — MOMENT DE VÉRITÉ)**
- **Intention** : « je donne la pompe, je valide ».
- **Action** : ouverture app (Face ID), écran d'accueil dominant : **« Léa — Prise du matin prévue à 8h00 »**, gros bouton vert sauge *« Je viens de donner la pompe de fond »*, tap, confirmation haptique + coche.
- **Émotion** : satisfaction, **preuve que l'app tient sa promesse** de simplicité.
- **Friction potentielle** : si l'écran d'accueil demande de choisir quelle pompe (alors qu'il n'y en a qu'une seule de fond), friction inutile.
- **Recommandation** : **l'écran d'accueil à J+1 ne doit avoir qu'un seul gros bouton d'action**. Tout le reste est secondaire.

**Étape 2.2 — Invitation de Marc (durée 60-90 s)**
- **Intention** : « Marc doit avoir la même chose que moi ».
- **Action** : menu « Aidants » → « Inviter un aidant » → sélection du rôle **Contributeur** (pas « restreint » pour Marc) → génération d'un lien → envoi par iMessage.
- **Émotion** : confiance (« c'est simple, il n'aura pas de friction »).
- **Friction potentielle** : écran de sélection de rôle trop complexe (trop d'options, jargon).
- **Recommandation** : 3 rôles clairs avec **explications en langage de cuisine** : *« Famille proche »* (= Contributeur), *« Garderie / nounou »* (= Contributeur restreint). Pas « rôle » ni « permissions ».

**Étape 2.3 — Marc reçoit et rejoint (durée 45-90 s côté Marc)**
- **Intention** (Marc) : « comprendre et être dedans vite ».
- **Action** : tap lien iMessage, ouverture app Kinhale (ou App Store si pas installée, retour auto après install), magic link email, **sa propre recovery seed** (oui, chaque aidant a la sienne — cf. architecture E2EE).
- **Émotion** : curiosité + vérification technique (il consulte le GitHub dans la foulée).
- **Friction potentielle** : si Marc ressent l'invitation comme un **reproche implicite** (« Élodie me met sous surveillance »), rejet.
- **Recommandation** : **message d'invitation par défaut neutre** : *« Élodie vous invite à rejoindre le foyer Kinhale pour partager le suivi de Léa. »* Pas *« Élodie a besoin que vous participiez. »*

**Étape 2.4 — Écran Aidants partagés (durée 5 s côté Élodie après acceptation de Marc)**
- **Émotion** : **micro-victoire**. Voir Marc apparaître dans la liste = sentiment de ne plus être seule.
- **Recommandation** : animation d'entrée **discrète** (fade-in, pas de confettis), notif discrète côté Élodie : *« Marc a rejoint le foyer. »*

---

### J3 — Ajout d'un 3ème aidant, premier offline

**Contexte** : Vendredi soir, les parents déposent Léa chez Lise pour le week-end. Élodie veut ajouter Lise maintenant pour qu'elle soit opérationnelle dès dimanche matin.

**Étape 3.1 — Invitation de Lise en Contributeur (durée 2-3 minutes avec explication orale)**
- **Intention** : « que ma mère puisse juste cliquer sur OK pour dire qu'elle a donné la pompe ».
- **Action** : Élodie envoie un lien par SMS à Lise + appelle pour la guider au téléphone.
- **Friction majeure** : **Lise ne sait pas quoi faire du magic link**. Elle clique, ça ouvre Safari, elle ne comprend pas qu'il faut installer l'app.
- **Recommandation** : 
  - Lien d'invitation **détecte l'appareil** et bascule vers Play Store / App Store avec retour auto post-install.
  - **Étape manuelle simplifiée pour aidant non-technique** : Élodie peut **faire l'onboarding sur l'iPad de Lise pour elle** (avec sa permission), en mode « setup assisté ».
  - **Recovery seed de Lise** : elle ne la gère pas elle-même ; **Élodie peut la sauvegarder pour elle** (option explicite, traçable dans l'audit), avec consentement de Lise.

**Étape 3.2 — Premier offline (samedi matin, Lise chez elle, wifi coupé)**
- **Intention** (Lise) : « donner la pompe du matin à 8h ».
- **Action** : Lise ouvre l'app, voit le bouton, tap, confirmation locale visible (coche + message *« Prise enregistrée localement. Synchronisation dès que la connexion revient. »*).
- **Émotion** : surprise positive (« ah, ça marche même sans internet ? »).
- **Friction potentielle** : **message offline alarmant** qui fait peur à Lise (« oh non, ça n'a pas marché »).
- **Recommandation** : message offline **rassurant et factuel** : *« Prise enregistrée. Sera synchronisée avec le reste du foyer dès le retour de la connexion. »* Pas *« Erreur réseau »*, pas *« Hors-ligne »* en rouge.

**Étape 3.3 — Retour en ligne (samedi midi, wifi rétabli)**
- **Intention** : aucune action explicite requise.
- **Action système** : sync auto, notification discrète aux autres aidants : *« Lise a donné la pompe de fond à 8h02 (sync à 12h15). »*
- **Friction potentielle** : Élodie s'inquiète du décalage (« pourquoi c'est seulement maintenant ? »).
- **Recommandation** : affichage **explicite** du double horodatage dans la notif et dans l'historique : « administrée à 8h02, synchronisée à 12h15 ». Confiance vs cacher le décalage.

---

### J4 — Résolution d'un conflit (double saisie)

**Contexte** : Dimanche matin, 8h04, Lise donne la pompe à 8h02 mais oublie d'ouvrir l'app immédiatement. À 8h10, Élodie (à Montréal, inquiète) ouvre Kinhale, ne voit rien, et enregistre « rattrapage : je pense que ma mère vient de la donner ».

**Étape 4.1 — Double saisie détectée par le système**
- À 12h15, sync de Lise. Le serveur voit 2 prises proches (Lise à 8h02, Élodie à 8h10 en mode rattrapage).
- **Action système** : notification aux deux aidants : *« Deux prises enregistrées ce matin à 8h02 (Lise) et 8h10 (Élodie). Souhaitez-vous conserver les deux, ou marquer l'une d'elles comme à retirer ? »*
- **Émotion** : confusion légère, mais apaisée par le fait que l'app détecte le conflit et propose une résolution, ne décide pas seule.
- **Recommandation** : **résolution explicite par les humains, pas par l'algo**. Cf. spec §5.1 et RM4 : l'app propose, les aidants tranchent. Pas de « last-write-wins » silencieux sur un événement santé.

---

### J5 — Configuration des rappels, première notif reçue, journal consulté

**Contexte** : Lundi, 7h45. Élodie veut être sûre que Lise aura un rappel dimanche matin prochain sans intervention.

**Étape 5.1 — Configuration du rappel (durée 20-40 s)**
- **Intention** : « que Kinhale pousse la prise du matin sans que j'ai à y penser ».
- **Action** : menu « Rappels » → vérification des horaires (déjà pré-remplis à 8h00 et 20h00) → option « Envoyer aussi aux aidants en charge ce jour-là » → validation.
- **Friction potentielle** : si l'interface de gestion des rappels est dense (heures multiples, fenêtres, fréquences variables), Élodie se perd.
- **Recommandation** : écran de rappels **minimaliste** par défaut (2 horaires + bouton « personnaliser »), avec **options avancées cachées** derrière un lien.

**Étape 5.2 — Réception d'un rappel push (soir, 20h00)**
- **Intention** : « voir le rappel, confirmer si c'est fait ou à faire ».
- **Action** : notification push **opaque** : *« Kinhale — Nouvelle activité »* (conforme au cadre de conformité §1.2 : aucun contenu santé dans le payload APNs/FCM). Tap → app ouverte → écran d'accueil : *« Prise du soir prévue à 20h00 — à confirmer »*.
- **Friction potentielle** : **la notification opaque peut paraître vide de sens**. Élodie ne sait pas pourquoi on la notifie.
- **Recommandation** : **éducation en onboarding** sur le fait que les notifs Kinhale sont volontairement génériques pour protéger la vie privée. Message : *« Vos notifications ne révèlent jamais le nom de Léa ni ce qu'elle prend — elles vous invitent à ouvrir l'app. »*

**Étape 5.3 — Consultation de l'historique (durée 15-30 s)**
- **Intention** : « voir le fil du week-end ».
- **Action** : onglet « Historique » → vue chronologique, code couleur (vert sauge = prise de fond confirmée, gris = passé, terracotta = prise de secours, ambre = non confirmée), aidant nommé à côté de chaque entrée.
- **Émotion** : satisfaction forte (« je vois tout, enfin »).
- **Recommandation** : vue par défaut **7 derniers jours**, regroupement par jour, **un seul niveau de détail** (pas de tableau Excel-like).

---

### J6 — Situation de stress (prise de secours, dose oubliée)

**Contexte** : Mardi, 14h30. Appel de la CPE : Léa tousse à la sieste, Aïcha lui a donné le Ventolin. Élodie doit enregistrer.

**Étape 6.1 — Saisie d'une prise de secours par Aïcha (CPE, mode contributeur restreint)**
- **Intention** (Aïcha) : « enregistrer vite avant de retourner aux enfants ».
- **Action** : ouverture Kinhale sur tablette partagée (session déjà ouverte via QR+PIN du matin), gros bouton terracotta *« Pompe de secours »*, grille d'icônes symptômes (toux ✓, réveil de sieste ✓), circonstances (sieste ✓), commentaire optionnel (vide), validation.
- **Durée cible réelle** : 15-20 s.
- **Friction potentielle** : si la grille symptômes demande de choisir **parmi 20 items**, paralysie. Idéalement **6-8 icônes max** en premier écran, avec lien « voir plus » rarement utilisé.
- **Recommandation critique** : **aucune case ne doit avoir un libellé médical** (« dyspnée », « wheezing »). Langage de cuisine : « toux », « sifflement », « essoufflement », « réveil », « effort », « air froid », « autre ».

**Étape 6.2 — Notification reçue par Élodie (bureau, 14h32)**
- **Intention** : « comprendre vite ce qui se passe, sans paniquer ».
- **Action** : notif push opaque → ouverture app → écran d'accueil mis à jour : *« Prise de secours donnée par Aïcha à 14h30 — toux, réveil de sieste »* (avec liste concise des symptômes).
- **Émotion** : **pic d'anxiété**, mais tempéré par la factualité du message. Pas de « crise en cours », pas de « appelez le médecin ».
- **Recommandation** : **zéro alarmisme**. Le message est un **constat**, pas une interprétation. Le bouton secondaire *« Appeler Aïcha »* ou *« Appeler la CPE »* est discret, disponible mais pas agressif.
- **Garde-fou non-DM** : **aucun message de l'app ne doit suggérer d'action médicale**. Si Élodie veut appeler la pneumo, c'est son initiative, pas une recommandation de Kinhale.

**Étape 6.3 — Dose oubliée (soirée, 21h15)**
- **Contexte** : Élodie, perturbée par l'épisode de 14h30, oublie la pompe du soir de Léa. À 21h00, aucun aidant n'a confirmé.
- **Action système** : à 21h00 (après fenêtre de 30 min de tolérance), notification douce *« Prise du soir non confirmée »* — sans point d'exclamation, sans rouge. Si aucune réaction 30 min plus tard, rappel redondant + email fallback à Élodie.
- **Émotion** : culpabilité instinctive (« merde, j'ai oublié »). **Le ton du message doit éviter d'amplifier la culpabilité.**
- **Recommandation critique** : 
  - Libellé : *« Prise du soir non confirmée. Je l'ai donnée / Non, oubliée / Je vais la donner maintenant. »*
  - **Pas** : *« Attention ! Vous avez oublié la pompe de Léa ! »*.
  - **Pas** d'historique « dose manquée » qui **cumule** et ressemble à un score de mauvais parent. Afficher en neutre (gris), pas en rouge.
  - **Pas de gamification inverse** (« 3 doses manquées cette semaine »). Les données sont consultables au neutre pour le rapport médecin, pas étalées en tableau de bord comminatoire.

---

### J7 — Usage installé, check routine, export PDF pour pneumo-pédiatre

**Contexte** : Dimanche soir, veille du rendez-vous pneumo-pédiatre du lundi 9h. Élodie veut préparer.

**Étape 7.1 — Check routine (durée < 30 s)**
- **Intention** : « tout est à jour, tranquille ».
- **Action** : ouverture app, écran d'accueil affiche *« Dernière prise de fond : soir, 20:03 par Marc. Prise du matin demain à 8:00. »*, consultation rapide de la semaine.
- **Émotion** : apaisement. Routine installée. **L'app s'est effacée** : Élodie n'y pense plus qu'aux moments utiles.
- **Recommandation** : **ne jamais ajouter de "nouveautés" tape-à-l'œil** sur l'écran d'accueil. Pas de carrousel de conseils, pas de « saviez-vous que… », pas de push produit. L'app est un outil, pas un média.

**Étape 7.2 — Export PDF pour le médecin (durée 15-30 s)**
- **Intention** : « une page claire que je montre à la pneumo ».
- **Action** : menu « Rapport pour le médecin » → sélection période (dernier mois) → aperçu 1 page → bouton « Télécharger PDF » ou « Envoyer par email à soi-même ».
- **Émotion** : fierté (« j'arrive au rendez-vous préparée »).
- **Friction potentielle** : si le PDF fait 5 pages, si le graphique est illisible, si la pneumo met 3 min à le déchiffrer = échec.
- **Recommandation critique** : **PDF 1-2 pages max**, mise en page clinique mais sobre (pas de logos agressifs, pas de graphiques en 3D). Structure :
  - En-tête : prénom + âge + période + nom médecin optionnel.
  - Bloc 1 : observance pompe de fond (% confirmé, % manqué, % rattrapé).
  - Bloc 2 : prises de secours (tableau : date, heure, symptômes, circonstances, aidant).
  - Bloc 3 : incidents (remplacement pompe, alerte fin de pompe).
  - Pied de page : disclaimer **obligatoire** *« Ce document est un journal d'observance déclaré par les aidants de l'enfant. Il ne constitue ni un diagnostic ni une recommandation médicale. »*

**Étape 7.3 — Consultation chez la pneumo (lundi 9h)**
- La pneumo ouvre le PDF sur son ordinateur (envoi préalable par email), passe 30 secondes dessus, pose 2 questions précises, ajuste le traitement.
- **Moment de vérité externe** : si la pneumo dit *« C'est clair, c'est utile »*, Élodie devient ambassadrice. Si la pneumo fronce les sourcils ou ignore le document, Kinhale perd un allié clé.
- **Recommandation** : **validation formelle du PDF par au moins 1 pneumo-pédiatre** en phase de design (critère de sortie v1.0 §11.2 du PRD). Itération sur le format après retour direct.

---

### Récapitulatif des durées et criticités par parcours

| Parcours | Durée cible | Risque de décrochage | Moment de vérité |
|---|---|---|---|
| J1 | < 3 min | Haut (recovery seed) | Génération seed |
| J2 | < 10 s saisie | Bas | Première saisie |
| J3 | 2-3 min (avec Lise) | Moyen (onboarding non-tech) | Onboarding grand-parent |
| J4 | Asynchrone | Moyen (conflit) | Résolution de conflit |
| J5 | < 1 min | Bas | Première notif opaque |
| J6 | < 20 s saisie secours | **Très haut** (émotion + non-DM) | Message ni alarmiste ni fade |
| J7 | < 30 s export | Moyen (format PDF) | PDF lu par la pneumo |

---

## 4. Cartes d'empathie synthétiques (personas principaux)

### 4.1. Carte d'empathie — Élodie (P1, Admin)

| Dimension | Ce qu'elle dit | Ce qu'elle pense | Ce qu'elle ressent | Ce qu'elle fait |
|---|---|---|---|---|
| Entend | *« T'inquiète, je m'en occupe »* de Marc | « Encore moi qui porte tout » | Charge mentale pesante | Rappelle, vérifie, re-demande |
| Voit | Cahier papier CPE illisible, SMS perdus, pompe vide un dimanche | « On fait avec les moyens du bord » | Frustration | Photographie l'ordonnance pour pas oublier |
| Dit & fait | *« J'ai donné ? Tu as donné ? »* | « Il faut un système » | Fatigue | Essaie 2-3 apps, abandonne |
| Pense & ressent | *« Je veux dormir sans me réveiller pour vérifier »* | « Si je loupe, c'est moi qui aurai fauté » | Anxiété basse + persistante | Maintient une vigilance permanente |
| Douleurs | Charge mentale, double dose, rendez-vous pneumo flou | — | Culpabilité latente | — |
| Gains | Sommeil apaisé, rendez-vous pneumo clair, Marc autonome | — | Confiance | Recommande à une amie en foyer similaire |

### 4.2. Carte d'empathie — Lise (P3, Grand-mère)

| Dimension | Ce qu'elle dit | Ce qu'elle pense | Ce qu'elle ressent | Ce qu'elle fait |
|---|---|---|---|---|
| Entend | *« Maman, c'est simple, tu tapes juste là »* d'Élodie | « Simple pour eux, pas pour moi » | Infériorité numérique | Hoche la tête, fait semblant |
| Voit | Icônes qu'elle confond, textes trop petits | « Je comprends pas tout, je vais laisser » | Dépassée | Préfère le téléphone au numérique |
| Dit & fait | *« Appelle ta mère si tu sais pas »* à Jean | « Mieux vaut demander que se tromper » | Responsabilité + peur | Téléphone à sa fille avant d'agir |
| Pense & ressent | *« Si je me trompe, je ferais du mal à Léa »* | « C'est pas mon rôle de décider sur la santé » | Déférence | Applique strictement ce qu'Élodie dit |
| Douleurs | Peur, confusion, sentiment de diminuer | — | — | — |
| Gains | Sentiment d'utilité, de participer, d'être informée sans être responsable de tout | — | — | — |

### 4.3. Carte d'empathie — Aïcha (P5, Éducatrice CPE)

| Dimension | Ce qu'elle dit | Ce qu'elle pense | Ce qu'elle ressent | Ce qu'elle fait |
|---|---|---|---|---|
| Entend | Parents différents, plans d'action divers | « Pas le temps » | Pression temporelle | Priorise la sécurité |
| Voit | Groupe d'enfants, pompe, montre | « 12h05, faut que ce soit fait » | Concentration | Administre vite, note vite |
| Dit & fait | *« Pompe donnée, registre signé »* à sa collègue | « Chaque seconde compte » | Efficacité | 1 geste = 1 résultat |
| Pense & ressent | *« Je suis responsable, faut que ça trace »* | « Sans preuve, je suis pas couverte » | Vigilance professionnelle | Horodatage systématique |
| Douleurs | Double saisie cahier + app, wifi instable, téléphone partagé | — | — | — |
| Gains | Preuve horodatée, moins de papier, parents notifiés auto | — | Tranquillité pro | — |

---

## 5. Moments de vérité

Les **7 moments** ci-dessous sont ceux où la confiance dans Kinhale se gagne ou se perd **irréversiblement**. Ils doivent être prototypés, testés et itérés **en priorité absolue**.

### MV1 — La génération de la recovery seed (J1, étape 1.5)

**Pourquoi critique** : première confrontation à la promesse zero-knowledge. Si l'utilisateur part en pensant *« j'ai signé pour un truc crypto compliqué »*, Kinhale a perdu — il devient l'app des geeks, pas des familles.

**Ce qui se joue** :
- La promesse marketing (« même nous ne pouvons pas lire ») rencontre la réalité technique (12 mots à noter).
- L'utilisateur doit comprendre que **c'est la contrepartie honnête** de la promesse, pas une complication.
- La peur de « perdre les mots et donc perdre les données » doit être transformée en **responsabilité partagée rassurante**.

**Ce qui gagne la confiance** :
- Explication **avant** l'affichage de la seed, avec **2 phrases maximum** en langage non-tech.
- Plusieurs **options de sauvegarde concrètes** (imprimer, photo dans un endroit sûr, écrire à la main).
- **Vérification partielle** de la seed (3 mots sur 12) pour responsabiliser sans forcer l'apprentissage par cœur.
- Option de **sauvegarde assistée par un proche** (pour Lise, par exemple : Élodie l'aide).

**Ce qui détruit la confiance** :
- Le mot « seed » ou « BIP39 » exposé sans traduction.
- Des rappels anxiogènes (« attention, si vous perdez, tout est perdu »).
- Un écran trop long.

### MV2 — Première synchro entre deux aidants (J2, étape 2.4)

**Pourquoi critique** : preuve concrète que Kinhale fait ce qu'il promet (la coordination multi-aidants).

**Ce qui gagne la confiance** :
- Notification rapide (< 5 s) sur l'appareil du premier aidant quand le second rejoint.
- Visualisation **chaleureuse** de l'apparition du second aidant (« Marc a rejoint le foyer »).

**Ce qui détruit** :
- Latence de synchro > 30 s.
- Erreur de synchro qui impose à Marc de recommencer.

### MV3 — Première notification ratée ou trop tardive

**Pourquoi critique** : la promesse de fiabilité des rappels est le pilier 3 du PRD. **Une notification manquée = perte de confiance immédiate** selon le fondateur lui-même.

**Ce qui gagne la confiance** :
- Redondance (push + notif locale + email fallback) qui compense la défaillance d'un canal.
- Transparence en cas de problème connu (*« Un rappel est arrivé en retard ce matin, nous enquêtons »*).

**Ce qui détruit** :
- Dose manquée parce que le push n'est pas arrivé.
- Aucune explication, aucun canal de secours.

### MV4 — Première prise de secours (J6)

**Pourquoi critique** : Kinhale est utilisé dans un moment de stress réel, où le non-DM doit tenir.

**Ce qui gagne la confiance** :
- Saisie en < 20 s avec symptômes pertinents en langage de cuisine.
- Notification aux autres aidants **factuelle, non alarmiste**.
- Aucune suggestion médicale automatique.

**Ce qui détruit** :
- Formulaire complexe pendant que l'enfant tousse.
- Message type *« Crise en cours, appelez votre médecin »* = basculement DM.
- Silence radio côté notification.

### MV5 — Premier usage par un aidant non-technique seul (Lise dimanche matin)

**Pourquoi critique** : si l'aidant secondaire ne peut pas utiliser l'app sans appeler l'aidant principal, **Kinhale n'a pas réglé le problème** — il l'a déplacé.

**Ce qui gagne la confiance** :
- Écran qui demande **une seule chose** avec **un seul bouton**.
- Texte gros, contraste fort, aucun jargon.
- Confirmation visuelle et haptique très claire.

**Ce qui détruit** :
- Notification de synchronisation angoissante.
- Menu qui piège Lise sur un autre écran.
- Jargon technique (« échec de synchro », « token expiré »).

### MV6 — Première génération du rapport PDF (J7)

**Pourquoi critique** : c'est la **preuve d'utilité médicale** de Kinhale vis-à-vis du monde extérieur (pneumo-pédiatre). Si le PDF ne passe pas le test du médecin, Kinhale reste un gadget parental.

**Ce qui gagne la confiance** :
- 1 clic pour générer, < 5 s.
- 1-2 pages, structure claire, disclaimer visible mais non intrusif.
- Lisibilité sur écran pro du médecin.

**Ce qui détruit** :
- Rapport illisible, trop long, graphiques incompréhensibles.
- Absence de disclaimer (exposition juridique).
- Erreur dans les données exportées (inobservance affichée alors que des prises existent).

### MV7 — Première révocation d'un aidant (fin de garde, changement de CPE)

**Pourquoi critique** : la promesse d'**ouverture** (valeur Kinhale §1.3) inclut le droit de sortir. Si révoquer un aidant est compliqué, ou si l'aidant garde accès à un historique d'enfant qui n'est plus dans sa garde, la confiance s'érode.

**Ce qui gagne la confiance** :
- Menu « Aidants » → tap sur Aïcha → *« Retirer du foyer »* → confirmation → effet immédiat.
- Notification claire côté Aïcha : *« Votre accès au foyer de Léa est terminé. Merci. »*
- **Coupure effective immédiate** sur son appareil (plus aucun accès aux données historiques).

**Ce qui détruit** :
- Révocation partielle (l'aidant garde l'historique sur son appareil).
- Menu complexe pour révoquer.
- Absence de confirmation côté Aïcha (elle se connecte trois semaines plus tard et voit encore Léa).

---

## 6. Insights stratégiques actionnables

Douze insights, chacun accompagné de son **implication produit directe**. Ils sont à lire comme des règles d'arbitrage UX quand les specs ne tranchent pas.

### Insight 1 — La charge mentale ne se partage pas par la notification, elle se partage par la visibilité

**Observation** : Élodie ne veut pas **plus** de notifications — elle en a déjà trop. Elle veut **voir en 3 secondes** l'état d'une prise **sans avoir à demander**.

**Implication produit** :
- L'**écran d'accueil** est la colonne vertébrale de l'app, pas les notifications. Il doit dire *qui a fait quoi et quand* en moins de 3 secondes.
- Les notifications sont **complémentaires**, pas primaires. Règle : une notification n'existe que s'il y a une action possible ou un changement critique.
- Widgets iOS / Android (v1.1) : afficher l'état courant sur l'écran d'accueil du téléphone, 0 tap.

### Insight 2 — La simplicité Kinhale est une posture, pas une absence de fonctionnalités

**Observation** : Inhalator plaît à Martial parce que c'est simple, **pas** parce que c'est pauvre. La simplicité vient de la hiérarchie, pas de la réduction.

**Implication produit** :
- **1 action principale par écran**, toujours.
- **Actions secondaires** accessibles via un menu discret (⋯ ou icône avatar), jamais cohabitant avec l'action principale.
- **Paramètres avancés** cachés derrière un lien « Options avancées », pas visibles par défaut.
- Aucun onboarding ne doit excéder **5 écrans** (idéalement 3).

### Insight 3 — La recovery seed est le cygne noir de la confiance

**Observation** : toute la promesse zero-knowledge s'effondre si l'utilisateur abandonne à l'écran de la recovery seed. Et la majorité abandonnera si on ne l'accompagne pas.

**Implication produit** :
- **Dédier un parcours complet** à l'explication + la génération + la sauvegarde + la vérification de la recovery seed.
- **Langage non-technique absolu** : « mots de sécurité », jamais « seed », jamais « BIP39 ».
- **Tolérer le report** (« je sauvegarderai plus tard ») avec rappels J+1 et J+3, plutôt que bloquer.
- **Proposer des canaux de sauvegarde sûrs** (impression, copie dans un gestionnaire de mots de passe, à la main) et **bannir** le copier-coller dans iCloud Notes (contradiction avec E2EE).

### Insight 4 — Le grand-parent est le cas limite qui prouve l'UX

**Observation** : si Lise ne peut pas utiliser l'écran sans appeler Élodie, tout le produit échoue. Les millennials s'en sortent toujours ; les aidants occasionnels 60+ non.

**Implication produit** :
- **Chaque écran doit passer le "test Lise"** : compréhensible en 5 secondes, sans menu, sans jargon, avec du texte body ≥ 18 px.
- **Mode « aidant occasionnel »** : pour les aidants Contributeur non-admin, afficher un écran d'accueil **encore plus épuré** que celui de l'Admin.
- **Onboarding assisté** : l'Admin peut préparer le terrain (rôle, recovery seed, rappels) sur l'appareil de l'aidant occasionnel (avec consentement explicite, traçable).

### Insight 5 — Le QR + PIN sans compte est l'expérience signature côté aidants secondaires pro

**Observation** : demander à Fatou ou Aïcha de créer un compte avec leur email perso est un **déclencheur immédiat d'abandon**. Elles gardent 3-4-10 enfants, ne veulent pas multiplier les identités numériques.

**Implication produit** :
- **QR + PIN** comme méthode **par défaut** pour le rôle Contributeur restreint (pas une option avancée).
- **Session 8 h** par défaut (RM5 des specs) — rechargée le lendemain via un nouveau code fourni par l'Admin.
- **Écran mode kiosque** sur tablette partagée : plein écran, revient toujours au bouton principal, masque le multitâche.
- **Révocation instantanée** depuis l'Admin = coupure effective < 5 s (test E2E obligatoire).

### Insight 6 — Le vocabulaire de cuisine est une stratégie de non-DM, pas un caprice éditorial

**Observation** : chaque mot médical (« administrer », « posologie », « dose recommandée », « crise ») glisse Kinhale vers le statut de DM. Chaque mot de cuisine (« donner », « pompe du matin », « toux ») éloigne Kinhale du DM et rapproche Kinhale des aidants réels.

**Implication produit** :
- **Glossaire FR/EN** strict dans `packages/i18n/locales/` (cf. §4.3 du branding).
- **Règle ESLint `i18next/no-literal-string`** active sur `apps/` pour empêcher tout hardcodage (cf. CLAUDE.md).
- **Validation kz-conformite** sur chaque nouvelle chaîne UI.
- **Pas de traduction automatique** : traduction humaine FR Québec, FR France, EN Canada, EN international.

### Insight 7 — Les notifications Kinhale doivent être opaques en contenu et redondantes en canal

**Observation** : le cadre de conformité impose un payload push vide de contenu santé. Cela **contraint** l'UX mais **protège** les enfants. L'utilisateur doit être éduqué et non frustré.

**Implication produit** :
- **Payload push** = *{title: "Kinhale", body: "Nouvelle activité dans votre foyer"}*, jamais plus.
- **Redondance** : push + notif locale (timer OS) + email fallback après délai.
- **Onboarding** : expliquer l'opacité une fois, en 2 phrases : *« Vos notifications ne disent jamais le nom de Léa ni ce qu'elle prend. Ouvrir l'app est nécessaire pour voir le détail. C'est le prix de sa vie privée. »*

### Insight 8 — Le PDF médecin est le pont entre Kinhale et le monde extérieur

**Observation** : la pneumo-pédiatre n'ouvrira pas l'app, ne créera pas de compte, ne lira pas un email marketing. Elle ouvrira **un PDF** dans sa boîte mail pendant les 2 minutes avant la consultation.

**Implication produit** :
- **PDF 1-2 pages max**, mise en page cliniquement sobre.
- **Génération < 5 s, 1 clic**.
- **Disclaimer non-DM obligatoire** en pied de page (cadre de conformité).
- **Validation par au moins 1 pneumo-pédiatre partenaire** avant publication v1.0 (Definition of Done §11.2 PRD).

### Insight 9 — Le moteur de confiance est la transparence opérationnelle, pas les badges de sécurité

**Observation** : Marc (Persona P2) ne se laissera pas convaincre par un cadenas vert ou la mention « AES-256 bank-grade ». Il se laissera convaincre par l'accès au code, à l'infra, aux DPA.

**Implication produit** :
- **Page `/trust` publique** sur `kinhale.health` : liste des sous-traitants, hébergement, incidents passés, audits, politique de divulgation responsable.
- **White paper crypto** court (4-6 pages), langage accessible, renvoi vers le code.
- **Page « Comment ça marche »** dans l'app, accessible depuis le menu, **expliquant le E2EE en 3 paragraphes**.

### Insight 10 — Kinhale n'a pas de moment de célébration

**Observation** : la santé d'un enfant n'est pas un jeu. Pas de streaks, pas de badges, pas de confettis. Le ton est celui d'un outil fiable, pas d'un compagnon enthousiaste.

**Implication produit** :
- **Pas de gamification** sous aucune forme (cf. PRD §8.6, branding §4.4).
- **Confirmations discrètes** : coche qui se dessine sur 200 ms, haptique légère, message sobre.
- **Pas d'animations de célébration** (confettis, feux d'artifice, pulses persistants).
- **Motion design apaisé** : durées courtes, courbes ease-out, jamais de bounce (cf. branding §5.6).

### Insight 11 — Le vouvoiement est l'option de moindre risque relationnel

**Observation** : Kinhale parle à **tout le monde dans le foyer**. Tutoyer la nounou est inapproprié (registre pro), tutoyer la grand-mère est familier (elle peut le percevoir comme désinvolte), vouvoyer Élodie est neutre mais correct.

**Implication produit** :
- **Vouvoiement universel FR** décidé par kz-branding et confirmé ici.
- **Neutralité EN** : pas de *« Hey! »* familier, mais pas de *« Dear user »* corporate. Ton amical-professionnel.
- **Exception à qualifier** : emails transactionnels (magic link, rapports) à destination exclusive de l'Admin peuvent tester un tutoiement FR doux avec kz-copywriting.

### Insight 12 — Les moments de vulnérabilité sont des opportunités de fidélisation, pas des friction points à éviter

**Observation** : la nuit, la prise de secours, le rendez-vous médecin, le changement de CPE sont les moments où Kinhale gagne (ou perd) ses utilisateurs. **Bien traités, ils deviennent des ancrages émotionnels positifs.**

**Implication produit** :
- **Mode nuit automatique** à partir de 21h (ou selon horaire local) : baisse des contrastes extrêmes, taille de texte accentuée, haptique atténuée.
- **Chemin critique « secours »** court, symptômes en icônes large-tap, validation simplifiée.
- **Préparation du rendez-vous médecin** : rappel 24h avant *« Rendez-vous médecin dans 24h. Souhaitez-vous préparer le rapport ? »* (v1.1 recommandé).
- **Révocation aidant** comme moment digne : message de remerciement côté aidant révoqué, pas un « goodbye » froid.

---

## 7. Anti-personas — qui Kinhale n'est PAS pour

Les anti-personas sont **aussi importants** que les personas principaux : ils gravent les limites du produit et empêchent la dérive fonctionnelle.

### AP1 — Dr Nguyen, pneumo-pédiatre en consultation active (utilisatrice directe B2B)

**Kinhale v1.0 n'est pas conçu pour elle.**

- Elle consomme le **PDF exporté**, pas l'app.
- Aucune fonctionnalité n'est pensée pour une consultation médicale en direct, pour une vue multi-patients, pour un tableau de bord de cohorte.
- **En v2.0** : un portail pro distinct pourra exister (cf. roadmap PRD §7.3). **En v1.0** : explicitement non.

**Garde-fou** : aucune demande utilisatrice ne doit pousser à ajouter une « vue médecin » dans l'app v1.0. Si un pneumo-pédiatre demande, il peut consommer le PDF ou attendre v2.0.

### AP2 — Marc adulte asthmatique autonome (auto-suivi)

**Kinhale v1.0 n'est pas pour les asthmatiques adultes qui se suivent seuls.**

- Kinhale est fondé sur la coordination **multi-aidants autour d'un enfant**.
- Un adulte asthmatique seul n'a pas besoin de partage, d'invitations, de QR pour la garderie.
- Il peut techniquement utiliser Kinhale mais **la majorité des fonctionnalités** sont inutiles pour lui.

**Garde-fou** : ne pas ajouter de mode « adulte en auto-suivi » dans les parcours v1.0. Si le cas d'usage émerge, il fera l'objet d'un arbitrage produit en v2.0 (sans doute via un « profil adulte » secondaire).

### AP3 — Utilisateur attendant une alerte de crise automatique

**Kinhale v1.0 ne prétend PAS détecter une crise asthmatique en cours.**

- **Aucune fonctionnalité** ne génère une alerte santé auto : pas de « Attention, Léa a eu 3 prises de secours en 2 h, appelez le médecin », pas de score de crise, pas de push *« Urgence »*.
- Cette ligne rouge est **structurelle** et protège le statut non-DM (PRD §7.4, cadre de conformité §§2.1-2.5).

**Garde-fou** : toute demande utilisateur d'alerte auto-générée santé doit être refusée par le produit et tracée dans le backlog avec mention « Hors-scope structurel DM ». Réouverture uniquement via décision produit + kz-conformite + certification DM classe I ou plus.

### AP4 — Utilisateur voulant Kinhale comme messagerie familiale

**Kinhale n'est pas une app de chat.**

- Pas de messagerie bidirectionnelle entre aidants (*« Marc a écrit : J'ai oublié le Flovent »*).
- Pas de discussion sur un événement.
- Pas de fil de conversation.

**Garde-fou** : la notification croisée est un **constat**, pas un prétexte à chat. Les aidants communiquent hors Kinhale (iMessage, WhatsApp, téléphone). Kinhale reste mono-fonction : coordination.

### AP5 — Utilisateur cherchant une alternative au suivi médical professionnel

**Kinhale ne remplace ni le pneumo-pédiatre, ni le médecin traitant, ni le plan d'action médical papier.**

- Le disclaimer non-DM doit être **omniprésent** mais non stigmatisant.
- Si un utilisateur écrit dans un commentaire libre *« je veux savoir si c'est grave »*, l'app ne répond pas. Elle se contente d'enregistrer le texte.

**Garde-fou** : aucune fonctionnalité AI / chatbot / FAQ-santé dans Kinhale v1.0 ou v1.1. En v2.0+, une FAQ **éducative générique** (non personnalisée) pourrait être étudiée, avec validation kz-conformite.

### AP6 — Utilisateur attendant Kinhale monétisé freemium

**Kinhale ne sera jamais freemium B2C.**

- Aucune fonctionnalité n'est verrouillée derrière un paywall dans la v1.0, v1.1, v2.0 B2C.
- La monétisation éventuelle passera par le **B2B clinique** (v2+), invisible pour les familles.

**Garde-fou** : aucun « Premium » n'apparaît dans l'UI. Aucun écran de upsell. Aucune limitation de volume de prises, d'historique, d'aidants, de rapports.

### AP7 — Enfant de 10+ ans utilisateur autonome (anticipation)

**Kinhale v1.0 n'a pas de portail enfant.**

- Léa (5 ans) et tous les enfants utilisateurs sont des **sujets**, pas des utilisateurs directs.
- En v2.0+, un mode « enfant adolescent autonome » pourra exister, avec gestion du consentement parent/enfant.
- **En v1.0** : seuls les aidants adultes ont un accès direct.

**Garde-fou** : ne pas anticiper UX enfant dans v1.0 au risque d'infantiliser l'interface (risque Persona Léa §2.6). Préserver l'archi pour que v2.0+ soit possible sans dette.

---

## 8. Recommandations pour le designer — 10 principes d'interaction non-négociables

Les dix principes ci-dessous sont **obligatoires** et priment sur toute considération esthétique. Ils traduisent les insights en règles utilisables à chaque écran.

### P1 — « Test Lise » : tout écran est lisible en 5 secondes, d'une main, avec un enfant qui bouge

**Critères** :
- Texte courant ≥ 16 px, texte d'action ≥ 18 px.
- Touch targets ≥ 44×44 pt (Apple HIG + WCAG).
- Une seule action primaire par écran, bouton dominant ≥ 48 px de haut.
- Aucune action critique dans un menu ≥ 2 niveaux de profondeur.

### P2 — Recovery seed : ce n'est jamais un obstacle, c'est un moment de confiance

**Critères** :
- Explication **avant** affichage (2 phrases max, langage non-tech).
- Options de sauvegarde multiples (imprimer, noter, gestionnaire de mots de passe).
- Vérification partielle (3/12) pour responsabiliser sans piéger.
- Option de report (« je le ferai plus tard ») avec rappels doux J+1, J+3.
- Vocabulaire : *« mots de sécurité »* / *« recovery words »*, **jamais** « seed » ou « BIP39 ».

### P3 — Aucun écran ne fait peur, aucun écran ne minimise

**Critères** :
- Microcopie factuelle, jamais d'exclamation (*« Prise non confirmée »*, **pas** *« Vous avez oublié ! »*).
- Pas de rouge vif sur un statut. Ambre (`#C9883C`) pour attention douce, terracotta (`#B94A3E`) **uniquement** pour pompe de secours.
- Pas d'émoji décoratif ni d'icône exclamative dans un message système.
- Confirmation d'une action : coche discrète 200 ms + texte sobre, pas de fanfare.

### P4 — Une action principale, point

**Critères** :
- Écran d'accueil : un seul bouton dominant (*« Je viens de donner la pompe de fond »* ou *« Pompe de secours »* selon contexte).
- Actions secondaires accessibles par icônes discrètes (menu aidants, historique, rapport, paramètres).
- Aucune pub, aucun carrousel, aucune « nouveauté » tape-à-l'œil.
- Pas de tab bar à 5 icônes : privilégier 3 tabs maximum ou navigation contextuelle.

### P5 — Hors-ligne n'est pas une erreur, c'est un mode de fonctionnement

**Critères** :
- Indicateur hors-ligne **discret** (badge en haut, pas modal bloquante).
- Saisie en hors-ligne avec confirmation locale immédiate.
- Message de synchronisation à la reconnexion : factuel, rassurant (*« Sync terminée, tout est à jour »*).
- Aucun message type *« Erreur réseau »*, *« Échec de connexion »* en rouge plein écran.

### P6 — Le vocabulaire est un pilier de sécurité juridique

**Critères** :
- Respect strict du glossaire FR/EN (cf. branding §4.3).
- Interdiction des termes médicaux prescriptifs (« administrer », « posologie », « dose recommandée », « crise »).
- Validation kz-conformite sur chaque nouvelle chaîne touchant à la santé.
- `i18next/no-literal-string` actif en ESLint sur `apps/`.

### P7 — Les notifications sont opaques en contenu, expressives en design

**Critères** :
- Payload APNs/FCM toujours générique (cf. conformité §1.2).
- Dans l'app, les notifications internes peuvent afficher prénom + action (car déjà chiffrées localement).
- Redondance push + local + email : ne pas inventer, respecter RM6 des specs.
- Son par défaut discret (non anxiogène), paramétrable.

### P8 — Accessibilité WCAG 2.1 AA est un prérequis, pas un plus

**Critères** :
- Contraste ≥ 4.5:1 texte normal, ≥ 3:1 large / UI.
- Support VoiceOver (iOS) + TalkBack (Android) + lecteur d'écran web (NVDA, JAWS).
- Navigation clavier complète sur web.
- Dynamic Type iOS et équivalent respectés jusqu'à 200 % sans rupture layout.
- `prefers-reduced-motion` honoré sur toute animation.
- Tests axe-core en CI, tests manuels screen reader sur J1, J2, J3, J5, J6.

### P9 — Aucune gamification, aucune fausse réassurance, aucune urgence auto-générée

**Critères** :
- Pas de streaks, badges, scores, classements.
- Pas de *« Pas d'inquiétude »*, *« Tout va bien »*, *« Super »* en réponse à un événement santé.
- Pas d'*« Alerte »*, *« Urgent »*, *« Critique »* auto-générés.
- Pas de message type *« Appelez votre médecin »* (sauf disclaimer légal statique en pied de page).

### P10 — L'app doit s'effacer quand elle fait son travail

**Critères** :
- Écran d'accueil par défaut : factuel, silencieux, prêt à agir.
- Notifications limitées à 1-2 par jour en usage normal (rappels + éventuel retard).
- Aucun upsell, aucun cross-sell, aucune « nouveauté » poussée.
- Pas de carrousel marketing, pas de demande d'avis App Store après chaque geste.
- Usage mature de Kinhale = 5 secondes par jour, **par design**.

---

## 9. Annexes

### 9.1. Particularités Québec vs France à intégrer dans la conception

| Dimension | Québec | France |
|---|---|---|
| Système de santé | RAMQ, CLSC, CHU Sainte-Justine | Assurance maladie, PMI (0-6 ans), pédiatre de ville |
| Garde enfant | CPE, garderie privée, milieu familial (Aïcha, P5) | Crèche municipale, micro-crèche, assistante maternelle agréée (Fatou, P4), école dès 3 ans |
| Vocabulaire garde | *« CPE »*, *« éducatrice »*, *« milieu familial »*, *« garde »* | *« crèche »*, *« assistante maternelle »*, *« nounou »*, *« garderie »* |
| Vocabulaire santé | *« médecin de famille »*, *« pneumo-pédiatre »*, *« pharmacien »*, *« pompe »* | *« médecin traitant »*, *« pneumo-pédiatre »*, *« pharmacien »*, *« inhalateur »* / *« pompe »* |
| Registre linguistique | Vouvoiement poli, expressions locales (« faire l'épicerie ») tolérées mais non systématiques | Vouvoiement attendu, expressions régionales évitées |
| Documents administratifs | Plan d'action asthme CHU Sainte-Justine / SCP | Plan d'action asthme HAS / SFP / Safrec |
| Régime vie privée | Loi 25 + PIPEDA | RGPD |
| Sensibilité vie privée | Forte mais plus technique | Très forte, plus militante |
| Ligne rouge DM | Santé Canada, MDEL, classification DM | ANSM, marquage CE, IVDR / MDR |
| Attentes communautaires | Open source apprécié, Kamez (Montréal) légitime | Open source valorisé, méfiance des SaaS US |

**Implication produit** :
- **i18n FR sépare `fr-CA` et `fr-FR`** dans `packages/i18n/locales/` (cf. CLAUDE.md).
- **Vocabulaire de l'app** : une variable `inhaler_term` résout en « pompe » (CA) / « pompe » ou « inhalateur » (FR, à qualifier).
- **Disclaimers légaux adaptés** par juridiction (Loi 25 au Québec, RGPD en France, bilingue par défaut).
- **Adresses postales RPRP** différenciées dans la politique de confidentialité.

### 9.2. Alignement avec les règles métier (RM1-RM9) des specs

Pour faciliter le travail du designer, voici le mapping des personas/parcours avec les règles métier définies dans `00-kz-specs.md` :

| Parcours | Personas impactés | Règles métier concernées |
|---|---|---|
| J1 Onboarding | Élodie (P1) | RM1 (Admin permanent), RM3 (consentement) |
| J2 Invitation Marc | Élodie, Marc | RM1, RM8 (audit) |
| J3-J4 Grand-parent, offline, conflit | Élodie, Lise | RM2 (Dose et Plan), RM4 (résolution conflit), RM6 (sync) |
| J5 Rappels, notifs | Élodie, Marc | RM2, RM6 (notifications redondantes) |
| J6 Secours, dose manquée | Élodie, Marc, Aïcha | RM2 (fenêtre confirmation), RM6, RM9 (non-DM) |
| J7 Export PDF | Élodie, Dr Nguyen (indirecte) | RM7 (rapport + disclaimer), RM8 (audit export) |

Les règles RM sont définies dans `00-kz-specs.md` §5. Toute évolution UX doit être confrontée à ces règles par kz-conformite avant implémentation.

### 9.3. Questions ouvertes à valider en phase design

1. **Recovery seed** : valider avec Martial et Marc (les deux profils extrêmes — moyen-tech et très-tech) l'explication proposée avant affichage. Tester aussi avec Lise par téléphone pour mesurer le taux d'incompréhension.
2. **Disclaimer non-DM** : formuler avec kz-copywriting une version courte (20 mots max) qui passe les critères de conformité sans paraître effrayante.
3. **Format PDF médecin** : obtenir un retour formel d'au moins 1 pneumo-pédiatre de Sainte-Justine ou équivalent avant design détaillé.
4. **Vocabulaire « inhalateur » vs « pompe »** : décision définitive FR-FR (Martial fréquente le réseau québécois, mais la cible FR-FR est importante).
5. **Onboarding assisté par un proche** : workflow à formaliser (Admin onboarde Lise depuis l'appareil de Lise, avec consentement explicite). À co-concevoir avec kz-designer.
6. **Révocation et conservation de l'historique local** : quand Aïcha est révoquée, qu'advient-il des données sur son appareil ? À trancher avec kz-securite et kz-conformite (piste : effacement local forcé à la prochaine connexion post-révocation).

### 9.4. Chaînage recommandé en aval

```
kz-ux-research (livré)
   ↓
kz-designer (maquettes J1-J7 avec tous les personas, validation "test Lise")
   ↓
kz-design-system (tokens et composants Tamagui conformes à §8)
   ↓
kz-copywriting (microcopie FR-CA / FR-FR / EN-CA / EN-INT respectant §6 et §8)
   ↓
kz-stories (backlog Sprint prenant en compte les moments de vérité §5)
```

---

## 10. Validation du livrable

### 10.1. Critères de sortie

Ce livrable de recherche utilisateur est considéré comme produit si :

1. 6 personas sont documentés, avec démographie, contexte, objectifs, douleurs, peurs, verbatims, besoins Kinhale prioritaires.
2. Les 7 parcours J1-J7 sont détaillés avec durée cible, frictions, opportunités, émotions, recommandations design.
3. 3 cartes d'empathie minimum sont livrées pour les personas principaux (Élodie, Lise, Aïcha).
4. Les moments de vérité (5-7) sont identifiés avec ce qui gagne / détruit la confiance.
5. 10-12 insights stratégiques sont formulés avec implication produit.
6. Les anti-personas (≥ 5) sont explicités pour protéger la ligne non-DM et le scope.
7. 10 principes d'interaction non-négociables sont livrés, directement exploitables par le designer.
8. Les spécificités Québec / France sont adressées (vouvoiement, RAMQ/sécu, CPE/crèche, vocabulaire).

### 10.2. Décisions à confirmer par le consultant

- **Confrontation terrain post-soft-launch** : valider le plan d'entretiens sur 5-8 familles dans les 2 semaines suivant le lancement fermé (Martial + 3-5 pilotes).
- **Observation en CPE** : planifier une demi-journée en CPE Laval/Montréal en phase de design détaillé.
- **Validation du PDF par un pneumo-pédiatre** : identifier et contractualiser 1 partenaire pneumo-pédiatre prêt à critiquer le format (avant critère de sortie §11.2 du PRD).
- **Onboarding assisté** (Admin pour Lise) : valider le workflow avec kz-conformite (consentement explicite, audit trail).
- **Vocabulaire « inhalateur » / « pompe »** en FR-FR : à trancher avec kz-copywriting et kz-conformite.

---

*Fin du livrable de recherche utilisateur — prêt à être consommé par kz-designer, kz-design-system, kz-copywriting, kz-stories, kz-marketing.*
