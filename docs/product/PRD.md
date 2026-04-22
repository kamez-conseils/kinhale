# PRD — Kinhale v1.0

> **Document de cadrage produit (Product Requirements Document)**
> Version : 0.1.0 — Date : 2026-04-19
> Licence : AGPL v3
> Description courte : vision, personas, parcours utilisateur et périmètre fonctionnel de la v1.0 de Kinhale, application open source de coordination des prises de pompes d'un enfant asthmatique.

---

## 1. Résumé exécutif

**Kinhale** est une application multi-plateformes (web + iOS + Android) **open source et gratuite**, destinée aux familles du monde entier dont un enfant est asthmatique. Elle permet à tous les aidants (parents, grands-parents, garderie, nounou) de **coordonner, tracer et partager en temps réel** les prises de pompes de fond et de secours, de recevoir des rappels fiables, et de générer un rapport médical exportable. La v1.0 vise un périmètre resserré (1 enfant par compte). Une v1.1 ouvre la fratrie ; une v2.0 à horizon 6-12 mois intègre HealthKit / Health Connect, un portail pro pour les pneumo-pédiatres, et une offre B2B pour cliniques. Le code est publié sous **AGPL v3** et une instance officielle est hébergée au Canada par Kamez.

## 2. Vision produit

- **Mission** : Donner à chaque famille vivant avec l'asthme d'un enfant l'outil le plus simple et le plus fiable possible pour coordonner son traitement, sans jamais se substituer au médecin.
- **Vision long terme (2-3 ans)** : Devenir la référence open source du suivi d'observance pédiatrique dans l'asthme, utilisée par des dizaines de milliers de foyers et recommandée par les pneumo-pédiatres au Canada, en France et au-delà. Ouvrir progressivement à d'autres pathologies chroniques pédiatriques partageant la même logique (épilepsie, diabète T1, dermatite atopique).
- **Proposition de valeur unique (UVP)** : *« La seule application qui synchronise tous les aidants d'un enfant asthmatique — parents, grands-parents, garderie — en temps réel, fonctionne hors-ligne, se configure en 2 minutes, et reste gratuite et open source. »*
- **Manifeste produit (5 principes directeurs)**
  1. **Simplicité absolue** — Une prise s'enregistre en moins de 10 secondes, tactile, code couleur, jamais de formulaire long.
  2. **Fiabilité critique** — Une notification manquée = une perte de confiance définitive. Redondance (push + local + e-mail) et tests E2E non négociables.
  3. **Hors-ligne par défaut** — L'app doit fonctionner dans une garderie en sous-sol sans wifi. La synchro est un détail technique, pas une condition d'usage.
  4. **Ouverture par défaut** — Code public, licence libre, instance officielle gratuite, exportation des données toujours possible. Aucun verrou propriétaire.
  5. **Jamais médecin** — L'app journalise, rappelle, partage. Elle ne recommande **jamais** une dose, ne diagnostique **jamais**, ne remplace **jamais** un avis médical. Disclaimer omniprésent.

## 3. Problème utilisateur

**Problème central** : dans un foyer où plusieurs personnes administrent un traitement inhalé à un même enfant, **aucun outil partagé ne garantit qu'aucune dose n'est oubliée, dupliquée, ou mal tracée**. Le résultat est une charge mentale permanente pour le parent référent, des trous dans le suivi médical, et un risque sanitaire réel.

**Douleurs observées**
1. **Oublis d'horaires sur la pompe de fond** (matin/soir) — aggravés par la variabilité du quotidien (école, week-end, voyage).
2. **Absence de visibilité entre aidants** — « Tu lui as donné ? Je ne sais pas, demande à ta mère. » Risque de double dose ou de dose manquée.
3. **Aucune alerte automatique en cas de dose manquée** — le parent s'en rend compte plusieurs heures après, parfois en pleine nuit.
4. **Historique non-restituable au médecin** — impossible de répondre précisément à « Combien de prises de secours ce mois-ci ? » ou « Dans quelles circonstances ? ».
5. **Fin de pompe imprévue** — rupture de médicament un dimanche soir, panique.
6. **Apps existantes inadaptées** — soit payantes, soit sur-configurées, soit mono-utilisateur (pas de partage).

**Coûts actuels**
- **Temps perdu** : ~5-10 minutes/jour de coordination verbale ou SMS entre aidants, fatigue de la répétition.
- **Anxiété** : charge mentale permanente du parent référent (souvent un seul parent assume la vigilance).
- **Risque de santé** : une crise évitable si l'observance du traitement de fond est dégradée ; prise de secours tardive par incertitude sur l'horaire de la précédente.
- **Perte d'information médicale** : consultations moins efficaces, ajustements de traitement basés sur le ressenti parental plutôt que sur des données.

## 4. Utilisateurs cibles

### 4.1. Personas détaillés

#### Persona 1 — Parent référent (38 ans, Montréal)
- **Contexte** : Parent de deux enfants. Sa fille de 5 ans est en début d'asthme, traitement quotidien + pompe de secours. Travaille à distance, non-soignant mais à l'aise avec le numérique.
- **Objectifs** : Ne plus jamais oublier une prise ; savoir à tout moment où en est sa fille ; sortir un rapport clair au prochain rendez-vous pneumo.
- **Frustrations** : Les apps testées sont soit payantes, soit demandent 20 minutes de configuration, soit ne gèrent qu'un seul utilisateur.
- **Contexte d'usage** : Mobile (iOS) à 90 %, web quand il prépare le rendez-vous médecin. Matin et soir principalement, + occasions de secours.
- **Critère de succès personnel** : *« Je ne me réveille plus la nuit pour vérifier si ma conjointe lui a donné sa pompe. »*
- **Verbatim** : *« Je veux juste savoir en ouvrant mon téléphone si c'est fait ou pas, point. »*

#### Persona 2 — Aidante secondaire (35 ans, co-parente)
- **Contexte** : Infirmière, souvent en horaires décalés. Administre la pompe du soir 3-4 jours sur 7, du matin 2 jours sur 7.
- **Objectifs** : Savoir instantanément ce que le parent référent a déjà fait ; être notifiée si c'est son tour ; ne pas avoir à lire de longs historiques.
- **Frustrations** : Les SMS avec le co-parent se perdent dans le flux ; elle a déjà donné une dose qui avait déjà été donnée.
- **Contexte d'usage** : Mobile (Android) en mobilité, entre deux gardes. Souvent dans des zones à couverture instable (sous-sols d'hôpital).
- **Critère de succès personnel** : *« En 3 secondes je sais où on en est, et je valide ma prise. »*
- **Verbatim** : *« Si je dois me connecter à un truc compliqué, j'abandonne. »*

#### Persona 3 — Éducatrice en garderie (27 ans, CPE à Laval)
- **Contexte** : Administre la pompe de midi à 4 enfants différents dans une CPE. Téléphone pro partagé, wifi médiocre, beaucoup de stress en période de pointe.
- **Objectifs** : Enregistrer la prise en 10 secondes chrono, pouvoir le faire hors-ligne, sans avoir à créer de compte personnel.
- **Frustrations** : Les parents lui demandent de noter sur un cahier papier qu'elle oublie ; elle n'est pas toujours sûre d'avoir bien donné la dose prescrite.
- **Contexte d'usage** : Tablette partagée ou téléphone pro, connexion intermittente, environnement bruyant et sollicité.
- **Critère de succès personnel** : *« Je prends la pompe, je tape sur le bouton, c'est fait. Pas de mot de passe, pas de menu. »*
- **Verbatim** : *« Si ça plante ou si ça demande internet, je remplis le cahier papier comme d'habitude. »*

#### Persona 4 — Pneumo-pédiatre (52 ans, CHU) — utilisatrice indirecte
- **Contexte** : Voit 15 patients asthmatiques/jour, consultations de 20 minutes, anamnèse orale essentiellement.
- **Objectifs** : Obtenir en 30 secondes un historique fiable des prises de secours, des circonstances, et de l'observance du traitement de fond sur les 3 derniers mois.
- **Frustrations** : Les parents arrivent avec des carnets manuscrits illisibles ou des souvenirs flous ; elle doit deviner l'observance à partir du compteur de la pompe.
- **Contexte d'usage** : Ordinateur du bureau de consultation, PDF imprimé apporté par le parent, ou envoyé par e-mail avant la consultation.
- **Critère de succès personnel** : *« J'ouvre le PDF, je vois une courbe claire, j'adapte le traitement. »*
- **Verbatim** : *« Si le document fait 20 pages, je ne le lis pas. Donnez-moi 1 page lisible. »*

### 4.2. Marché & volume

- **Prévalence de l'asthme pédiatrique** : ~8-10 % des enfants dans les pays à revenu élevé (OMS, SCPE).
- **Canada** : ~850 000 enfants asthmatiques (Statistique Canada / ALA).
- **France** : ~1 million d'enfants concernés (Santé Publique France).
- **États-Unis** : ~4,5 millions d'enfants asthmatiques (CDC) — marché indirectement accessible via l'open source, COPPA à anticiper si <13 ans.
- **Mondial** : estimation ~100 millions d'enfants asthmatiques (GBD 2019).
- **Cible réaliste v1.0 (12 mois post-lancement)** : 500-5 000 foyers actifs (bouche-à-oreille + relais communautaires francophones : forums parents, associations d'asthmatiques, pneumo-pédiatres early-adopters).
- **Cible v2.0 (offre B2B cliniques)** : 50-200 cabinets et cliniques au Québec + France, générant le financement long terme de l'hébergement.

## 5. Objectifs & métriques de succès (OKR v1.0)

| # | Objectif | Indicateur mesurable | Cible v1.0 |
|---|---|---|---|
| O1 | Saisie ultra-rapide | Temps médian entre ouverture app et enregistrement d'une prise depuis écran d'accueil | **< 10 secondes** |
| O2 | Zéro dose manquée non détectée | Dans un foyer actif, % de doses planifiées soit confirmées, soit signalées « manquée » | **100 %** |
| O3 | Rapport médecin utilisable | Génération PDF depuis la page Historique | **1 clic, < 5 secondes, 1-2 pages** |
| O4 | Fiabilité notifications | Taux de notifications push délivrées dans les 60 secondes suivant l'heure planifiée (mesure instrumentée) | **> 99 %** |
| O5 | Onboarding fluide | Durée médiane entre installation et première prise enregistrée | **< 2 minutes** |
| O6 | Coordination multi-aidants | % de foyers actifs avec ≥ 2 aidants ayant enregistré au moins une prise | **> 60 %** |

## 6. Parcours utilisateurs clés (User Journeys)

### J1 — Onboarding du parent référent
1. Téléchargement de l'app depuis l'App Store (ou ouverture de l'URL web).
2. Écran d'accueil : bouton unique *« Commencer »*. Aucune création de compte obligatoire pour démarrer — possibilité de mode local invité.
3. Création du compte foyer (e-mail + magic link, pas de mot de passe à retenir).
4. Saisie minimale : prénom de l'enfant, âge, 1 pompe de fond (marque + posologie prescrite), 1 pompe de secours (optionnelle).
5. Création d'un rappel matin (8h) et soir (20h), horaires pré-remplis, modifiables.
6. Écran *« Inviter un aidant »* : envoi d'un lien au co-parent (SMS ou e-mail).
7. Fin : arrivée sur l'écran d'accueil, le bouton *« Enregistrer une prise »* est dominant.
- **Durée cible** : **< 2 minutes**.

### J2 — Saisie rapide d'une prise de fond
1. L'aidant ouvre l'app. Sur l'écran d'accueil : nom de l'enfant, statut de la prise du moment (« Prise du soir prévue à 20h — non faite »), gros bouton bleu *« J'ai donné la pompe de fond »*.
2. Tap unique. Confirmation visuelle (coche verte + vibration légère).
3. Les autres aidants reçoivent une notification *« [Aidant] a donné la pompe de fond à 19h47 »* dans les 5 secondes.
- **Durée cible** : **< 10 secondes**.

### J3 — Saisie d'une prise de secours avec symptômes
1. L'enfant tousse à l'école. L'aidant ouvre l'app, bouton rouge *« Pompe de secours »*.
2. Écran symptômes (grille d'icônes tactiles, multi-sélection) : toux, sifflement, essoufflement, réveil nocturne…
3. Circonstances (pré-sélection rapide) : effort, allergène, infection, nuit, inconnu.
4. Commentaire libre optionnel (1 champ texte, non obligatoire).
5. Validation. Autres aidants (et médecin si abonné au rapport) reçoivent la notif.
- **Durée cible** : **< 30 secondes**.

### J4 — Gestion d'une dose manquée
1. 21h, la prise du soir n'a pas été enregistrée. L'app envoie une notification à tous les aidants actifs : *« Prise du soir non confirmée — donnée ? »*
2. Deux boutons : *« Je l'ai donnée à tel moment »* (rattrapage, saisie différée) ou *« Non, oubliée »* (marquée manquée, explicite dans l'historique).
3. Si aucune réponse 30 min plus tard, rappel redondant (push + local + e-mail au référent).
4. Dans l'historique, les doses manquées sont visuellement distinctes (gris + icône).

### J5 — Invitation et onboarding d'un aidant secondaire (garderie)
1. L'Admin ouvre *« Aidants »*, clique *« Inviter la garderie »*.
2. Choix du rôle : **Contributeur restreint** (peut enregistrer une prise, voir la dernière prise, ne voit pas l'historique complet ni les symptômes détaillés).
3. Génération d'un lien ou QR code + code PIN à 6 chiffres. Remise à l'éducatrice en garderie.
4. Scan du QR, saisie du PIN, arrivée directement sur un écran épuré : prénom de l'enfant + bouton *« Pompe donnée »*. Aucun mot de passe, session persistante sur l'appareil partagé (révocable par l'Admin).
- **Durée cible** : **< 60 secondes** côté aidante restreinte.

### J6 — Export d'un rapport pour rendez-vous médecin
1. Veille du rendez-vous, l'Admin ouvre *« Historique »*.
2. Bouton *« Rapport médecin »*. Sélection période (dernier mois / 3 mois / personnalisé).
3. Aperçu 1-2 pages : graphique observance pompe de fond, tableau prises de secours avec symptômes et circonstances, alertes (doses manquées, crises, remplacements de pompe).
4. Boutons *« Télécharger PDF »*, *« Envoyer par e-mail »*, *« Copier CSV »*.
- **Durée cible** : **1 clic, < 5 secondes pour générer**.

### J7 — Synchronisation après période hors-ligne (garderie sans réseau)
1. Prise enregistrée à 12h15 alors que la garderie est en panne wifi.
2. L'app stocke l'événement localement, affiche un petit badge *« en attente de sync »*.
3. À 17h, wifi rétabli. L'app synchronise automatiquement, horodatage serveur préservé, les autres aidants reçoivent la notif avec la mention *« enregistrée à 12h15 (sync à 17h02) »*.
4. Si conflit (deux aidants ont enregistré entre-temps) : résolution automatique last-write-wins par horodatage local, notification croisée informant les deux aidants qu'il y a eu deux enregistrements à vérifier.

## 7. Périmètre fonctionnel

### 7.1. Périmètre v1.0

**Comptes & foyers**
- Compte foyer unique, authentification par magic link (e-mail) ou OAuth (Apple/Google).
- **1 enfant par compte** en v1.0.
- Rôles aidants : **Admin** (parent référent), **Contributeur** (co-parent, grand-parent), **Contributeur restreint** (garderie, nounou — saisie uniquement, pas d'historique complet).
- Invitation par lien ou QR code + PIN, révocable.
- Mode invité local (avant création de compte, migration possible).

**Saisie des prises**
- Pompe de fond : horodatage automatique, aidant capturé implicitement.
- Pompe de secours : horodatage + symptômes (grille icônes multi-sélection) + circonstances (pré-sélection) + commentaire libre.
- Saisie différée (rattrapage d'une prise oubliée jusqu'à 24h en arrière).
- Support de plusieurs pompes par type (ex : 2 pompes de secours si l'enfant a un doublon école/maison).

**Rappels & notifications**
- Rappels push planifiés (matin/soir minimum, configurables).
- Alerte dose manquée (push + local + e-mail après délai configurable).
- Notifications croisées : quand un aidant enregistre une prise, les autres reçoivent push.
- Alerte fin de pompe (décompte manuel des doses, alerte à seuil configurable, défaut 20 doses restantes).

**Partage multi-aidants & temps réel**
- Synchronisation temps réel des prises (< 5 secondes).
- Vue unique partagée entre tous les aidants du foyer.
- Résolution de conflits automatique (horodatage serveur, last-write-wins).

**Rapports & export**
- Rapport médecin PDF (1-2 pages, mis en forme clinique).
- Export CSV brut (données complètes, pour recherche ou sauvegarde).
- Période paramétrable (semaine / mois / 3 mois / personnalisée).

**Hors-ligne & synchronisation**
- Saisie hors-ligne complète (prise, symptômes, circonstances).
- Lecture hors-ligne de l'historique des 30 derniers jours au minimum.
- Synchronisation automatique à la reconnexion, file d'attente locale chiffrée.

**Plateformes**
- **Web responsive** (PWA installable).
- **iOS** natif-like (React Native).
- **Android** idem.
- Parité fonctionnelle totale entre les 3 plateformes en v1.0.

**Confidentialité & sécurité**
- Chiffrement au repos et en transit (E2EE zero-knowledge, cf. `ARCHITECTURE.md`).
- Hébergement Canada (ca-central-1 par défaut).
- CGU + politique de confidentialité dédiées mineurs.
- Export des données + suppression de compte en self-service.
- Disclaimer omniprésent : *« Ne remplace pas un avis médical. »*

### 7.2. Périmètre v1.1
- **Multi-enfants** (fratrie) : plusieurs enfants dans un même foyer, sélection rapide sur écran d'accueil.
- Petites améliorations basées sur retours utilisateurs (priorisation post-lancement).
- Éventuels correctifs d'UX remontés via support.

### 7.3. Périmètre v2.0 (6-12 mois)
- Intégration **Apple HealthKit** + **Google Health Connect** (import / export des doses inhalées).
- **Portail pro** pour pneumo-pédiatres (vue multi-patients, tableau de bord observance).
- **Offre B2B cliniques** (instance dédiée, logo clinique, support prioritaire) — source de financement long terme de l'hébergement communautaire.
- Multi-langues étendu (EN, ES).
- Validation clinique par pneumo-pédiatre partenaire (crédibilité marketing).

### 7.4. Hors-périmètre explicite (protection du non-statut dispositif médical)

L'application **ne fera jamais** :
- Recommandation ou calcul de dose.
- Diagnostic ou suggestion de diagnostic.
- Alerte santé auto-générée (« consultez votre médecin », « crise en cours »).
- Messagerie bidirectionnelle avec un professionnel de santé.
- Téléconsultation ou prise de rendez-vous médicale.
- Intégration avec une pompe connectée (capteurs IoT) pour mesure automatique.
- Analyse prédictive ou IA de risque de crise.
- Stockage ou traitement de données médicales tierces (bilans, ordonnances).

Ces limites sont **structurelles** : elles protègent le statut non-DM et donc la mise sur le marché rapide.

## 8. Principes de design produit

1. **Onboarding ultra-rapide** — Une seule étape, un seul écran par action, code couleur clair.
2. **1 action principale par écran** — Bouton dominant, zéro ambiguïté. Les actions secondaires sont accessibles mais non proéminentes.
3. **Code couleur cohérent**
   - Bleu / vert = pompe de fond, action de routine.
   - Rouge / orange = pompe de secours, action critique.
   - Jaune / ambre = alertes (dose manquée, fin de pompe).
   - Gris = doses manquées confirmées, historique passif.
4. **Accessibilité WCAG 2.1 AA minimum** — Contrastes, tailles tactiles ≥ 44 px, support VoiceOver/TalkBack, usage possible en condition de stress (nuit, enfant qui pleure).
5. **Zéro configuration obligatoire** — L'app doit être utile en < 2 minutes. Tout ce qui est configurable est pré-rempli avec des valeurs par défaut saines.
6. **Pas de gamification** — Pas de badges, pas de streaks, pas de score. Le sujet est la santé d'un enfant, pas un jeu.
7. **Micro-copie rassurante** — Ton sobre, jamais anxiogène. Exemple : « Prise non confirmée » plutôt que « Vous avez oublié ! ».

## 9. Contraintes structurantes (rappel)

- **Statut** : **non dispositif médical** (journal + rappel + partage). Ligne rouge absolue en v1 et v2.
- **Données de santé d'un mineur** → cadre de conformité strict : **Loi 25 (Québec)**, **PIPEDA (Canada fédéral)**, **RGPD** (compatibilité pour ouverture France/UE), **considérations COPPA** si utilisation US avec enfants <13 ans. Voir `COMPLIANCE.md`.
- **Multi-juridictions** dès le lancement (distribution mondiale via open source + stores) → architecture de conformité générique.
- **Hébergement Canada** par défaut (ca-central-1) ; préparation multi-région en v2.
- **Open source** : licence **AGPL v3** + instance officielle gratuite hébergée par Kamez.
- **Fiabilité critique** : une notification manquée = perte de confiance immédiate → redondance (push + local + e-mail) et monitoring en production.
- **Délai v1.0** : ~3 mois calendaires (v1.1 fratrie ~2 mois après).

## 10. Risques produit & hypothèses

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| RP1 | **Adoption multi-aidants réelle faible** : seul le parent référent utilise l'app, les autres ignorent les invitations | Moyenne | Haut (détruit l'UVP) | Onboarding aidant < 60s, QR code + PIN sans compte complet, relances contextuelles ; mesurer O6 dès les premières semaines |
| RP2 | **Fatigue de notifications** : trop d'alertes, l'utilisateur les désactive ou désinstalle | Haute | Haut (fiabilité perçue effondrée) | Fréquence stricte (max 1 rappel + 1 retard par prise), tonalité sobre, réglages par aidant, opt-out granulaire |
| RP3 | **Fausse alerte fin de pompe** (décompte manuel divergent de la réalité) | Moyenne | Moyen (perte de confiance) | Décompte manuel remis à zéro à chaque remplacement, alerte conservatrice (seuil 20 doses, non 5), message clair « estimation » |
| RP4 | **Fracture numérique des grands-parents / garderie** : profil non-numérique, abandon | Moyenne | Moyen (perte d'un segment clé) | Profil restreint ultra-simple (1 bouton), QR code papier, mode kiosque tablette partagée, guide imprimable |
| RP5 | **Revue stores santé enfants** (App Store, Play Store) : rejet pour mention santé/mineur mal cadrée | Moyenne | Haut (délai mise en ligne) | Kit conformité stores préparé en amont, disclaimer explicite, politique de confidentialité exemplaire, classification non-médicale claire |
| RP6 | **Dérive scope vers dispositif médical** : pression utilisateur pour ajouter une alerte « crise en cours » ou une recommandation | Moyenne | Bloquant (+12 mois certification) | Périmètre gravé dans le PRD, revue conformité à chaque évolution, backlog guard-rails |
| RP7 | **Synchro hors-ligne buggée** : conflits, pertes de données | Moyenne | Haut (perte de confiance immédiate) | Tests E2E dédiés, file d'attente locale chiffrée, horodatage serveur, journal de conflits visible par le foyer |
| RP8 | **Financement long terme de l'instance hébergée** non viable si traction forte | Faible en v1, Haute à 2 ans | Haut | Offre B2B cliniques v2, self-hosting documenté dès v1 comme fallback, monitoring coûts cloud |

**Hypothèses clés (à valider en exécution)**
- H1 : L'open source + instance gratuite est un accélérateur d'adoption (vs barrière de notoriété).
- H2 : Les garderies accepteront d'utiliser l'app si profil restreint + pas de compte à créer.
- H3 : Un rapport PDF 1-2 pages suffit aux pneumo-pédiatres v1 (pas besoin de portail pro immédiat).
- H4 : Le bouche-à-oreille parental (forums, associations) suffira à atteindre 500-5 000 foyers en 12 mois sans budget marketing.

## 11. Critères de sortie v1.0 (Definition of Done produit)

La v1.0 est considérée livrable si **toutes** les conditions ci-dessous sont vérifiées :

1. **Parcours critiques testés sur vraie pompe avec une vraie famille** pendant ≥ 2 semaines : J1, J2, J3, J4, J5, J6, J7 tous passants.
2. **Rapport médecin validé** par au moins **1 pneumo-pédiatre** (critiques formelles et itération intégrée, même sans validation clinique formelle).
3. **Fiabilité des notifications démontrée** : O4 (> 99 % de délivrabilité sous 60s) mesurée sur banc de test instrumenté.
4. **Conformité publiée** : politique de confidentialité + CGU + mentions légales dédiées mineurs, en français et anglais.
5. **Parité web + iOS + Android** : aucun parcours critique n'est bloqué sur une plateforme.
6. **Accessibilité WCAG 2.1 AA** : audit automatique (axe-core ou équivalent) + navigation au lecteur d'écran validée sur J2, J3, J5.
7. **Code open source publié** sur GitHub avec licence AGPL v3, README, guide de contribution.
8. **Guide de self-hosting publié** : Docker Compose ou équivalent, documentation pas-à-pas pour une famille technique ou une clinique.
9. **Instance officielle en production** au Canada avec monitoring (uptime, push delivery, erreurs).
10. **Tests E2E automatisés** couvrant les 7 parcours critiques.
11. **Onboarding < 2 minutes** mesuré sur ≥ 5 utilisateurs externes (hors équipe).
12. **Disclaimer non-dispositif-médical** visible à l'onboarding, dans les CGU, dans le pied de page du rapport PDF.

## 12. Métriques de suivi post-lancement

**Utilisation**
- Foyers actifs hebdomadaires / mensuels (DAU/WAU/MAU foyer).
- Nombre moyen de prises enregistrées / jour / foyer.
- Ratio prises de fond confirmées / prises de fond planifiées (proxy observance).
- Nombre moyen d'aidants actifs par foyer.

**Fiabilité**
- Taux de délivrabilité push (sous 60 s).
- Taux de doses manquées non signalées (doit tendre vers 0).
- Taux d'erreurs de synchro hors-ligne (cible < 0,1 %).
- Uptime de l'instance officielle (cible > 99,5 %).

**Expérience**
- Temps médian d'onboarding (J1 complet).
- Temps médian de saisie d'une prise (J2, J3).
- NPS aidants mesuré à J30.
- Taux de rétention J7 / J30 / J90 (foyer actif).

**Écosystème**
- Étoiles GitHub, contributions externes.
- Nombre d'instances self-hostées déclarées (opt-in telemetry).
- Demandes entrantes cliniques / pneumo-pédiatres (signal B2B v2).

**Santé**
- Nombre moyen de prises de secours / mois / enfant (indicateur de contrôle, remonté au médecin).
- Taux de foyers avec ≥ 1 rapport médecin généré / mois (preuve d'usage médical).

---

*Fin du PRD Kinhale v1.0 — document publié sous AGPL v3.*
