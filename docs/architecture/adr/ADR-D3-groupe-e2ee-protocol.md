# ADR-D3 — Protocole de groupe E2EE : MLS (RFC 9420) vs Signal Protocol / Double Ratchet

**Date** : 2026-04-20
**Statut** : Accepté (sous réserve de validation du PoC Sprint 0)
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

C'est la décision architecturale la plus critique du projet. L'ensemble de la promesse produit de Kinhale — "vos données de santé ne quittent jamais vos appareils, même nous les créateurs ne pouvons pas les lire" — repose sur la robustesse du protocole de chiffrement de groupe. Un choix erroné ici ne se corrige pas sans une migration complète, une rotation de toutes les clés en production, et une communication de crise aux utilisateurs.

Le problème à résoudre est le suivant : un foyer Kinhale est un groupe dynamique de 2 à ~10 devices (un ou plusieurs devices par aidant). Ces devices partagent un document Automerge chiffré. Pour que chaque device puisse chiffrer ses deltas Automerge de façon à ce que tous les autres devices du foyer puissent les déchiffrer, et pour que l'ajout ou la révocation d'un aidant soit proprement reflété dans les clés, il faut un protocole de gestion de clés de groupe.

Deux propriétés de sécurité sont fondamentales :
- **Forward Secrecy (FS)** : si la clé actuelle est compromise, les messages passés restent protégés. Les clés passées ne peuvent pas être dérivées depuis la clé actuelle.
- **Post-Compromise Security (PCS)** : si la clé actuelle est compromise, la sécurité est rétablie après une rotation de clés (les messages futurs sont protégés même si l'attaquant a vu la clé actuelle).

La révocation d'un aidant (ex : une garderie quitte le foyer) est le cas critique : après révocation, l'aidant révoqué ne doit plus pouvoir déchiffrer les nouveaux deltas. Cela implique une rotation de clé de groupe.

Pour un solo dev sans auditeur crypto externe disponible avant Sprint 5-6, le risque d'une implémentation incorrecte d'un protocole complexe est réel et élevé.

## Options évaluées

### Option A — MLS (Messaging Layer Security, RFC 9420) via `openmls`

**Description** : MLS est le standard IETF pour le chiffrement de groupe, publié en 2023 (RFC 9420). Il est conçu pour les groupes dynamiques avec des membres qui s'ajoutent et se retirent fréquemment. `openmls` est l'implémentation de référence en Rust, avec des bindings disponibles via WebAssembly. `mls-ts` est une implémentation TypeScript native en cours de développement.

**Avantages** :
- **Standard IETF auditée** : la spécification est rigoureusement formalisée. Un auditeur crypto externe peut valider l'implémentation par rapport à la RFC, sans avoir à auditer le design lui-même.
- **Forward Secrecy et Post-Compromise Security natifs** : MLS est construit sur un arbre de ratchet (TreeKEM) qui garantit les deux propriétés avec une complexité logarithmique en fonction du nombre de membres.
- **Révocation native** : un `Remove Proposal + Commit` crée un nouvel epoch avec un nouveau `group_secret`. Le membre révoqué ne peut pas dériver le secret du nouvel epoch. C'est exactement le comportement requis pour la révocation d'aidant Kinhale.
- **Scalabilité logarithmique** : dans un groupe de N membres, la rotation de clé après révocation coûte O(log N) opérations cryptographiques, pas O(N). Pour un foyer de 10 membres, c'est ~4 opérations, pas 10.
- **Auditabilité forte** : le `GroupInfo` MLS est signé par l'Admin, chaque membre peut vérifier son membership dans l'arbre. Impossible pour un device corrompu d'injecter silencieusement un faux membre.

**Inconvénients** :
- **Maturité des bindings mobile incertaine** : `openmls` est stable en Rust, mais les bindings React Native (via WASM ou JSI) sont expérimentaux en avril 2026. `mls-ts` est encore en développement actif. Le PoC Sprint 0 est obligatoire pour valider que les bindings compilent et fonctionnent sur iOS + Android.
- **Complexité du protocole** : MLS introduit des concepts non triviaux (KeyPackages, Welcome messages, GroupInfo, epoch management, Commit/Proposal pipeline). L'implémentation correcte d'un client MLS — même en utilisant `openmls` — requiert une compréhension fine du protocole.
- **Taille du bundle** : le WASM `openmls` compilé est significatif (~2-5 Mo avant optimisations). Sur mobile natif via JSI, la taille est moindre mais dépend des bindings disponibles.
- **Gestion de l'état MLS** : chaque client doit persister l'état du groupe MLS (KeyPackage, groupe sécurisé, époque courante) de façon durables et chiffrée, indépendamment du document Automerge. C'est une couche de stockage supplémentaire à gérer.

**Risques** :
- **Risque principal** : les bindings React Native pour `openmls` ne sont pas encore stables en production mobile. Si le PoC échoue, on doit basculer sur le Double Ratchet, ce qui retarde le Sprint 0 de 1-2 semaines.
- **Risque secondaire** : une erreur d'implémentation dans la gestion des epochs (ex : ne pas avancer correctement après un Commit) peut silencieusement briser la FS sans erreur apparente. Seul un test vector complet ou un audit externe peut détecter ce type de bug.

### Option B — Signal Protocol simplifié (Double Ratchet par paires de devices)

**Description** : Le Signal Protocol utilise deux mécanismes : le X3DH (Extended Triple Diffie-Hellman) pour l'échange de clés initial entre deux parties, et le Double Ratchet pour la rotation de clés au cours d'une conversation. Pour les groupes, Signal implémente un "Sender Key Protocol" : chaque membre génère une clé d'expédition, et les messages sont chiffrés avec cette clé puis distribués.

Pour Kinhale, cela se traduirait par : chaque device génère une clé de groupe partagée via X3DH lors de l'invitation, et tous les deltas Automerge sont chiffrés avec cette clé partagée. À la révocation, une nouvelle clé est générée et distribuée à tous les membres restants via X3DH 1-à-1 avec chacun.

**Avantages** :
- **Protocole extrêmement bien documenté et audité** : le Signal Protocol a des dizaines d'analyses formelles publiées, et sa sécurité est considérée comme établie.
- **Implémentation plus simple pour les groupes petits** : pour un foyer de 2-5 devices, la rotation de clé O(N) est acceptable (~5 échanges X3DH au maximum).
- **Librairies disponibles** : `libsodium` couvre X25519 (base de X3DH) et XChaCha20-Poly1305 (chiffrement symétrique). Une implémentation Double Ratchet simplifiée peut être bâtie dessus avec ~500-800 lignes de code crypto.
- **Pas de dépendance externe complexe** : pas de WASM lourd, pas de bindings React Native expérimentaux. Tout repose sur `react-native-libsodium` qui est déjà une dépendance requise.
- **Forward Secrecy complète** via le ratchet : chaque message fait avancer le ratchet, les clés passées sont effacées.

**Inconvénients** :
- **Post-Compromise Security limitée** : le Double Ratchet offre une PCS partielle dans les échanges bilatéraux, mais dans la configuration "Sender Key" de groupe, un attaquant qui a compromis la clé de groupe ne sera exclu qu'à la prochaine révocation/rotation explicite.
- **Révocation coûteuse** : à la révocation d'un aidant, il faut effectuer N-1 échanges X3DH (un par membre restant) pour distribuer la nouvelle clé. Pour 10 membres, c'est 9 échanges. Acceptables, mais avec une latence de ~2-5s vs ~200ms pour MLS.
- **Gestion de la simultaneité complexe** : si deux aidants sont ajoutés quasi-simultanément (cas éducatrice CPE sur 8 foyers le même matin), l'ordre des échanges X3DH peut créer des états incohérents transitoires. La résolution nécessite un protocole supplémentaire.
- **Pas de standard formel** pour la configuration "Sender Key" de groupe : l'implémentation custom augmente la surface d'audit et le risque d'erreur de conception.
- **Auditabilité moins simple** : un auditeur externe doit auditer notre design complet, pas seulement sa conformité à une RFC.

**Risques** :
- Risque d'erreur de conception dans la gestion des états concurrents qui n'est détectée qu'à l'usage ou à l'audit.
- Risque de "protocol creep" : commencer simple et devoir ajouter des cas particuliers qui rendent le code crypto aussi complexe que MLS mais sans les garanties formelles.

## Critères de décision

1. **Forward Secrecy et Post-Compromise Security** — les deux propriétés sont requises pour la promesse E2EE zero-knowledge.
2. **Révocation propre** — la révocation d'un aidant doit exclure toute possibilité de déchiffrement des messages futurs.
3. **Auditabilité** — un auditeur crypto externe (Sprint 5-6) doit pouvoir valider l'implémentation sans lire 10 000 lignes de code crypto custom.
4. **Maturité des bindings mobile** — doit fonctionner sur iOS + Android + Web dès Sprint 0.
5. **Complexité d'implémentation pour un solo dev** — minimiser le risque d'erreur silencieuse.
6. **Performance de révocation** — la révocation d'un aidant ne doit pas bloquer l'UI > 5 secondes.

## Décision

**Choix retenu : Option A — MLS (RFC 9420) via `openmls`/`mls-ts`, SOUS RÉSERVE de validation du PoC Sprint 0**

MLS est le bon choix *sur le principe* pour toutes les raisons évoquées : standard IETF auditée, FS+PCS natifs, révocation efficace O(log N), auditabilité par référence à la RFC. Pour une application qui gère des données de santé d'enfants avec une promesse E2EE zero-knowledge, ne pas choisir le standard IETF de référence lorsqu'il est disponible serait difficile à défendre éthiquement et techniquement.

Cependant, ce choix est conditionné à un PoC obligatoire en Sprint 0 : 3 devices (iOS + Android + Web) + 1 révocation, avec validation que les bindings disponibles (`openmls` via WASM ou JSI, ou `mls-ts`) compilent, passent les tests d'intégration, et ont des performances acceptables (temps de révocation < 5s pour un groupe de 5 membres).

Ce qui ferait pencher vers le fallback : si le PoC échoue sur les bindings mobiles, si `mls-ts` est en trop mauvaise posture de maturité pour être fiable, ou si l'auditeur crypto externe (consulté en preview au Sprint 0) identifie un risque spécifique sur l'implémentation disponible.

**Si le PoC Sprint 0 échoue** : basculer sur le Double Ratchet avec Sender Key, documenter le compromis dans cet ADR, et planifier la migration vers MLS pour la v1.1 dès que les bindings seront stables.

## Conséquences

**Positives :**
- Forward Secrecy et Post-Compromise Security garantis formellement par le standard.
- Révocation native en un seul Commit MLS — opération atomique du point de vue de l'Admin.
- L'auditeur crypto externe peut travailler contre la RFC 9420, pas contre une implémentation custom.
- Un `household_id` = un groupe MLS. Un device = un membre MLS avec son KeyPackage. La correspondance avec le modèle de données Kinhale est directe.
- Chaque epoch MLS peut être corrélé à une version du document Automerge — le chiffrement des deltas CRDT avec le secret de l'epoch courant est une invariante forte.

**Négatives / compromis acceptés :**
- Le PoC Sprint 0 est critique path — si les bindings mobiles sont instables, le Sprint 0 prend 1-2 semaines supplémentaires.
- La gestion de l'état MLS (KeyPackage, groupe, epoch) ajoute une couche de stockage chiffré (`packages/crypto/mls-state`) distincte du document Automerge.
- L'onboarding d'un nouveau device (Welcome MLS) nécessite que l'Admin soit en ligne ou que son device soit accessible — une subtilité UX à gérer (message "En attente de confirmation de l'Admin du foyer").
- Les utilisateurs qui perdent leur device perdent aussi leur état MLS local — la restauration via recovery seed doit régénérer un nouveau KeyPackage et passer par l'Admin pour un Commit Add. Ce flux est plus complexe que le double Ratchet.

**Plan de fallback** : Double Ratchet X3DH par paires avec Sender Key pour le groupe. Implémenté sur `react-native-libsodium` uniquement. Coût de migration de MLS → Double Ratchet si le PoC échoue : 3-4 jours-homme. Coût de migration ultérieure Double Ratchet → MLS (v1.1) : 5-7 jours-homme + rotation de toutes les clés en production (opération critique à planifier avec les utilisateurs).

## Plan de PoC Sprint 0

Le PoC doit valider les points suivants avant verrouillage :
1. Build `openmls` ou `mls-ts` sur iOS (Bare Workflow Expo) sans erreur de compilation.
2. Build sur Android (Bare Workflow Expo) sans erreur Gradle.
3. Build sur Web (Next.js 15 avec WASM) sans erreur.
4. Création d'un groupe MLS avec 3 membres (devices simulés), chiffrement d'un message, déchiffrement sur les 3 devices.
5. Add Proposal + Commit pour un 4e member. Validation que le 4e membre peut déchiffrer les messages post-commit.
6. Remove Proposal + Commit pour le 4e membre. Validation que le 4e membre ne peut plus déchiffrer les messages post-commit (test négatif critique).
7. Persistance de l'état MLS entre les redémarrages de l'app (state sérialisé en SQLite chiffré).
8. Temps de révocation mesuré pour un groupe de 5 membres : cible < 5s sur device mid-range Android.

Le PoC est considéré comme validé si tous ces points passent. Toute régression sur le point 6 (test négatif de révocation) est un bloquant absolu.

## Révision prévue

Après le PoC Sprint 0 (décision finale : MLS confirmé ou fallback Double Ratchet). Puis après l'audit crypto externe Sprint 5-6 (possibles recommandations de paramètres ou d'implémentation). À réévaluer en v1.1 si les bindings MLS pour React Native arrivent à maturité stable (si on a dû prendre le fallback Double Ratchet).
