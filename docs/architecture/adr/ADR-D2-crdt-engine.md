# ADR-D2 — Moteur CRDT : Automerge 2 vs Yjs

**Date** : 2026-04-20
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

L'architecture local-first de Kinhale repose sur un principe fondamental : chaque device porte une copie complète et cohérente de toutes les données du foyer. Quand plusieurs aidants sont en ligne simultanément (parent + co-parent + éducatrice), leurs modifications doivent converger automatiquement vers un état identique sur tous les devices, sans passer par un serveur central arbitre. Quand un aidant est hors-ligne pendant des heures (garderie en sous-sol), ses modifications doivent s'intégrer proprement à son retour, sans écarter les modifications concurrentes des autres aidants.

Ces exigences définissent exactement le problème que les CRDT (Conflict-free Replicated Data Types) résolvent. Sans CRDT, il faudrait implémenter un protocole de reconciliation personnalisé avec gestion des vecteurs de causalité, résolution de conflits sémantiques, et garantie de convergence — une tâche qui représente 3-6 mois de développement pour un solo dev, sans les garanties formelles d'un CRDT éprouvé.

Le schéma de données de Kinhale est spécifique : des listes append-only d'événements signés (`DoseAdministered`, `SymptomReported`, `PumpReplaced`, `PlanUpdated`, `CaregiverInvited`, `CaregiverRevoked`), chaque événement signé Ed25519 par le device émetteur. Les entités dérivées (plan en cours, pompes actives, niveau de doses restantes) sont des projections calculées à la lecture, jamais stockées comme état concurrent. Ce schéma favorise les structures de listes append-only plutôt que les textes collaboratifs temps réel.

## Options évaluées

### Option A — Automerge 2

**Description** : Automerge 2 est une implémentation CRDT de référence développée par Ink & Switch, le laboratoire de recherche derrière le manifeste "local-first software". Le format binaire 2.x est stable et compact. L'API expose des types riches (Maps, Lists, Text, Counter) qui correspondent naturellement aux entités métier de Kinhale.

**Avantages** :
- **Alignement conceptuel avec le projet** : Ink & Switch est l'origine intellectuelle du mouvement local-first. La communauté Automerge est celle des développeurs et chercheurs les plus sensibles aux problématiques de privacy et de possession des données.
- **Modèle de données JSON-like** : `Doc<T>` avec types TypeScript génériques. Un `FoyerDoc` avec une liste `events: DoseEvent[]` est naturel et typé strictement.
- **Sync incrémental efficace** : `getChanges(sinceHeads)` produit un delta minimal que l'on chiffre et publie dans la mailbox. Les devices ne rechargent que les changements depuis leur dernier head connu.
- **Maturité du format 2.x** : le format binaire est stable, les migrations de schéma sont documentées.
- **Auteur des changements** : chaque changement Automerge porte un `actorId` (UUID du device) — ce qui complète naturellement notre signature Ed25519.
- **Performance** : le backend Rust (compilé en WASM) d'Automerge 2 est significativement plus rapide qu'Automerge 1 sur les opérations de merge et de sauvegarde/chargement. Tests publiés : merge de 10k opérations en < 50ms sur device mid-range.

**Inconvénients** :
- L'API peut surprendre : les mutations doivent se faire dans une fonction `change()` — les modifications directes sur l'objet ne sont pas réactives. Nécessite une discipline API spécifique.
- Le WASM ajoute ~800Ko au bundle web (acceptable, mais à surveiller avec code-splitting).
- Moins de ressources sur les patterns "append-only signés" spécifiquement — la documentation se concentre sur le collaboratif texte.

**Risques** :
- Faible. Automerge 2 est en production dans plusieurs apps local-first en 2026. Les breaking changes du format sont annoncés longtemps à l'avance.

### Option B — Yjs

**Description** : Yjs est le CRDT le plus utilisé en production pour la collaboration temps réel (ProseMirror, CodeMirror, Quill, Notion-like editors). Il utilise le YATA algorithm (Yet Another Transformation Approach) et propose des bindings pour de nombreux frameworks.

**Avantages** :
- **Performances temps réel exceptionnelles** : Yjs est optimisé pour les textes collaboratifs avec des milliers de petites opérations concurrentes par seconde — bien au-delà des besoins de Kinhale.
- **Écosystème très large** : providers pour WebSocket, WebRTC, IndexedDB, nombreux bindings éditeurs de texte.
- **Documentation abondante** sur les cas d'usage collaboratifs.
- Léger : pas de WASM requis pour les cas simples.

**Inconvénients** :
- **Modèle de données plus bas niveau** : `Y.Map`, `Y.Array`, `Y.Text` — moins expressif qu'Automerge pour un schéma de données métier typé. Il faut mapper manuellement les entités métier sur les types Yjs, ce qui introduit une couche d'abstraction et des risques de bugs de sérialisation.
- **Historique et causalité moins riches** : Yjs expose moins facilement l'historique des opérations et leurs auteurs, ce qui complique l'implémentation de l'audit trail client et de la vérification des signatures Ed25519 par opération.
- **Optimisé pour un usage texte collaboratif** qui n'est pas notre cas principal. On paie un overhead d'abstraction pour un use-case (listes d'événements signés) que Yjs ne cible pas naturellement.
- L'écosystème "privacy-first" et "local-first" est moins central dans la communauté Yjs que dans celle d'Automerge.

**Risques** :
- Risque de complexité accidentelle : mapper le schéma événementiel signé de Kinhale sur les types Yjs requiert une couche d'abstraction custom qui devient elle-même une surface de bug.

### Option C — Solution CRDT custom

Non évaluée sérieusement pour la v1.0. Implémenter un CRDT correct (causalité, commutativité, idempotence, convergence) est un problème de recherche. Pour un solo dev avec un budget de 13-15 semaines, c'est hors budget et hors compétence raisonnable.

## Critères de décision

1. **Adéquation au schéma événementiel signé** — le modèle de données (listes append-only d'événements Ed25519) doit être naturel à exprimer.
2. **Typage TypeScript strict** — `strict: true`, `noUncheckedIndexedAccess: true` sont obligatoires.
3. **Performance sur le profil de charge cible** — fusion de 10 devices × 1000 événements en < 100ms.
4. **Sync incrémental compact** — les deltas à chiffrer et envoyer via mailbox doivent être minimaux.
5. **Auditeur Ed25519 par événement** — chaque opération doit pouvoir porter la signature de son device émetteur.
6. **Alignement communautaire** — l'écosystème et la communauté doivent être cohérents avec la posture privacy-first du projet.

## Décision

**Choix retenu : Option A — Automerge 2**

La décision se fonde principalement sur l'adéquation naturelle entre le modèle de données d'Automerge 2 et le schéma événementiel signé de Kinhale. Un document Automerge `{ events: DoseEvent[], household: HouseholdConfig }` est typé strictement avec les generics TypeScript d'Automerge et correspond exactement à la structure que l'on veut : des listes append-only que tous les devices convergent vers le même état, avec l'historique de qui a émis quoi.

Le modèle `actorId` natif d'Automerge complète parfaitement notre signature Ed25519 : chaque `change` Automerge est signé par un `actorId` qui correspond à notre `device_id`, et nous ajoutons la signature Ed25519 en tant que metadata du changement (`change.metadata.signature`). L'auditabilité est ainsi native.

La communauté Ink & Switch / Automerge est aussi la communauté qui a théorisé le local-first software — Kinhale y trouve une documentation conceptuelle riche (notamment sur la gestion des conflits sémantiques dans les applications médicales) que la communauté Yjs, orientée éditeurs de texte, n'offre pas.

Ce choix serait invalidé si : le benchmark Sprint 0 (10 devices × 1000 événements) révèle des latences > 100ms sur device mid-range Android, ou si le WASM Automerge crée des problèmes d'intégration avec React Native 0.74+ que le PoC ne parvient pas à résoudre.

## Conséquences

**Positives :**
- Modèle de données TypeScript natif, strict, sans couche d'abstraction custom.
- Audit trail client naturellement disponible via l'historique Automerge, complété par les signatures Ed25519.
- Sync incrémental compact : `getChanges(sinceHeads)` produit des deltas binaires minimaux, idéaux pour chiffrer et envoyer via mailbox S3.
- Convergence garantie : deux devices avec les mêmes changements Automerge arrivent toujours au même état, quelle que soit l'ordre de réception.
- La vue consolidée multi-foyers (Marie, éducatrice CPE, sur 8 foyers) est un merge de N documents Automerge — opération native et performante.

**Négatives / compromis acceptés :**
- L'API `change()` d'Automerge impose une discipline de mutation différente du state React habituel — courbe d'apprentissage de 1-2 jours pour un dev React senior.
- Le WASM ajoute ~800Ko au bundle web initial (mitigé par code-splitting et lazy loading).
- Les migrations de schéma (ajout d'un champ à `DoseEvent`) nécessitent une stratégie de compatibilité explicite entre versions — documentée dès le Sprint 0 dans un fichier `packages/sync/SCHEMA_MIGRATION.md`.

**Plan de fallback** : Si le PoC Automerge révèle des problèmes de performance ou d'intégration React Native insurmontables, le fallback est Yjs avec une couche d'abstraction `EventList<T>` custom autour de `Y.Array`. Coût estimé de la migration : 3-5 jours-homme (la couche `packages/sync` est suffisamment isolée). La décision de fallback doit être prise avant la fin du Sprint 0.

## Révision prévue

Après le benchmark Sprint 0 obligatoire : fusion de 10 devices × 1000 événements, latence médiane cible < 100ms. Si la cible n'est pas atteinte, réévaluer avec Yjs. À revoir également si Automerge 3.0 introduit des breaking changes majeurs du format binaire qui imposeraient une migration de données en production.
