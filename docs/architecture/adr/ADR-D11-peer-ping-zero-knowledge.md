# ADR-D11 — Peer ping `dose_recorded` : métadonnée signalée au relais sans fuite santé

**Date** : 2026-04-24
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

La règle métier RM5 (SPECS §4) impose que lorsqu'un aidant A enregistre une prise (fond ou secours), tous les autres aidants actifs du foyer reçoivent une notification informative sous 5 secondes en ligne, ou dès le retour de réseau pour les aidants hors-ligne. La user story E5-S05 (KIN-082) opérationnalise cette règle en exigeant un push OS opaque (RM16 : `title: "Kinhale"`, `body: "Nouvelle activité"`, aucune donnée santé).

L'architecture de synchronisation Kinhale est explicitement local-first + E2EE zero-knowledge : le document Automerge du foyer est chiffré de bout en bout (XChaCha20-Poly1305 AEAD sous la `groupKey` dérivée — ADR-D9), et le relais Kamez reçoit uniquement des blobs opaques `EncryptedChangeset`. Le relais **ne peut pas lire** le contenu des événements — il ne sait donc pas si un changeset contient une nouvelle prise, une édition de plan, une invitation d'aidant ou une simple mise à jour de métadonnée locale. Il ne peut pas, sans information supplémentaire, distinguer « un changeset qui mérite une notification peer » d'un changeset silencieux.

La boucle actuelle `relay.ts` envoie un `dispatchPush` fire-and-forget **à chaque message WS reçu** vers tous les autres devices du foyer. Cela réalise partiellement RM5 (un push part bien à chaque mutation propagée), mais au prix de trois défauts :

1. Tout changement Automerge, même anodin (édition de préférence locale persistée dans le doc, rotation de clé, simple ack Automerge), déclenche un push — le taux de notification est surestimé et consomme le quota anti-spam RM9.
2. Le type de notification transmis au dispatcher est `undefined` — les préférences granulaires (E5-S07, KIN-080) et les quiet hours (E5-S08, KIN-081) ne sont **pas** appliquées, alors même que l'utilisateur a explicitement désactivé `peer_dose_recorded` ou configuré une plage « ne pas déranger ».
3. Le relais n'a pas la notion de typage métier du ping : impossible à terme de router différemment un `peer_dose_recorded` d'un `pump_low` ou d'un `caregiver_revoked`.

La question adressée par cet ADR : comment le relais peut-il distinguer un « changeset qui justifie une notification peer » (type précis : `peer_dose_recorded`) d'un « changeset silencieux », **sans jamais avoir accès au contenu du document** ni aux identifiants santé (enfant, pompe, type de dose, horodatage exact) ?

## Options évaluées

### Option A — Signal explicite côté client via un message WS typé `peer_ping` (retenue)

**Description** : Le client qui enregistre une nouvelle prise (et signe un événement `DoseAdministered`) émet, **en plus** du blob chiffré de sync, un second message WS de type `peer_ping`. La structure de ce message est figée et ne contient aucune donnée santé :

```json
{
  "type": "peer_ping",
  "pingType": "dose_recorded",
  "doseId": "<uuid>",
  "sentAtMs": 1716550821234
}
```

Le `householdId` et le `senderDeviceId` sont déjà portés par le JWT du handshake WS — inutile de les dupliquer dans le payload (défense en profondeur : l'aidant ne peut pas spoofer le foyer d'un autre). Le `doseId` est un UUID v4 opaque généré côté client : il sert **uniquement** de clé de déduplication (Redis TTL 10 min côté relais) pour empêcher un double push quand le ping est retransmis après reconnexion. Le relais ne peut pas remonter du `doseId` au contenu de la dose — il n'a pas accès au document Automerge.

À la réception du ping, le relais :
1. Valide la structure (Zod, schéma strict).
2. Vérifie l'autorisation : le `senderDeviceId` du JWT doit appartenir au `householdId` du JWT (déjà le cas par construction — le JWT d'accès est signé par `auth.ts` avec `{sub, deviceId, householdId}` cohérents).
3. Applique un rate-limit Redis par device (ex. 60 pings/min) pour empêcher un device compromis de spammer les autres aidants.
4. Vérifie la déduplication Redis : si `peer_ping:<householdId>:<doseId>` existe déjà (TTL 10 min), le ping est ignoré silencieusement (ACK idempotent, pas d'erreur).
5. Lookup les `pushTokens` + `accountId` des autres devices du foyer (`householdId = JWT.householdId AND deviceId != JWT.deviceId`).
6. Appelle `dispatchPush(expo, targets, logger, {type: 'peer_dose_recorded', prefsStore}, {type: 'peer_dose_recorded', quietStore, now})` — les filtres préférences (KIN-080) et quiet hours (KIN-081) sont appliqués naturellement par le dispatcher existant.

**Avantages** :
- **Zero-knowledge préservé** : le relais voit uniquement une métadonnée de routage (`pingType = 'dose_recorded'`), comparable à « ce foyer vient de faire une saisie dont la typologie est une prise ». Ce n'est pas une donnée santé au sens du PRD §4 ou de la Loi 25 : aucun identifiant patient, aucun nom de pompe, aucun type de dose (fond/secours), aucune dose administrée, aucune circonstance, aucun symptôme, aucun horodatage de prise. Le `doseId` est un UUID opaque non corrélable à d'autres identifiants que via le document Automerge (auquel le relais n'a pas accès).
- **Filtrage granulaire fonctionnel** : le type `peer_dose_recorded` est connu au dispatch, donc les préférences utilisateur (E5-S07) et quiet hours (E5-S08) sont appliquées comme attendu.
- **Pas de sur-notification** : seul le client qui enregistre une vraie `DoseAdministered` émet un ping. Les autres mutations Automerge (`PlanUpdated`, `CaregiverInvited`, etc.) n'en émettent pas, préservant le quota anti-spam RM9 et l'UX.
- **Idempotence cross-device et cross-reconnexion** : la clé Redis `peer_ping:<householdId>:<doseId>` dédoublonne les pings retransmis après réouverture de WS. Si le device perd le réseau après avoir émis un ping non ack'é et réouvre sa WS, le ping peut être retransmis sans risque de double push.
- **Authz robuste** : le relais ne fait **pas confiance** aux champs `householdId` / `senderDeviceId` envoyés par le client dans le corps du message — il utilise exclusivement ceux du JWT vérifié au handshake. Impossible pour un aidant compromis de cibler un autre foyer.
- **Cohérent avec les patterns existants** : même couche que les blobs chiffrés (WS typé), même dispatcher que `missed_dose` (KIN-079) et `reminder`, même infrastructure Redis pub/sub.
- **Extensible** : la structure `{type: 'peer_ping', pingType: ...}` admet `pingType ∈ {'dose_recorded', 'pump_low', 'plan_updated', ...}` sans changement de contrat — le relais filtre en whitelist les types qu'il sait router.

**Inconvénients** :
- Le relais apprend qu'une prise a été enregistrée dans un foyer à l'instant `sentAtMs`. C'est une fuite d'information de faible sensibilité (l'activité réseau du foyer la rend déjà inférable — corrélation de volume de blobs mailbox), mais non-nulle. Aucun horodatage de prise (`administeredAtUtc`) ne fuite néanmoins — seul l'instant d'émission du ping.
- Un `doseId` UUID v4 transite en clair côté relais. Il n'est pas corrélable hors document Automerge, mais il constitue un identifiant opaque stable auquel le relais a accès pendant 10 min (TTL dédup). Mitigation : le `doseId` est un pur UUID aléatoire, sans dérivation d'un secret partagé, et son usage côté relais se limite à une clé Redis éphémère non réversible.
- Coût d'un message WS additionnel par prise. Négligeable (< 200 octets) vu la fréquence attendue (quelques prises par jour par foyer).

**Risques** :
- Si un device compromis émet des pings frauduleux à haut débit pour spammer les autres aidants ou contourner le quota anti-spam RM9 : rate-limit Redis par `deviceId` (60 pings/min) + dédup par `doseId` + la politique anti-spam côté `dispatchPush` restent en ligne de défense.
- Si un attaquant passif sur le lien TLS enregistre les pings : il apprend qu'une prise a eu lieu à l'instant T dans un foyer identifié par son `householdId`. C'est déjà inférable du trafic sync (cf. ADR-D9 : `mailboxId = householdId` en clair côté relais jusqu'à MLS). Aucune aggravation.

### Option B — Fan-out aveugle côté backend (rejetée)

**Description** : Supprimer le ping explicite. Le relais déclenche un push générique à tous les autres aidants du foyer à **chaque** changement Automerge reçu (ce qui correspond à la boucle actuelle de `relay.ts`). Le type de notification au dispatcher est laissé `undefined` ou codé en dur à `peer_dose_recorded`.

**Avantages** :
- Zéro code à ajouter côté client.
- Aucune fuite de métadonnée typée au relais : le relais reçoit juste des blobs et fan-out des pushes.

**Inconvénients rédhibitoires** :
- Tout changement Automerge déclenche un push, même les plus anodins (édition de préférence locale, rotation de clé, ack technique). Le taux de notif est surestimé d'un facteur ~5-10× et sature le quota anti-spam RM9.
- Les préférences granulaires E5-S07 ne peuvent pas être appliquées **correctement** : si le backend code en dur `peer_dose_recorded`, alors toute mutation (y compris un `plan_updated`) déclenche un push typé `peer_dose_recorded` — violation de l'intention utilisateur qui a désactivé cette typologie précisément. Si le backend laisse `undefined`, aucune préférence n'est appliquée — violation inverse.
- Aucune extensibilité vers d'autres types de pings (`pump_low` qui arrivera en E5-S11 / KIN-083) sans un protocole explicite.

**Risques** :
- UX dégradée : les aidants reçoivent trop de notifications, désactivent en masse les préférences, perdent confiance dans le canal.
- Régression directe sur E5-S07 / E5-S08 livrés en KIN-080 / KIN-081.

### Option C — Déchiffrement partiel côté relais (rejetée)

**Description** : Introduire un second canal chiffré « métadonnées » (une sous-clé dérivée de la `groupKey`) accessible au relais pour lui permettre de lire le **type** d'événement Automerge sans le contenu. Le relais déchiffre uniquement le tag de type (`DoseAdministered`, `PlanUpdated`, etc.) et route le push en conséquence.

**Avantages** :
- Le client n'émet plus de message explicite : tout est inféré du flux de sync.

**Inconvénients rédhibitoires** :
- **Violation directe du zero-knowledge** : le relais détient un matériel cryptographique capable de déchiffrer une partie du contenu — dès lors, la promesse « même Kamez ne peut pas lire les données de votre enfant » devient conditionnelle et fragile. Viol d'un principe non négociable du projet (CLAUDE.md §Principes non négociables §1).
- Complexité crypto significative : dérivation de sous-clé, ségrégation des AEAD, audit externe obligatoire.
- Rupture de l'isolation stricte : un bug de dérivation de sous-clé pourrait exposer la clé principale.

**Risques** :
- Incident P0 de confiance si la conception est mal auditée.
- Rétrocompatibilité MLS (ADR-D3) compromise : MLS n'expose pas nativement ce type de canal métadonnées chiffré.

## Critères de décision

1. **Conformité zero-knowledge** : aucune donnée santé en clair ou déchiffrable par le relais. La métadonnée `pingType = 'dose_recorded'` est acceptable car elle n'identifie aucun patient, aucune substance, aucune dose, aucun moment de prise effectif.
2. **Application correcte des filtrages utilisateur** : E5-S07 (préférences) et E5-S08 (quiet hours) doivent être respectés sur tout push peer.
3. **Pas de sur-notification** : seules les mutations Automerge pertinentes (création de `DoseAdministered`) déclenchent un push.
4. **Idempotence** : robuste aux reconnexions WS et aux retransmissions.
5. **Extensibilité** : le contrat doit permettre d'ajouter d'autres types de pings (ex. `pump_low` local, signal de révocation) sans breaking change.
6. **Simplicité d'audit** : la surface de code nouvelle reste petite et inspectable.

## Décision

**Choix retenu : Option A — Ping WS explicite `peer_ping` + `pingType = 'dose_recorded'`, sans aucune donnée santé, avec authz JWT, rate-limit Redis et dédup TTL 10 min**.

Le compromis accepté — exposer au relais qu'une prise a été enregistrée à l'instant T sans révéler quel patient, quelle pompe, quelle dose, quand la prise a eu lieu — est proportionné au gain : RM5 + RM16 tenues, E5-S07 et E5-S08 respectées, UX préservée. La métadonnée visible par le relais (`pingType`) n'identifie aucune donnée santé au sens du PRD §4 et n'aggrave pas la surface d'attaque au-delà de la corrélation de trafic déjà inférable (ADR-D9).

Le ping doit être retiré si l'une des conditions suivantes est observée :
1. Un auditeur crypto externe classe `pingType = 'dose_recorded'` comme donnée santé régulée.
2. Une exigence Loi 25 ou RGPD incompatible émerge après bascule MLS.
3. Un mécanisme alternatif zero-knowledge (ex. notifications signées par tag opaque au niveau MLS) devient disponible à coût équivalent.

## Conséquences

**Positives** :
- RM5 livrable selon les AC de E5-S05 (notif peer < 5 s en ligne, délivrance différée en hors-ligne, idempotence).
- Filtrage préférences + quiet hours naturellement appliqué.
- Pas de régression sur RM16 : payload push strictement opaque.
- Extensible à `pump_low`, `dispute_detected` etc. sans breaking change.
- Surface de code nouvelle minimale (~150 lignes côté relais + ~100 lignes côté client).

**Négatives / dette acceptée** :
- Le relais apprend qu'une prise a été enregistrée à l'instant T dans un foyer (métadonnée de type non-santé). Corrélation déjà partiellement inférable du trafic de sync — aucune aggravation matérielle.
- Un `doseId` UUID v4 transite en clair côté relais, conservé 10 min en Redis pour la dédup. Non réversible vers le contenu du document.
- Petit coût réseau additionnel (~200 octets par prise enregistrée).

**Plan d'implémentation** :
- Côté `packages/sync/src/client/` : nouveau hook `usePeerDosePing` observant les nouveaux `DoseAdministered` émis par ce device (filtre par `deviceId`), émission d'un `peer_ping` via un nouveau canal du `RelayClient`, déduplication locale par `doseId`.
- Côté `packages/sync/src/events/types.ts` : nouveau type `PeerPingMessage` partagé client ↔ relais.
- Côté `apps/api/src/routes/relay.ts` : handler de message entrant `peer_ping`, lookup des devices + dispatch push typé `peer_dose_recorded` + déduplication Redis.
- Côté `apps/api/src/push/push-dispatch.ts` : inchangé (signature déjà prête, KIN-080 et KIN-081 ont posé le filtrage).
- Côté `apps/{web,mobile}/src/lib/sync/` : branchement du hook `usePeerDosePing` via `RelaySyncBootstrap`.
- Côté `packages/i18n/src/locales/{fr,en}/common.json` : chaînes UI génériques pour un futur centre de notifs in-app (scoping minimal pour ce ticket — reformulation libre sans donnée santé).

**Points à tracer (follow-ups)** :
- KIN-082 ne livre pas de centre de notifs in-app. Les chaînes i18n pour les toasts in-app sont ajoutées en préparation (E5-S12) mais non consommées par ce ticket.
- Rate-limit Redis par device : seuil initial 60 pings/min → ajuster après retour de prod.
- Observabilité : compteur pseudonymisé `peer_ping.received` / `peer_ping.deduped` / `peer_ping.dispatched` à brancher dans un ticket suivi (infra Sentry / CloudWatch).
- Support natif dans MLS : lors de la bascule (ADR-D9 plan de migration), vérifier si MLS propose un mécanisme de signalement typé non-contenu qui remplacerait l'actuel `peer_ping` (ex. message d'application marqué `kind=notification` non persisté).

## Statut futur

ADR **Accepté** pour la v1.0. Revue prévue après la bascule MLS (ADR-D3 / plan de migration ADR-D9) : si MLS expose nativement un canal de signalement typé, l'Option A pourra être simplifiée (réutiliser le canal MLS plutôt qu'un message WS dédié). En l'absence de tel canal, la décision reste valide au-delà de la v1.0.

## Révision prévue

Revue obligatoire lors du passage du PoC MLS au déploiement production (Sprint 7-8, plan ADR-D9). Revue anticipée si un incident observable implique le `peer_ping` (fuite de `doseId`, abus de spam, régression de filtrage).
