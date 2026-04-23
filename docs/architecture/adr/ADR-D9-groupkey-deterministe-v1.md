# ADR-D9 — GroupKey E2EE déterministe (compromis v1.0 avant MLS)

**Date** : 2026-04-23
**Statut** : Accepté (temporaire, à remplacer par ADR-D3 cible)
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

L'ADR-D3 fixe la cible du protocole de groupe E2EE de Kinhale : MLS (RFC 9420) via `openmls`, avec fallback Double Ratchet si le PoC Sprint 0 échoue. Cette cible n'est pas encore opérationnelle en avril 2026 : les bindings React Native pour `openmls` (via JSI ou WASM) ne sont pas validés en production mobile, `mls-ts` est encore en développement actif, et le PoC Sprint 0 a été repoussé faute de bindings suffisamment matures pour être intégrés sans risque de régression sur la chaîne de build iOS + Android + Web.

Parallèlement, la roadmap impose une démonstration multi-device fonctionnelle dès le Sprint 4 : un foyer doit pouvoir chiffrer ses deltas Automerge sur un device, les pousser via le relai, et les voir appliqués sur un second device du même foyer — le tout sans que le relai n'ait jamais accès au contenu santé en clair. Cette démonstration est nécessaire pour les tests utilisateurs internes et pour valider l'architecture de sync sur un cas réel avant de complexifier la couche crypto.

La PR A web (#188, mergée le 23 avril) a introduit `apps/web/src/lib/sync/group-key.ts` avec `groupKey = Argon2id(householdId, salt_fixe, 32 bytes)`. La PR B mobile (#189) duplique fidèlement cette approche côté Expo. Les deux PRs documentent le compromis en commentaire d'entête du fichier `group-key.ts`, mais aucun ADR ne formalise la décision, ses limites, ni son plan de remplacement. Le présent document comble ce manque.

Le modèle de menace cible posé par le PRD et l'ADR-D3 est le zero-knowledge strict : même un opérateur Kamez contraint par réquisition, même un relai entièrement compromis, ne doit pas pouvoir déchiffrer une seule donnée santé. La solution actuelle s'écarte de cette cible sur deux points précis (dérivation déterministe depuis le `householdId`, `mailboxId = householdId` en clair côté relai). Il est essentiel que cet écart soit tracé explicitement, avec ses conséquences, et qu'il ne soit pas confondu avec la promesse de sécurité v1.0 telle qu'elle sera communiquée aux utilisateurs à partir du Sprint 7-8.

## Options évaluées

### Option A — Implémenter MLS (ou Double Ratchet) dès Sprint 4

**Description** : Intégrer le protocole cible (MLS via `openmls`, ou fallback Double Ratchet avec Sender Key) dès le Sprint 4, avant toute démonstration multi-device. Aucun compromis transitoire : la sync est construite directement sur la crypto cible.

**Avantages** :
- Aucune dette cryptographique à rembourser ultérieurement.
- La promesse zero-knowledge est tenue sans exception dès la v1.0.
- Pas de migration de clé à orchestrer pour les foyers existants — l'ensemble des blobs du relai est chiffré sous le bon schéma dès le départ.
- Permet un audit crypto externe continu sur le même code de production, sans artefact transitoire à ignorer.

**Inconvénients** :
- Les bindings React Native `openmls` ne sont pas stables en avril 2026. Intégrer MLS dès Sprint 4 impose soit de porter soi-même les bindings (plusieurs semaines de travail C++/Rust), soit de basculer immédiatement sur le fallback Double Ratchet avec un Sender Key Protocol custom — ce qui signifie écrire ~500-800 lignes de code crypto custom auditables sans avoir encore la capacité d'audit externe (l'auditeur crypto est prévu Sprint 5-6).
- Le coût est incompatible avec la fenêtre Sprint 4 : 2-3 semaines-homme de crypto pure retardent l'ensemble de la feature sync et de ses dépendances (persistance partagée, invitation QR, réconciliation CRDT multi-device).
- Sprint 4 est aussi le sprint où le flux d'invitation QR doit être opérationnel pour les tests utilisateurs. MLS impose un `Welcome` message et un Admin en ligne, ce qui modifie substantiellement l'UX d'onboarding — cette modification doit être mûrie et testée, pas bricolée sous contrainte de temps.

**Risques** :
- Écrire du code crypto custom (fallback Double Ratchet) sans audit et sous pression de planning est précisément le scénario le plus dangereux pour un projet de santé : risque d'erreur silencieuse de conception, détectée trop tard, avec des données déjà en production à rewrapper.
- Retarder Sprint 4 par effet domino (sync en retard → pas de données multi-device → pas de validation utilisateur → pas de retour d'usage avant Sprint 6-7) déstabilise l'ensemble du plan v1.0.

### Option B — GroupKey déterministe depuis le householdId (retenue pour v1.0)

**Description** : La clé de groupe est dérivée de façon déterministe depuis le `householdId` par Argon2id avec un salt fixe documenté et 32 octets de sortie. Tous les devices du même foyer qui partagent le `householdId` convergent sur la même `groupKey` sans échange de secret additionnel. Le `mailboxId` transmis au relai est le `householdId` en clair, ce qui permet au relai de router les blobs chiffrés vers la bonne boîte de messages. Le chiffrement symétrique reste XChaCha20-Poly1305 AEAD avec un nonce aléatoire par message — conforme aux invariants `packages/crypto`.

**Avantages** :
- Débloque la sync multi-device immédiatement : le flux d'invitation QR partage déjà le `householdId` en clair entre les aidants, donc aucun protocole supplémentaire à implémenter pour Sprint 4.
- Pas de rotation de clé à orchestrer : un foyer = une clé stable, pas d'epoch, pas d'état de groupe à persister en SQLCipher en parallèle du document Automerge.
- Compatible avec le schéma Automerge + mailbox existant : le wire format reste identique, seule la dérivation de clé change.
- La surface de code à auditer est réduite (~50 lignes de dérivation + cache) — auditable trivialement par un pair et par l'auditeur externe du Sprint 5-6.
- Le nonce aléatoire par message préserve l'intégrité AEAD et l'unicité des ciphertexts même avec une clé stable.

**Inconvénients** :
- **Pas de Post-Compromise Security** : un attaquant qui obtient le `householdId` d'un foyer (fuite DB relai, subpoena, insider Kamez, log accidentel, compromission serveur) peut dériver la `groupKey` et déchiffrer l'intégralité des blobs mailbox du foyer, passés et futurs.
- **Pas de Forward Secrecy cryptographique** : la clé ne tourne jamais spontanément, la compromission de la clé actuelle compromet tout l'historique chiffré conservé par le relai.
- **`mailboxId = householdId` en clair** : le relai peut corréler le volume de trafic par foyer, inférer l'activité, et relier deux devices du même foyer par leur `mailboxId` commun. Métadonnées exploitables, même si aucun contenu santé ne transite en clair.
- **Révocation d'aidant impossible cryptographiquement** : si un aidant (ex : CPE qui quitte le foyer, conjoint révoqué) a conservé le `householdId`, il peut continuer à déchiffrer les blobs futurs tant que le protocole cible MLS n'est pas en place. La révocation métier (suppression de l'accès au relai via révocation de token JWT) n'empêche pas un ancien aidant qui aurait fait une copie des blobs d'en déchiffrer le contenu.

**Risques** :
- Si l'option est communiquée par erreur aux utilisateurs comme "zero-knowledge strict" avant la bascule MLS, la promesse produit est violée — risque d'image et juridique (Loi 25, RGPD, Consumer Protection).
- Si un foyer fuit son `householdId` (partage accidentel via capture d'écran, e-mail, message non chiffré), l'exposition est totale et rétroactive.

### Option C — Dériver groupKey via un secret partagé transmis à l'invitation

**Description** : Plutôt que de dériver la clé depuis le `householdId`, générer un secret aléatoire de 32 octets à la création du foyer, et le transmettre aux aidants via le flux d'invitation (QR code, lien signé). Les devices stockent ce secret dans le Keychain / Keystore. Le `mailboxId` reste un identifiant distinct du secret (par exemple un pseudonyme HMAC).

**Avantages** :
- Découple le `mailboxId` du matériel cryptographique : une fuite du `mailboxId` ne permet pas de déchiffrer les blobs.
- Pré-curseur propre de MLS : la logique d'invitation avec transport de secret se rapproche du flux `KeyPackage` / `Welcome` MLS, donc le code de l'invitation peut être partiellement réutilisé.
- Forward Secrecy partielle possible si le secret est rotaté périodiquement ou à la révocation (mais la rotation reste O(N) comme en Signal Sender Key, avec les mêmes limites de simultanéité que documentées dans ADR-D3).

**Inconvénients** :
- Le coût d'implémentation de l'invitation sécurisée (chiffrement du secret pour le destinataire, signature d'invitation, validité de courte durée, protection contre le rejeu) est proche de celui d'un Welcome MLS simplifié — soit ~1 à 1.5 semaines-homme de crypto auditable, sans apporter les bénéfices structurels de MLS (pas de PCS, pas de TreeKEM, pas de révocation logarithmique).
- Reste une solution custom : surface d'audit plus grande que MLS standardisé.
- Dans 2-3 sprints on jette la plus grande partie de ce code pour passer à MLS, ce qui dégrade le ratio coût/valeur.

**Risques** :
- Investir dans une crypto custom intermédiaire qui sera remplacée sans avoir servi en production réelle — dette de maintenance pour un gain temporaire.
- Créer une deuxième trajectoire de migration (v1.0 déterministe → v1.0.x secret partagé → v1.1 MLS) au lieu d'une seule (v1.0 déterministe → v1.1 MLS).

## Critères de décision

1. **Déblocage de la démo Sprint 4 multi-device** : la sync doit être fonctionnelle de bout en bout pour les tests utilisateurs, sans attendre la maturité des bindings MLS.
2. **Non-aggravation de la surface d'attaque par rapport à l'état v0** : le relai ne doit pas recevoir plus de données santé en clair qu'il n'en recevait avant — en l'occurrence aucune, le contenu Automerge reste chiffré AEAD dans tous les scénarios.
3. **Réversibilité** : la décision doit pouvoir être remplacée par MLS sans migration catastrophique, idéalement sans déconnexion prolongée des foyers ni perte de données.
4. **Transparence** : le compromis doit être explicite en code (commentaire d'entête de `group-key.ts`), en documentation (présent ADR), et communicable à un auditeur externe ou à un utilisateur averti qui pose la question.
5. **Proportionnalité du risque** : l'écart au zero-knowledge strict ne doit concerner qu'une fenêtre temporelle bornée (jusqu'à la bascule MLS Sprint 7-8) et ne doit pas être communiqué aux utilisateurs grand public comme une propriété de sécurité finale.

## Décision

**Choix retenu : Option B — GroupKey déterministe via `Argon2id(householdId, salt_fixe, 32 bytes)` pour v1.0, avec remplacement planifié par MLS (ADR-D3) en Sprint 7-8**.

Ce choix est un compromis explicite et temporaire. Il acte qu'en avril 2026, la maturité des bindings MLS React Native n'est pas suffisante pour justifier d'implémenter la cible directement, et qu'aucune solution intermédiaire (Option C) ne présente un ratio coût/valeur supérieur à "tenir bon jusqu'à MLS".

La décision est conditionnée à trois exigences :
1. Le compromis est documenté en tête de `group-key.ts` côté web et mobile (déjà fait en PR A #188 et PR B #189).
2. Le présent ADR est publié avant toute communication externe sur la sécurité de la sync v1.0.
3. La migration MLS est planifiée et tracée (voir plan de migration ci-dessous) comme un livrable obligatoire pour la v1.0 publique — et non pour une v1.1 indéterminée.

Ce qui invaliderait ce choix avant terme : une fuite publique de `householdId` dans un foyer test, une exigence conformité Loi 25 ou RGPD explicitement incompatible avec la configuration actuelle, ou un retour d'audit crypto Sprint 5-6 qui classerait le compromis comme P0 non-acceptable.

## Conséquences

**Positives :**
- Sync multi-device bidirectionnelle opérationnelle dès Sprint 4, sans bloquer la roadmap produit.
- Démonstration client et tests utilisateurs internes possibles sur un flux sync réaliste.
- Aucune régression fonctionnelle par rapport aux règles métier RM1-RM9 : l'application reste journal + rappel + partage, sans aucun impact sur les propriétés observables côté utilisateur.
- Le relai Kamez ne voit toujours que des blobs chiffrés AEAD (XChaCha20-Poly1305) — le contenu santé ne transite jamais en clair, ce qui reste conforme à la promesse zero-knowledge pour le contenu.
- Surface de code crypto minimale (~50 lignes) pendant la fenêtre v1.0, facile à auditer, facile à remplacer.

**Négatives / dette acceptée :**
- Pas de Post-Compromise Security : un attaquant qui obtient le `householdId` d'un foyer peut déchiffrer l'intégralité de l'historique passé et futur stocké côté relai.
- Pas de Forward Secrecy cryptographique : la clé ne tourne jamais sur la fenêtre v1.0.
- Le `mailboxId = householdId` en clair côté relai permet la corrélation foyer ↔ volume de trafic et foyer ↔ devices. Métadonnées exploitables, notamment pour l'inférence comportementale.
- La révocation d'un aidant (cas CPE qui quitte le foyer) ne rote pas la clé : l'aidant révoqué, s'il a conservé le `householdId` ou copié des blobs, peut toujours déchiffrer les blobs futurs tant que MLS n'est pas en place. La révocation métier (retrait du token d'accès au relai) empêche la réception de nouveaux blobs mais pas le déchiffrement de blobs déjà copiés.
- La communication utilisateur sur la sécurité v1.0 doit être mesurée : on peut affirmer "le relai ne voit jamais le contenu santé en clair", on ne peut pas affirmer "même Kamez ne peut pas déchiffrer" tant que MLS n'est pas en place. La nuance doit être tenue par l'équipe produit et juridique jusqu'à bascule.

**Plan de migration vers MLS (ADR-D3) :**
- **Sprint 7** : PoC `openmls` mobile (RN, via JSI ou WASM) et web (WASM) validé sur iOS + Android + Chrome + Firefox. Critères de succès identiques au PoC initialement prévu pour Sprint 0 (ADR-D3 section Plan de PoC Sprint 0), avec un test négatif de révocation bloquant.
- **Sprint 8** : implémentation du flux MLS complet — génération de KeyPackage par device, `Welcome` message porté par le flux d'invitation, `Commit` pour l'Add d'un membre, persistance de l'état MLS en SQLCipher séparée du document Automerge.
- **Sprint 9** : migration des foyers existants. Pour chaque foyer : génération d'un epoch MLS initial avec tous les devices connus, rewrap du dernier snapshot Automerge sous le nouveau secret d'epoch, purge progressive des blobs mailbox chiffrés avec l'ancienne `groupKey` déterministe une fois que tous les devices ont confirmé la bascule. Les foyers dont un device reste hors ligne > 30 jours conservent l'ancienne clé en fallback jusqu'à reconnexion.
- **Communication utilisateur** : la migration est silencieuse côté UX courant. Seul l'écran "Paramètres sécurité" affiche l'indicateur "Chiffrement renforcé activé (MLS)" après bascule, avec un lien vers la documentation publique et éventuellement vers cet ADR archivé.

**Points à tracer en télémétrie (ticket KIN-040 à ouvrir) :**
- Compteur pseudonymisé des échecs de `consumeSyncMessage` (cf. M2 du rapport `kz-securite-KIN-038.md`) pour distinguer les attaques de MITM des bugs de désérialisation côté relai.
- Champ de version `v` dans le wire format des blobs mailbox, permettant la coexistence de blobs v1 (groupKey déterministe) et v2 (MLS) pendant la fenêtre de migration Sprint 9.
- Compteur d'entrées en cache de `groupKey` par `householdId` (`_resetGroupKeyCache` exclu en production), pour détecter d'éventuelles dérives de cache entre tests et runtime.

## Statut futur

Cet ADR sera marqué **Superseded by ADR-Dxx** dès que MLS est déployé en production (Sprint 9, objectif avant release publique v1.0). Il reste consulté comme archive du compromis accepté pendant la fenêtre Sprint 4 → Sprint 9, et comme référence auditable pour l'auditeur crypto externe Sprint 5-6 qui doit comprendre l'état transitoire du système au moment où il l'audite.

## Révision prévue

Revue obligatoire au terme de Sprint 7 (validation du PoC MLS), avec décision ferme sur le calendrier Sprint 8-9 de la migration. Revue anticipée si un incident de sécurité (fuite de `householdId`, compromission d'un opérateur relai, évolution réglementaire Loi 25 ou RGPD) impose une accélération de la bascule MLS ou un retrait temporaire de la fonctionnalité de sync multi-device.
