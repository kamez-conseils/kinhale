# ADR-D10 — Push v1.0 : Expo Push Service, migration APNs + FCM natifs reportée v1.1

**Date** : 2026-04-24
**Statut** : Accepté (temporaire, jusqu'à résolution de l'issue GitHub #224)
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

L'architecture cible de Kinhale (CLAUDE.md §Stack, `00-kz-architecture.md`) prévoit l'usage **natif** des services push des plateformes :

- **APNs** (Apple Push Notification service) pour iOS.
- **FCM** (Firebase Cloud Messaging) pour Android et Web (via Web Push / WebPush VAPID le cas échéant).

Ces deux canaux — conformes à la §9 des specs — imposent côté relais (Fastify) l'intégration d'un SDK APNs (`@parse/node-apn`, `apns2`, ou équivalent) et d'un SDK FCM (Firebase Admin SDK), ainsi que l'approvisionnement des identités d'expéditeur côté Apple Developer et Firebase console. Le payload reste strictement minimal (RM16 : `{title: "Kinhale", body: "Nouvelle activité", household_id, notification_id}`).

En avril 2026, au moment d'implémenter l'Épique E5 (rappels, notifications peer, dose manquée), le code du relais utilise **Expo Push Service** via le SDK `expo-server-sdk` (cf. `apps/api/src/push/push-dispatch.ts`, `apps/api/src/routes/push.ts` — tokens `ExponentPushToken[…]`). Ce choix a été fait de facto à l'implémentation des premières notifications E5 (KIN-072, KIN-079) pour raccourcir le time-to-first-push, car Expo Push abstrait la double pile APNs/FCM derrière une seule API et un seul token.

Basculer vers les SDK natifs nécessite en pratique :

1. **Provisioning Apple Developer** : génération d'une APNs Auth Key (.p8), création du Key ID + Team ID, configuration côté EAS Build pour associer le bundle iOS à cette clé.
2. **Provisioning Firebase** : création d'un projet Firebase (ou extension du projet existant), génération d'un service account JSON avec scope messaging, upload dans Secrets Manager.
3. **Web Push (VAPID)** : génération d'une paire de clés VAPID, publication côté client + intégration service worker.
4. **Intégration SDK backend** : ajout des SDK `apns2` + `firebase-admin` dans `apps/api`, extension de `dispatchPush` pour router selon le `platform` du token, gestion des erreurs de token invalide (unregister/410).
5. **Purge automatique des tokens** : CA E5-S10/S11 impose la détection et la purge des tokens APNs/FCM invalides (feedback inversé). Pas d'équivalent côté Expo car géré transparent.
6. **Rotation des secrets** : mise en place dans AWS Secrets Manager + rotation documentée.

Ce chantier représente **2-3 jours-homme opérations** — non bloquants pour l'Épique 5 fonctionnellement. Expo Push Service livre aujourd'hui les mêmes notifications sur iOS et Android en restant **strictement compatible** avec les garanties de confidentialité (payload opaque RM16 identique, aucune donnée santé transmise au service Expo).

Reste un point de vigilance : Expo Push Service est un **relais tiers additionnel** dans la chaîne de métadonnées push. Apple et Google voient déjà les métadonnées OS (device token, réception d'un push pour l'app), mais Expo les voit également — point documenté dans les conséquences ci-dessous.

Une issue GitHub **#224** a été ouverte pour tracker formellement la migration APNs + FCM natifs avant la v1.1. Le présent ADR formalise la décision, ses limites et son plan de remplacement.

## Options évaluées

### Option A — APNs + FCM natifs dès v1.0

**Description** : Implémenter la double pile APNs + FCM dans le relais dès l'Épique 5, conformément à l'architecture cible. Provisioning Apple Developer + Firebase + Web Push VAPID + intégration SDK backend + gestion complète du cycle de vie des tokens (enregistrement, rotation, purge sur 410).

**Avantages** :
- **Architecture cible respectée dès v1.0** : pas de dette technique à rembourser. Le code de production est directement celui qui ira en v1.0 GA.
- **Pas de relais tiers** : Apple et Google voient les métadonnées push (inévitable), mais aucun autre acteur. Un maillon de moins dans la chaîne.
- **Contrôle complet des SLAs** : quotas APNs/FCM directement négociés, pas de dépendance à un quota Expo Push intermédiaire.
- **Purge automatique des tokens invalides** : mécanisme standard de retour 410 côté APNs / `UNREGISTERED` côté FCM — pas de mécanisme custom à construire.

**Inconvénients** :
- **2-3 jours-homme ops non bloquants** : setup Apple Developer (génération clé .p8, upload EAS), création projet Firebase, génération VAPID, configuration Secrets Manager, rotation documentée. Rien de techniquement difficile, mais rien qui avance fonctionnellement l'Épique 5.
- **Coût de contexte** : chaque service (APNs, FCM, Web Push) a ses propres erreurs, ses propres taux d'échec, ses propres formats de token — multiplie la surface à tester et à monitorer.
- **Retarde l'Épique 5** : le provisioning Apple Developer prend entre 24 h et 72 h (revue interne Apple), ce qui déplace le premier push de bout-en-bout de plusieurs jours et bloque les tests utilisateurs multi-device.

**Risques** :
- Erreur de configuration silencieuse (mauvais bundle ID, clé expirée, VAPID mal publiée) détectée tardivement, lorsque les tests utilisateurs sont déjà en cours.
- Divergence entre le comportement local (Expo SDK de dev client) et production (APNs natif) ajoutant un risque de régression à chaque release.

### Option B — Conserver Expo Push Service pour v1.0, migrer en v1.1 (retenue)

**Description** : Maintenir le code actuel basé sur `expo-server-sdk`. Le relais émet ses pushs via Expo Push Service qui les relaie ensuite à APNs (iOS) et FCM (Android). Payload identique au layout RM16. Tracker la migration via l'issue GitHub **#224** pour exécution entre la v1.0 GA et la v1.1.

**Avantages** :
- **Débloque immédiatement l'Épique 5** : l'infrastructure push est fonctionnelle, E5-S01 à E5-S13 peuvent avancer sans attendre.
- **Zero-knowledge préservé** : le payload Expo est strictement RM16. Aucune donnée santé ne transite par Expo Push Service — seulement un identifiant opaque de foyer et un identifiant opaque de notification.
- **Moins de complexité ops v1.0** : un seul service, une seule API, un seul format de token, un seul quota à surveiller.
- **Abstraction cross-platform uniforme** : iOS, Android, et (via le dev client) Web reçoivent le même format de push sans code de routage spécifique côté relais.

**Inconvénients** :
- **Dépendance runtime à un tiers** : si Expo Push Service subit une panne, aucun push n'est délivré même si APNs et FCM sont opérationnels. Impact directement mesurable sur la fiabilité E5 (CA7).
- **Relais tiers supplémentaire pour les métadonnées** : Apple et Google voient déjà les métadonnées OS (inévitable), mais Expo les voit également. Cette exposition est limitée au token opaque et au payload `{title: "Kinhale", body: "Nouvelle activité"}` — aucune donnée santé — mais elle ajoute un acteur à documenter dans la cartographie des sous-traitants.
- **Quotas** : Expo Push Service applique des quotas (1800 messages par 24h par défaut pour les apps sans plan payant, plus permissif avec un plan Production). Adéquat pour v1.0 (< 5000 foyers) mais à surveiller.
- **Dette technique à rembourser** : la migration vers APNs + FCM natifs reste à faire, et chaque mois écoulé avec Expo Push augmente le nombre de tokens à migrer (nouvelle génération de token côté client lors du passage à la v1.1).

**Risques** :
- **Risque de confort** : si la migration v1.1 est repoussée de nouveau, la dépendance à Expo Push s'installe. L'issue #224 doit être formellement liée au plan v1.1 pour éviter ce glissement.
- **Risque contractuel** : un client B2B (clinique) pourrait exiger contractuellement qu'aucun service tiers ne voie les tokens push. Ce cas force une migration anticipée — mitigé par le fait que le contenu reste opaque.

### Option C — Self-hosted push gateway

**Description** : Héberger un service push maison (équivalent open-source de Expo Push Service, par exemple `zeropush` historique ou une réécriture). Le relais émet vers cette gateway qui route vers APNs/FCM.

**Avantages** :
- Aucune dépendance tierce runtime.
- Contrôle complet sur les métadonnées et les logs.

**Inconvénients** :
- **Sur-ingénierie pour v1.0** : construire, déployer et monitorer une gateway push spécifique n'apporte rien que l'intégration APNs + FCM native n'apporte déjà, pour un coût plus élevé.
- **Multiplication des composants infra** : une gateway à haute disponibilité ajoute un étage de latence, de monitoring, de rotation de clés, et de tests E2E.
- **Aucun bénéfice sur la surface d'attaque** : les clés APNs/FCM vivent de toute façon dans le relais ou dans une gateway colocalisée — aucune réduction d'exposition.

**Risques** :
- Mauvais rapport valeur / complexité. Option écartée rapidement.

## Critères de décision

1. **Débloquer l'Épique 5 dès aujourd'hui** : fiabilité notifications = pilier de confiance non négociable (CLAUDE.md §Principes).
2. **Zero-knowledge strictement préservé** : payload RM16, aucune donnée santé hors-device.
3. **Coût ops v1.0 minimal** : ressources concentrées sur la cohérence crypto, la fiabilité sync et le couvrage des parcours J1-J7.
4. **Dette technique traçable et plannifiée** : une issue GitHub formelle et un ADR lié.
5. **Aucune divergence entre architecture cible et architecture réelle de la v1.0 sans trace écrite.**

## Décision

**Choix retenu : Option B — Expo Push Service pour v1.0, APNs + FCM natifs reportés en v1.1 via issue #224.**

Ce choix est **temporaire** et **explicitement documenté** :

- Le code relais continue d'utiliser `expo-server-sdk`. Pas de rétro-migration prématurée.
- Les tokens stockés dans `push_tokens` respectent le format `ExponentPushToken[…]` (régex `EXPO_TOKEN_RE`).
- L'issue GitHub **#224** porte la migration. Elle doit être priorisée dans le sprint de stabilisation v1.1 (post-v1.0 GA).
- Les stories **E5-S10 (APNs)** et **E5-S11 (FCM)** sont considérées comme **partiellement livrées** en v1.0 (fonctionnalité utilisateur équivalente via Expo) mais **re-ouvertes** en v1.1 pour atteindre leur conformité d'architecture.
- Toute régression sur le caractère opaque du payload (RM16) est un incident P0 qui s'applique indépendamment du fournisseur de relais push (Expo ou natif).

**Ce qui invaliderait ce choix** :
- Un contrat B2B explicite interdisant tout tiers de traitement des métadonnées push (ce contrat accélérerait l'exécution de #224).
- Une dégradation de SLA Expo Push (> 1% de push non délivrés) — même scénario, accélération de #224.
- Un changement de politique tarifaire Expo rendant le service économiquement non viable à l'échelle v1.0 — même réaction.

## Conséquences

**Positives** :

- **L'Épique 5 peut avancer** dès aujourd'hui sans attendre le provisioning Apple Developer + Firebase. Les stories E5-S01 à E5-S09 + E5-S12 + E5-S13 sont implémentables sans dépendance externe.
- **Zero-knowledge strictement maintenu** : payload Expo = layout RM16. Aucune donnée santé ne quitte les devices. La promesse de confidentialité envers les utilisateurs reste intacte.
- **Moins de complexité ops v1.0** : un seul SDK côté relais, un seul format de token côté client, un seul quota à monitorer.
- **Code réutilisable à 90 % pour la migration** : la fonction `dispatchPush` expose une API `(tokens[]) → void` qui reste stable. Seul le corps change lors de la migration v1.1.

**Négatives / compromis acceptés** :

- **Dépendance runtime à Expo Push Service** : une panne Expo = pas de push délivré. Atténuation : le chemin notification inclut déjà (a) notification locale programmée côté OS pour les rappels connus, (b) e-mail fallback pour `missed_dose` après 30 min. Le push n'est jamais l'unique canal pour une notification sanitaire critique (RM25 + §9 canaux).
- **Relais tiers supplémentaire dans la chaîne de métadonnées** : Expo voit le token opaque et le payload `{title: "Kinhale", body: "Nouvelle activité"}`. À documenter dans la cartographie des sous-traitants et dans le registre Loi 25. Aucune donnée santé exposée, aucun consentement additionnel requis (le token push ne révèle ni contenu santé ni association utilisateur↔foyer côté Expo).
- **Dette technique** : migration APNs + FCM natifs à exécuter en v1.1 (#224). À chaque mois écoulé, le nombre de tokens Expo à invalider au moment de la migration augmente, imposant une fenêtre de migration proprement séquencée (les clients passent au nouveau canal avant que l'ancien ne soit éteint).

**Impact sécurité** :

- **Aucun changement du modèle de menace v1.0** : la garantie zero-knowledge est définie par ce qui est dans le payload (RM16) et par le chiffrement E2EE du contenu (Automerge + mailbox). Ni l'un ni l'autre ne passe par le canal push — qu'il soit Expo ou APNs natif.
- **Cartographie sous-traitants à mettre à jour** : ajouter Expo (Exponent Inc.) comme processeur limité aux métadonnées push opaques. DPA Expo à référencer dans le registre.
- **Audit crypto indépendant** : la migration v1.1 ne modifie pas la crypto — seul le canal de transport change. L'auditeur Sprint 5-6 n'est pas bloqué par ce choix.

**Impact conformité (Loi 25 / RGPD)** :

- **Registre Loi 25** : ajouter Expo comme sous-traitant, finalité « routage de notifications push opaques », catégorie de données « métadonnées techniques (device token, horodatage, statut de livraison) », durée de conservation « durée de vie du token device ».
- **DPA Expo** : à signer ou référencer pour v1.0. Même approche que le DPA Resend (ADR-D8).
- **Politique de confidentialité** : mention explicite d'Expo comme relais de métadonnées push v1.0, avec note que la migration APNs + FCM natifs est programmée v1.1.

**Plan de fallback** :

- En cas de panne Expo Push Service prolongée (> 2 h), l'absence de push ne bloque pas les fonctionnalités critiques grâce aux notifications locales programmées (reminders) et au fallback e-mail (missed_dose).
- Un `EMAIL_PROVIDER`-style switch n'est pas mis en place pour le push v1.0 — le déclenchement d'un fallback APNs/FCM natif suppose d'avoir déjà accompli la migration #224.

## Révision prévue

- **v1.0 GA (juin 2026)** : confirmer que #224 reste le ticket de référence, priorisé dans le sprint v1.1.
- **v1.1 (estimation Q3 2026)** : exécuter #224 — provisioning Apple Developer + Firebase, migration du code `push-dispatch.ts` vers `apns2` + `firebase-admin`, migration séquencée des tokens clients.
- **Signaux d'accélération** : contrat B2B exigeant pas de tiers ; SLA Expo dégradé ; changement tarifaire Expo incompatible avec le budget v1.x.

## Liens

- CLAUDE.md §Stack (push / email)
- `00-kz-specs.md` §9 (canaux de notification, RM16, RM25)
- Stories **E5-S10** (intégration APNs), **E5-S11** (intégration FCM)
- Issue GitHub **#224** — migration push natif v1.1
- Code v1.0 : `apps/api/src/push/push-dispatch.ts`, `apps/api/src/routes/push.ts`
- ADR-D4 (relais hosting — contexte ops AWS)
- ADR-D8 (email transactionnel — même pattern sous-traitant opaque)
