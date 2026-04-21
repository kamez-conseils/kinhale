# ADR-D1 — React Native Workflow : Bare + EAS Build vs Managed Workflow Expo

**Date** : 2026-04-20
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

Kinhale est une application mobile iOS + Android + Web qui repose sur deux modules natifs absolument non-négociables : `react-native-libsodium` pour les opérations cryptographiques (Ed25519, X25519, XChaCha20-Poly1305, Argon2id) et `op-sqlite` avec SQLCipher pour le stockage local chiffré. Ces deux librairies compilent du code natif C/Rust et requièrent l'accès direct aux systèmes de build Xcode et Gradle.

Expo propose deux modes de fonctionnement : le **Managed Workflow** (qui abstrait entièrement le build natif et limite l'app aux modules de l'écosystème Expo officiel) et le **Bare Workflow** (qui expose les dossiers `ios/` et `android/` et laisse le développeur gérer le build natif). Pour un solo dev, ce choix a des conséquences importantes sur la complexité quotidienne, la durée des cycles de build, la surface de maintenance, et la capacité à intégrer des dépendances critiques.

Si cette décision n'est pas tranchée dès le Sprint 0, le risque est de commencer à construire en Managed Workflow — qui est la voie de moindre résistance pour le démarrage rapide — puis de devoir migrer en Bare au Sprint 2 ou 3 quand l'intégration crypto devient urgente. Cette migration a posteriori est coûteuse (2-5 jours-homme) et génère des régressions.

## Options évaluées

### Option A — Managed Workflow Expo (SDK 52)

**Description** : Expo gère intégralement les builds natifs. Le développeur ne touche jamais à Xcode ni à Gradle directement. Les mises à jour Expo SDK couvrent 90 % des besoins courants. Les modules natifs non supportés passent par des "Config Plugins" qui injectent du code natif au moment du build cloud.

**Avantages** :
- Démarrage extrêmement rapide (< 30 min de scaffolding opérationnel).
- Pas de maintenance des dossiers `ios/` et `android/`.
- Mises à jour SDK simplifiées (la majorité des breaking changes sont absorbés par Expo).
- Accès facile à EAS Build sans configuration particulière.
- Idéal pour un MVP sans besoins natifs exotiques.

**Inconvénients** :
- `react-native-libsodium` **n'est pas supporté en Managed Workflow** — il n'existe pas de Config Plugin officiel et maintenu pour cette librairie.
- `op-sqlite` avec SQLCipher n'est pas dans l'écosystème Expo officiel et son intégration en Config Plugin est non documentée et non testée à grande échelle.
- Toute dépendance native hors Expo SDK impose l'éjection, ce qui annule tous les avantages de ce workflow.
- Le "prebuild" Expo qui génère les dossiers natifs à la volée crée des dossiers non versionnés et difficiles à déboguer en cas de problème de compilation natif.

**Risques** :
- Blocage total sur l'intégration crypto au Sprint 1. L'architecture entière de Kinhale repose sur la crypto native — sans elle, on ne peut pas construire le produit.
- Fausse sécurité : le démarrage facile masque une contrainte rédhibitoire qui se révèle trop tard.

### Option B — Bare Workflow Expo + EAS Build

**Description** : Les dossiers `ios/` et `android/` sont versionnés et configurés manuellement. Expo SDK reste utilisé pour ses composants de haut niveau (notifications, secure store, localization, etc.) mais le core natif est géré directement. EAS Build est utilisé pour les builds CI/CD cloud (évite d'avoir Xcode/Android Studio en local pour les builds de release).

**Avantages** :
- Accès total aux modules natifs — `react-native-libsodium`, `op-sqlite`/SQLCipher, et tout futur module natif sont intégrables sans friction.
- EAS Build gère les builds iOS (signature certificats, provisioning) et Android (keystore) en cloud, ce qui compense l'absence de Mac en environnement CI.
- La commande `expo prebuild` peut être utilisée ponctuellement pour régénérer les dossiers natifs après une mise à jour SDK, mais les dossiers sont versionnés pour un contrôle total.
- Compatibilité totale avec les librairies React Native standard non-Expo.
- Compatible avec les politiques Tamagui, react-navigation, et tout l'écosystème React Native.

**Inconvénients** :
- La première configuration (podfile, gradle, signing) prend 1-2 jours pour un solo dev.
- Les mises à jour SDK majeures peuvent nécessiter des ajustements manuels dans les dossiers natifs (typiquement 2-4h par mise à jour majeure).
- Les erreurs de build natif (erreurs Xcode, erreurs Gradle) sont plus difficiles à diagnostiquer que les erreurs JS — elles nécessitent une compréhension de base des systèmes de build iOS/Android.
- Sans Mac local, le debug iOS en développement passe par Expo Go ou le simulateur via EAS, ce qui ralentit légèrement les cycles de feedback.

**Risques** :
- Risque d'incompatibilité entre une future version d'Expo SDK et un module natif tiers — gérable mais nécessite une veille active.
- Risque de dérive de la configuration native si plusieurs développeurs contribuent sans discipline — acceptable pour un solo dev.

### Option C — React Native pur (sans Expo)

**Description** : Utiliser React Native CLI directement, sans aucune couche Expo.

**Avantages** : Contrôle total absolu, pas de dépendance Expo.

**Inconvénients** : On perd les avantages d'EAS Build (builds cloud signés), d'expo-notifications (notifications push multi-plateforme), d'expo-secure-store, d'expo-localization, etc. Ces modules sont matures et couvrent des besoins réels de Kinhale. Les recoder ou les remplacer coûte 5-10 jours-homme supplémentaires sans gain visible.

**Risques** : Coût de développement inutilement élevé.

## Critères de décision

1. **Intégration non-négociable de `react-native-libsodium` et `op-sqlite`/SQLCipher** — c'est la contrainte technique bloquante.
2. **Capacité à builder iOS sans Mac en CI** — EAS Build est la solution.
3. **Coût de configuration initial acceptable pour un solo dev** — quelques jours sont acceptables.
4. **Disponibilité des modules Expo utiles** (notifications, secure store, localization) — à conserver.
5. **Maintenabilité long terme** — les dossiers natifs doivent être stables et versionnables.

## Décision

**Choix retenu : Option B — Bare Workflow Expo SDK 52 + EAS Build**

La contrainte technique est sans appel : `react-native-libsodium` et `op-sqlite` ne fonctionnent pas en Managed Workflow. Ce n'est pas une préférence architecturale, c'est une impossibilité technique documentée. L'ensemble de la promesse produit de Kinhale — le E2EE zero-knowledge — repose sur ces deux librairies. Choisir Managed Workflow reviendrait à construire une maison sur des fondations que l'on sait incompatibles avec la structure portante.

Le Bare Workflow conserve la totalité des avantages d'Expo qui nous intéressent : EAS Build pour les builds cloud signés iOS/Android, les packages Expo matures (`expo-notifications`, `expo-secure-store`, `expo-localization`, `expo-updates` pour les OTA). La seule chose que l'on perd, c'est l'abstraction des dossiers natifs — mais cette abstraction est précisément ce qui nous bloque.

Ce qui a fait pencher la balance : un solo dev en Bare Workflow avec EAS Build est un profil très commun dans l'écosystème React Native en 2026. La documentation est abondante, les forums sont actifs, et les 1-2 jours de configuration initiale sont un investissement unique qui évite une migration coûteuse ultérieure.

Ce choix serait invalidé si : EAS Build devenait payant à un niveau prohibitif pour un projet open source (un plan gratuit ou ~$15/mois suffit pour la v1.0), ou si une solution Managed Workflow avec Config Plugin pour libsodium devenait mature et auditée (peu probable à court terme).

## Conséquences

**Positives :**
- Intégration crypto native dès le Sprint 0, sans contournement.
- Builds iOS/Android reproductibles en CI via EAS Build, sans Mac local obligatoire.
- Accès à tout l'écosystème React Native, sans restriction Expo Managed.
- Les modules Expo utiles (`expo-notifications`, `expo-secure-store`) restent disponibles.
- Meilleure transparence sur la configuration native — plus facile à auditer pour la revue de sécurité.

**Négatives / compromis acceptés :**
- 1-2 jours de configuration initiale (`ios/Podfile`, `android/build.gradle`, certificats EAS).
- Chaque mise à jour majeure Expo SDK nécessite un ajustement manuel des dossiers natifs (2-4h estimées par mise à jour).
- Le débogage des erreurs de build natif requiert une connaissance minimale de Xcode/Gradle — acceptable pour un dev senior.
- Sans Mac local, le test iOS en développement se fait via Expo Go (pour les parties non-crypto) ou via TestFlight/simulateur EAS (pour les builds natifs complets).

**Plan de fallback** : Si EAS Build crée des blocages inattendus (pricing, indisponibilité, limitations sur les modules natifs), le fallback est de configurer un runner macOS GitHub Actions (disponible en tarif horaire) pour les builds iOS. Coût estimé : ~$0.08/min, acceptable pour les releases (~$5-10 par release candidate).

## Révision prévue

À revisiter si : (1) Expo SDK 53+ intègre un support officiel de SQLCipher via Config Plugin maintenu, ou (2) le projet passe à une équipe de 3+ développeurs et la gestion des conflits sur les dossiers natifs devient problématique. Dans ce dernier cas, évaluer le passage à une architecture de "modules natifs partagés" avec Turbo Modules.
