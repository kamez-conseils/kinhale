# Spécifications fonctionnelles — Kinhale v1.0

> **Document de spécifications fonctionnelles**
> Version : 0.1.0 — Date : 2026-04-19
> Licence : AGPL v3
> Description courte : modèle de données logique, règles métier (RM1-RM28), workflows (W1-W12), contrats API, exigences non fonctionnelles et critères d'acceptation de la v1.0 de Kinhale.

---

## 1. Introduction & portée

### 1.1. Rappel du périmètre v1.0

Kinhale v1.0 est une application **multi-plateformes (web PWA + iOS + Android)**, **open source (AGPL v3)**, hébergée au Canada (ca-central-1). Elle permet à plusieurs aidants d'un même enfant asthmatique de **coordonner, tracer et partager en temps réel** les prises de pompes de fond et de secours, de recevoir des **rappels fiables**, de détecter les **doses manquées**, de surveiller le **niveau des pompes**, et de générer un **rapport médical exportable** (PDF + CSV).

La v1.0 est strictement positionnée comme un **outil de journal + rappel + partage**, **jamais un dispositif médical**. L'application **ne recommande jamais de dose**, **ne diagnostique jamais**, **ne propose jamais d'action thérapeutique**. Ce principe structure l'ensemble du document.

Caractéristiques v1.0 :
- **1 enfant par foyer** (la fratrie arrive en v1.1).
- **Pas d'intégration Apple HealthKit / Google Health Connect** (reporté en v2.0).
- **Pas de portail pro médecin** (reporté en v2.0).
- **Pas de monétisation** (open source + instance gratuite).
- **Hors-ligne complet** (saisie + lecture 30 derniers jours + sync différée).
- **Temps réel multi-aidants** (propagation < 5 s en ligne).
- **FR + EN** à la sortie, structure prête pour ES / DE en v1.1+.

### 1.2. Hors-périmètre explicite v1.0

Ne font **pas partie** de la v1.0 (garde-fous, à rouvrir uniquement par décision produit explicite) :
- Recommandation ou calcul de dose.
- Diagnostic, alerte de crise, score de contrôle auto-généré.
- Messagerie bidirectionnelle avec un professionnel de santé.
- Téléconsultation, prise de rendez-vous médicale.
- Intégration avec pompe connectée (capteurs IoT).
- Stockage d'ordonnances scannées, bilans sanguins, radiographies.
- IA prédictive de risque d'exacerbation.
- Multi-enfants (fratrie) — repoussé à v1.1.
- Portail pro pneumo-pédiatre — repoussé à v2.0.
- Intégration Apple Health / Health Connect — repoussée à v2.0.
- Paiement, abonnement, facturation.
- Support client en direct (chat, téléphone).

### 1.3. Glossaire

| Terme | Définition |
|---|---|
| **Foyer** | Unité logique regroupant un enfant, ses aidants et toutes les données associées (pompes, prises, plans, rapports). Une instance Kinhale héberge N foyers isolés les uns des autres. |
| **Aidant** | Toute personne habilitée à saisir / consulter des prises pour l'enfant du foyer (parent, grand-parent, éducatrice de garderie, nounou). |
| **Parent référent (Admin)** | Aidant ayant créé le foyer (ou désigné par l'Admin sortant) ; il a tous les droits administratifs. |
| **Contributeur** | Aidant avec compte complet qui peut saisir et consulter l'historique. |
| **Contributeur restreint** | Aidant connecté via QR + PIN (sans compte personnel), session 8 h, saisie uniquement + dernière prise visible. |
| **Pompe (ou inhalateur)** | Dispositif médical prescrit à l'enfant, de type **fond** (traitement quotidien préventif) ou **secours** (en crise). Chaque pompe porte un nombre fini de doses. |
| **Prise de fond** | Administration planifiée d'une pompe de fond à un créneau cible (matin / soir typiquement). |
| **Prise de secours** | Administration ponctuelle d'une pompe de secours en réaction à des symptômes ou des circonstances (effort, allergène…). Jamais planifiée. |
| **Plan de traitement** | Prescription médicale transcrite par l'Admin : quelle pompe, fréquence, heures cibles, date de début, date de fin éventuelle. |
| **Rappel** | Événement système programmé par un plan, qui génère une notification push à l'heure cible. |
| **Dose manquée** | Prise de fond planifiée dont la fenêtre de confirmation s'est fermée sans qu'aucun aidant l'ait confirmée ni rattrapée. |
| **Rattrapage** | Saisie différée d'une prise déjà administrée mais non enregistrée à l'heure. |
| **Fenêtre de confirmation** | Plage autour de l'heure cible (par défaut ±30 min) dans laquelle la prise est considérée « à l'heure ». |
| **RPRP** | Responsable de la Protection des Renseignements Personnels (Loi 25). |
| **DPIA / ÉFVP** | Évaluation des Facteurs relatifs à la Vie Privée (équivalent RGPD). |
| **Audit trail** | Journal horodaté de tous les accès, modifications et exports sur données sensibles. |

---

## 2. Acteurs du système

### 2.1. Parent référent (Admin)

- **Rôle** : crée le foyer, déclare l'enfant, gère les pompes et plans de traitement, invite et révoque les aidants, exporte les rapports, gère la conformité (consentement, suppression).
- **Droits** : tous (CRUD sur foyer, enfant, pompes, plans, prises, aidants ; lecture audit trail ; export / suppression).
- **Parcours-clés** : W1 onboarding, W5 invitation aidant, W7 remplacement pompe, W9 export rapport, W10 suppression, W11 transfert admin.
- **Contraintes** : un foyer doit avoir **au moins 1 Admin** à tout moment (RM1).

### 2.2. Aidant contributeur

- **Rôle** : co-parent, grand-parent, tout aidant familial avec compte complet.
- **Droits** : saisie de prises (fond, secours, rattrapage), lecture complète de l'historique, consultation du plan de traitement, consultation des pompes, réception de rappels et notifications croisées, paramétrage de ses propres préférences de notifications.
- **Non-droits** : ne peut pas inviter / révoquer d'autres aidants, modifier le plan, ajouter une pompe, exporter un rapport, supprimer le foyer.
- **Parcours-clés** : W2, W3, W4, W8.

### 2.3. Aidant contributeur restreint (garderie / nounou)

- **Rôle** : administrer une prise dans un contexte pro, sans compte perso.
- **Droits** : uniquement la saisie d'une prise (fond ou secours, avec symptômes / circonstances), consultation de **la dernière prise uniquement** (pour éviter un doublon), lecture du nom et prénom de l'enfant + photo optionnelle.
- **Non-droits** : pas d'historique complet, pas de consultation des autres aidants, pas de rappel personnel, pas de symptôme lié à d'autres enfants.
- **Authentification** : QR code + PIN 6 chiffres, session 8 h, sur un appareil partagé (mode kiosque).
- **Parcours-clés** : W6 onboarding aidant restreint.

### 2.4. Système (tâches automatiques)

Acteur non humain, représente le backend et les workers qui exécutent :
- Programmation et envoi des **rappels** de prise (push + local + e-mail fallback).
- Détection et signalement des **doses manquées** après fermeture de la fenêtre + délai de grâce.
- Calcul du **niveau restant** des pompes et envoi de l'**alerte fin de pompe**.
- **Purge** automatique des comptes supprimés (après 30 jours).
- **Régénération** du rapport PDF à la demande.
- **Nettoyage** des invitations expirées / consommées.
- **Synchronisation** (push temps réel WebSocket + réconciliation des files hors-ligne).

### 2.5. Médecin (destinataire indirect)

- **Rôle** : consomme le **rapport PDF / CSV** remis ou envoyé par le parent lors d'une consultation. Non-utilisateur direct de l'app en v1.
- **Droits** : aucun dans le système (pas de compte). Sa seule interface est le document exporté.
- **Exigence produit** : le document doit être **lisible en 30 s** (1-2 pages max), **fidèle au journal** (pas de reco auto).

---

## 3. Modèle de données (logique)

> Niveau logique uniquement. Le modèle physique (SQL, index, partitionnement) est détaillé en annexe technique.

### 3.1. Entité `Utilisateur`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | Clé primaire opaque. |
| `email` | String, unique | Normalisé lowercase. Obligatoire pour Admin et Contributeur, non utilisé pour Contributeur restreint. |
| `auth_method` | Enum | `magic_link` \| `passkey` \| `oauth_apple` \| `oauth_google`. |
| `password_hash` | String, nullable | Non utilisé en v1 (magic link / passkey). Réservé pour v2. |
| `mfa_enabled` | Bool | TOTP optionnelle (recommandée pour Admin). |
| `preferred_language` | Enum | `fr` \| `en`. |
| `timezone` | String | IANA (ex : `America/Montreal`). |
| `consent_version_accepted` | String | Hash SHA-256 de la version CGU + PC acceptée. |
| `consent_accepted_at` | Timestamp | ISO 8601 UTC. |
| `created_at`, `updated_at`, `deleted_at` | Timestamp | Soft delete pour l'audit. |

**Contraintes** : un utilisateur peut appartenir à 0..N foyers via `Aidant`. Unicité `email` à l'échelle globale de l'instance.

### 3.2. Entité `Foyer`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | Clé opaque, utilisée dans tous les filtres multi-tenant. |
| `name` | String | Nom donné par l'Admin (ex : « Famille Tremblay »). |
| `timezone` | String | IANA, hérité du fuseau de l'Admin à la création, modifiable. |
| `language` | Enum | `fr` \| `en`. |
| `confirmation_window_minutes` | Int | Défaut 30. Configurable par l'Admin (cf. RM2). |
| `pump_alert_threshold_doses` | Int | Défaut 20. Configurable (cf. RM7). |
| `created_by_user_id` | UUID | FK `Utilisateur`. |
| `rprp_user_id` | UUID | FK vers l'utilisateur Admin désigné comme RPRP local du foyer (défaut = créateur). |
| `created_at`, `updated_at`, `deleted_at` | Timestamp | Soft delete. |

**Cardinalité** : `Foyer` 1 ↔ 1 `Enfant` en v1.0 (contrainte produit). `Foyer` 1 ↔ N `Pompe`, N `Aidant`, N `Plan`, N `Prise`, N `Rapport`.

### 3.3. Entité `Enfant`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `household_id` | UUID | FK `Foyer`, unique en v1.0 (1:1). |
| `first_name` | String chiffré | Prénom en clair uniquement côté applicatif. |
| `year_of_birth` | Int | **Pas de date complète** (minimisation Loi 25). Juste l'année. |
| `medical_notes` | Text chiffré, nullable | Champ libre court (allergies connues, autre pathologie). Non-médical par conception. |
| `photo_url` | String, nullable | Optionnelle, hébergée sur S3 Canada, chiffrée. |
| `pathology` | Enum | `asthma` en v1 ; `asthma_plus_other` préparé v2 (jamais coté produit). |
| `created_at`, `updated_at` | Timestamp | |

### 3.4. Entité `Pompe` (Inhalateur)

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `child_id` | UUID | FK `Enfant`. |
| `commercial_name` | String | Ex : « Flovent HFA 125 µg ». Saisi par l'Admin. |
| `type` | Enum | `maintenance` (fond) \| `rescue` (secours). |
| `active_substance` | String, nullable | Corticostéroïde, bronchodilatateur, etc. Informatif, jamais utilisé pour calcul. |
| `dose_per_puff_mcg` | Int, nullable | Informatif (apparaît sur le rapport). |
| `total_doses_initial` | Int | Nombre total d'inhalations à neuf. Saisi par l'Admin. |
| `doses_remaining` | Int | Décrémenté à chaque prise (RM7). |
| `expiration_date` | Date, nullable | Optionnel, déclenche un avertissement à 30 j. |
| `status` | Enum | `active` \| `replaced` \| `expired` \| `empty`. |
| `replaced_at` | Timestamp, nullable | Trace du remplacement. |
| `replacement_pump_id` | UUID, nullable | Auto-chaînage à la pompe qui l'a remplacée. |
| `created_at`, `updated_at` | Timestamp | |

### 3.5. Entité `Plan de traitement`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `child_id` | UUID | FK. |
| `pump_id` | UUID | FK (doit être une pompe de type `maintenance`). |
| `frequency` | Enum | `daily_once` \| `daily_twice` \| `daily_custom` \| `as_needed`. |
| `target_times` | JSON liste de `HH:mm` locales | Ex : `["08:00", "20:00"]`. |
| `doses_per_target` | Int | Ex : 1 ou 2 inhalations par prise. |
| `start_date` | Date | |
| `end_date` | Date, nullable | Si vide : plan en cours. |
| `created_by_user_id` | UUID | FK `Utilisateur` (doit être Admin). |
| `status` | Enum | `active` \| `paused` \| `completed` \| `cancelled`. |
| `created_at`, `updated_at` | Timestamp | |

**Contraintes** : au plus **un plan `active` par pompe de fond** à un instant T. Pas de plan pour pompe de secours (RM3).

### 3.6. Entité `Prise administrée` (cœur du modèle)

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | Généré **côté client** à la saisie (pour idempotence offline). |
| `client_event_id` | UUID | Identique à `id`, exposé via header `Idempotency-Key`. |
| `household_id` | UUID | FK. |
| `child_id` | UUID | FK. |
| `pump_id` | UUID | FK. |
| `plan_id` | UUID, nullable | FK vers le plan si prise planifiée, sinon null. |
| `caregiver_user_id` | UUID, nullable | FK `Utilisateur` si compte. Null si Contributeur restreint. |
| `caregiver_restricted_session_id` | UUID, nullable | FK vers la session QR+PIN si restreint. |
| `caregiver_display_name` | String | Nom affiché dans les notifications (sécurité d'affichage). |
| `type` | Enum | `maintenance_planned` \| `maintenance_unplanned` \| `rescue`. |
| `administered_at_local` | Timestamp | Date/heure de prise réelle, en local utilisateur. |
| `administered_at_utc` | Timestamp | UTC côté serveur (autoritaire pour l'ordre). |
| `recorded_at_utc` | Timestamp | Quand l'événement est parvenu au serveur (sync). |
| `doses_administered` | Int | Défaut 1. |
| `symptoms` | JSON liste d'enum | Obligatoire pour `rescue`, grille pré-définie (toux, sifflement, essoufflement, réveil nocturne, gêne thoracique, autre). |
| `circumstances` | JSON liste d'enum + tag libre | Obligatoire pour `rescue` si aucun symptôme ; pré-sélection (effort, allergène, infection, nuit, fumée, autre) + champ libre optionnel <500 car. |
| `free_text_note` | Text chiffré, nullable | Commentaire libre optionnel, jamais requis. |
| `source` | Enum | `manual_entry` \| `reminder_confirmation` \| `backfill` \| `sync_replay`. |
| `geolocation` | JSON {lat, lon}, nullable | **Opt-in strict**, jamais par défaut. |
| `is_disputed` | Bool | True si détection de double saisie (RM6), en attente de résolution. |
| `dispute_resolved_at` | Timestamp, nullable | |
| `status` | Enum | `confirmed` \| `voided` (annulation explicite) \| `pending_review` (double saisie en cours). |
| `created_at`, `updated_at` | Timestamp | |

**Principe fondateur** : une prise n'est **jamais physiquement supprimée**. L'annulation passe par un changement de `status` à `voided` avec un `voided_reason` et un `voided_by_user_id`. Garantie d'intégrité pour l'audit médical.

### 3.7. Entité `Rappel`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `plan_id` | UUID | FK `Plan`. |
| `target_at_utc` | Timestamp | Moment où le rappel doit partir. |
| `window_start_utc`, `window_end_utc` | Timestamp | Fenêtre de confirmation ±N min autour de la cible. |
| `status` | Enum | `scheduled` \| `sent` \| `confirmed` \| `missed` \| `snoozed` \| `cancelled`. |
| `confirmed_by_dose_id` | UUID, nullable | Si confirmé, FK vers la `Prise` associée. |
| `last_state_change_at` | Timestamp | |
| `created_at`, `updated_at` | Timestamp | |

### 3.8. Entité `Aidant` (adhésion d'un utilisateur à un foyer)

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `user_id` | UUID, nullable | FK `Utilisateur` (null si Contributeur restreint). |
| `household_id` | UUID | FK `Foyer`. |
| `role` | Enum | `admin` \| `contributor` \| `restricted_contributor`. |
| `invited_at`, `accepted_at`, `revoked_at` | Timestamp | |
| `permissions_overrides` | JSON | Granularité fine (ex : désactivation de certaines notifications). |
| `display_name` | String | Affichage foyer (ex : « Maman », « Garderie CPE Soleil »). |
| `created_at`, `updated_at` | Timestamp | |

**Contraintes** : un `user_id` apparaît au plus une fois par `household_id` (unique composite). Un `role = restricted_contributor` impose `user_id = null`.

### 3.9. Entité `Invitation aidant`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `household_id` | UUID | FK. |
| `target_role` | Enum | `contributor` \| `restricted_contributor`. |
| `invite_code` | String opaque | Token aléatoire 256 bits. |
| `qr_payload` | String | Encodage compact du code pour QR. |
| `pin` | String (6 chiffres) | Hash stocké, jamais en clair. |
| `channel` | Enum | `email` \| `sms` \| `link_share` \| `qr_physical`. |
| `max_uses` | Int | Défaut 1. Cas tablette garderie : peut être >1 mais sous supervision Admin. |
| `uses_count` | Int | |
| `expires_at` | Timestamp | Défaut +7 jours pour compte, +48 h pour restreint. |
| `created_by_user_id` | UUID | FK. |
| `consumed_by_user_id` | UUID, nullable | Pour invitation Contributeur complet. |
| `status` | Enum | `active` \| `consumed` \| `expired` \| `revoked`. |
| `created_at`, `updated_at` | Timestamp | |

### 3.10. Entité `Notification`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `recipient_user_id` | UUID | FK. |
| `household_id` | UUID | FK. |
| `type` | Enum | `reminder` \| `missed_dose` \| `peer_dose_recorded` \| `pump_low` \| `pump_expiring` \| `dispute_detected` \| `admin_handover` \| `consent_update_required` \| `security_alert`. |
| `payload` | JSON | **Aucune donnée santé en clair**, uniquement identifiants et timestamps. |
| `channel` | Enum | `push` \| `local` \| `email`. |
| `state` | Enum | `pending` \| `sent` \| `delivered` \| `read` \| `failed`. |
| `sent_at`, `delivered_at`, `read_at` | Timestamp, nullable | |
| `created_at`, `updated_at` | Timestamp | |

### 3.11. Entité `Événement de journal` (audit trail)

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `household_id` | UUID | FK. |
| `actor_user_id` | UUID, nullable | FK `Utilisateur`. Null si système. |
| `actor_type` | Enum | `user` \| `system` \| `restricted_session`. |
| `event_type` | Enum | `auth_login` \| `auth_logout` \| `dose_created` \| `dose_voided` \| `plan_created` \| `plan_modified` \| `invitation_sent` \| `invitation_accepted` \| `invitation_revoked` \| `report_generated` \| `report_downloaded` \| `data_exported` \| `account_deletion_requested` \| `account_deleted` \| `consent_updated`. |
| `target_type` | String | Ex : `dose`, `plan`, `household`. |
| `target_id` | UUID | |
| `payload` | JSON pseudonymisé | Jamais de donnée santé en clair. |
| `occurred_at` | Timestamp | |
| `source_ip_hash` | String | Haché (sel rotatif) pour la preuve sans fingerprinting. |

**Rétention** : 12 mois, accès exclusif RPRP, **non purgée** lors d'une suppression de compte (pseudonymisation à la place).

### 3.12. Entité `Rapport exporté`

| Attribut | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `household_id` | UUID | FK. |
| `child_id` | UUID | FK. |
| `date_range_start`, `date_range_end` | Date | |
| `format` | Enum | `pdf` \| `csv`. |
| `generated_at` | Timestamp | |
| `generated_by_user_id` | UUID | FK. |
| `intended_recipient` | Enum | `self` \| `physician` \| `caregiver`. |
| `file_sha256` | String | Signature intégrité (affichée en pied de PDF). |
| `file_storage_key` | String | Chemin S3 chiffré, expiration 7 jours après génération. |
| `downloaded_at` | Timestamp, nullable | |

---

## 4. Règles métier clés

Ces règles sont la référence pour la qualité et le backlog ; chacune doit être vérifiable par un test.

- **RM1 — Admin permanent** : un foyer a **au moins un Admin** en permanence. Si le dernier Admin demande à quitter ou supprime son compte, l'app propose (a) de promouvoir le plus ancien `contributor` en `admin`, (b) de supprimer le foyer. Impossible de « sortir » sans choisir une des deux.
- **RM2 — Fenêtre de confirmation** : une prise de fond planifiée est confirmable dans la fenêtre `[target - X, target + X]` (défaut X = 30 min, configurable par foyer, entre 10 et 120 min). Au-delà, le rappel passe à `missed` ; la prise reste rattrapable jusqu'à **24 h après la cible** avec le marqueur `source = backfill`.
- **RM3 — Pas de planification du secours** : une prise de type `rescue` n'est **jamais** liée à un `Plan`. Toute tentative de créer un plan sur une pompe de type `rescue` est refusée côté API et UI.
- **RM4 — Secours documenté** : une prise de type `rescue` exige **au moins** un symptôme OU une circonstance (ou un tag libre non vide). Sinon : refus côté API avec erreur 422 et explication à l'aidant.
- **RM5 — Notification croisée** : lorsqu'une prise (fond ou secours) est enregistrée par un aidant A, **tous les autres aidants actifs du foyer** reçoivent une notification informative dans les **5 secondes en ligne** (cible), ou dès que le réseau est disponible pour les clients hors-ligne.
- **RM6 — Détection de double saisie** : si deux prises du **même type** (fond ou secours) pour la **même pompe** sont enregistrées à **moins de 2 minutes d'écart** (en temps réel serveur), l'app marque les deux en `pending_review`, notifie les deux aidants et propose de **confirmer** ou **annuler (voided)** l'une des deux. Aucune prise n'est silencieusement supprimée.
- **RM7 — Décompte doses pompe** : à chaque prise `confirmed` sur une pompe, `doses_remaining -= doses_administered`. Quand `doses_remaining <= pump_alert_threshold_doses` (défaut 20 ou 20 %), une notification `pump_low` est envoyée à l'Admin. À `doses_remaining = 0`, le statut passe à `empty` et une notification urgente est envoyée.
- **RM8 — Rapport sans reco** : le rapport médecin inclut **toutes les prises `confirmed`** (voidées signalées séparément) sur la plage demandée + un graphique de fréquence secours/semaine + la liste des symptômes et circonstances. Il **n'inclut jamais** : recommandation de dose, interprétation, score de contrôle, diagnostic.
- **RM9 — Consentement** : l'acceptation des CGU + Politique de Confidentialité est **obligatoire** à la création de compte (case non pré-cochée, granulaire) **ET** à chaque changement majeur de version (bump mineur de hash ignoré, bump majeur bloque l'usage jusqu'à ré-acceptation).
- **RM10 — Suppression de compte / foyer** : la suppression déclenche (a) un e-mail contenant **l'archive de portabilité** (CSV + PDF des 12 derniers mois), (b) une purge complète sous **30 jours max** (délai technique pour backups rotatifs), (c) la **pseudonymisation** de l'historique d'audit (jamais purgé, conservé pour preuve).
- **RM11 — Multi-tenant strict** : toute requête backend filtre par `household_id` **à partir du token**, jamais d'un paramètre client. Test automatisé anti-IDOR au CI.
- **RM12 — Session Contributeur restreint** : valide **8 heures** max, **non renouvelable automatiquement**. Au renouvellement, PIN re-demandé. Admin peut révoquer la session à tout moment.
- **RM13 — Un seul enfant par foyer en v1.0** : toute tentative de créer un deuxième enfant renvoie une erreur 409 « feature_not_yet_available », avec lien vers le roadmap v1.1.
- **RM14 — Horodatage autoritaire** : l'ordre canonique des événements est celui de `administered_at_utc` côté serveur. En cas d'arrivée tardive (sync), le serveur conserve `administered_at_utc` local déclaré par le client, mais pose un `recorded_at_utc` de réception. Les notifications post-sync mentionnent explicitement les deux.
- **RM15 — Idempotence des saisies** : toute création de `Prise` via API est idempotente via header `Idempotency-Key` = `client_event_id`. Deux appels identiques renvoient la même réponse, jamais deux insertions.
- **RM16 — Jamais de donnée santé dans les push** : le payload APNs / FCM ne contient **que** `title` générique, `household_id` opaque et `notification_id`. Le contenu réel est récupéré via un appel authentifié à l'ouverture.
- **RM17 — Rattrapage borné** : une prise `backfill` peut être datée jusqu'à **24 h dans le passé**, jamais dans le futur. Saisie hors fenêtre exige une confirmation explicite « Je confirme cette prise à cette heure ».
- **RM18 — Annulation (voided)** : seul l'aidant ayant saisi la prise OU un Admin peut la voider, **dans les 30 minutes** suivant la saisie. Passé ce délai : l'Admin seul peut voider, avec `voided_reason` obligatoire. La prise voidée reste visible dans l'historique en gris barré.
- **RM19 — Expiration de pompe** : à 30 j de la date de péremption, notification `pump_expiring`. À échéance, statut `expired`, la pompe n'est plus sélectionnable pour une nouvelle prise (sauf si Admin force avec justification texte).
- **RM20 — Mode hors-ligne et lecture** : l'historique des **30 derniers jours** est consultable hors-ligne. Au-delà, nécessite connexion. Saisie hors-ligne **toujours possible** pour fond et secours.
- **RM21 — Limite anti-spam invitation** : un Admin ne peut créer **plus de 10 invitations actives** simultanément, pour éviter l'exploitation des liens. Erreur 429 au-delà.
- **RM22 — Consentement aidant à l'acceptation** : un aidant invité consent **pour ses propres données** (e-mail, rôle, horodatages de ses saisies) à l'acceptation de l'invitation. Mention explicite qu'il ne consent **pas** pour l'enfant (mandat implicite du parent).
- **RM23 — Opt-in géolocalisation** : la géoloc sur prise est désactivée par défaut et opt-in par aidant. Jamais activée pour Contributeur restreint.
- **RM24 — Intégrité rapport** : le PDF exporté contient en pied de page un hash SHA-256 du contenu + timestamp + nom du générateur, pour tracer les falsifications.
- **RM25 — Rappels bornés** : un rappel manqué déclenche **au plus 2 relances** (T+15 min push local, T+30 min e-mail). Au-delà : `missed`, plus de relance automatique.
- **RM26 — Regroupement notifications peer** : si un aidant enregistre **plusieurs prises** dans une heure, les autres aidants reçoivent **une seule notification regroupée** (« 3 prises enregistrées par [Aidant] dans la dernière heure »).
- **RM27 — Disclaimer omniprésent** : la mention « *Kinhale est un outil de suivi et de coordination. Il ne remplace pas un avis médical.* » apparaît (a) à l'onboarding, (b) dans les CGU, (c) en pied de chaque rapport exporté, (d) dans les paramètres « À propos ».
- **RM28 — Purge des invitations expirées** : tâche nocturne système nettoie les invitations `expired` depuis plus de 30 j et les invitations `consumed` depuis plus de 90 j.

---

## 5. Workflows détaillés

> Format : **Précondition → Étapes → Post-condition → Cas d'erreur → Impact notifications**.

### W1 — Onboarding parent référent

- **Précondition** : utilisateur sans compte, ouvre l'app ou le site.
- **Étapes** :
  1. Écran d'accueil : CTA *« Commencer »* + lien *« Continuer en mode invité »* (mode local).
  2. Saisie e-mail → envoi magic link (ou OAuth Apple/Google). Vérification e-mail par clic sur le lien.
  3. Création utilisateur avec langue + fuseau détectés, CGU + PC à accepter (RM9).
  4. Création foyer : nom (pré-rempli « Famille de [prénom] »), confirmation fuseau.
  5. Ajout enfant : prénom, année de naissance, photo optionnelle (minimisation, pas de date complète).
  6. Ajout première pompe de fond : nom commercial, doses totales, optionnellement substance/dosage/péremption.
  7. Création du premier plan de traitement : fréquence (par défaut `daily_twice` 08:00 / 20:00), doses par prise (défaut 1).
  8. Ajout optionnel de la pompe de secours (peut être passé).
  9. Écran final : CTA *« Inviter un autre aidant »* (menu vers W5) ou *« Commencer »*.
- **Post-condition** : foyer créé, 1 enfant, 1 pompe de fond, 1 plan actif, 0 prise, 0 aidant secondaire, consentement horodaté.
- **Cas d'erreur** : e-mail déjà utilisé → redirection login. Magic link expiré → renvoi. Perte de connexion entre étape 5 et 7 → reprise à l'étape suivante (état persisté).
- **Notifications** : aucune push à ce stade (pas de rappel actif tant que l'utilisateur n'a pas quitté l'onboarding).

### W2 — Saisie d'une prise planifiée (fond)

- **Précondition** : foyer actif, plan actif, aidant connecté.
- **Étapes** :
  1. Aidant arrive sur la home (E1) : carte « Prochaine prise : 20:00 — pompe Flovent ». CTA dominant *« J'ai donné la pompe »*.
  2. Tap → pop-up de confirmation minimal (3 s avec undo) : « Prise enregistrée à 19:47. Annuler ? ».
  3. Si fenêtre respectée (`|now - target| <= X min`) : `type = maintenance_planned`, rappel associé passe à `confirmed`.
  4. Si hors fenêtre : prompt « Rattrapage ? » → confirmation explicite (RM17) → `type = maintenance_unplanned`, `source = backfill`.
  5. Décrément `doses_remaining` (RM7). Alerte `pump_low` si seuil atteint.
  6. Propagation WebSocket aux autres aidants du foyer (RM5).
- **Post-condition** : 1 `Prise` confirmée, rappel associé mis à jour, doses décomptées.
- **Cas d'erreur** :
  - Mode hors-ligne : événement ajouté à la file, affiché avec badge « en attente de sync ». Sync au retour réseau (W8).
  - Double saisie détectée (RM6) : les deux prises passent `pending_review`, W4 bis.
  - Pompe `expired` ou `empty` : saisie refusée, prompt « remplacer la pompe » (W7).
- **Notifications** : RM5 aux autres aidants sous 5 s (en ligne).

### W3 — Saisie d'une prise de secours avec symptômes

- **Précondition** : foyer actif, pompe de secours déclarée.
- **Étapes** :
  1. Home (E1) : bouton rouge *« Pompe de secours »*.
  2. Écran symptômes (E3) : grille tactile (toux, sifflement, essoufflement, réveil nocturne, gêne thoracique, autre). Multi-sélection.
  3. Écran circonstances : pré-sélection (effort, allergène, infection, nuit, fumée, autre) + champ texte libre ≤ 500 car.
  4. Validation → RM4 : au moins 1 symptôme OU 1 circonstance obligatoire. Sinon bloqué avec message sobre.
  5. Confirmation saisie, décrément doses (RM7).
  6. Propagation (RM5).
- **Post-condition** : 1 `Prise` de type `rescue` avec symptômes et/ou circonstances.
- **Cas d'erreur** : validation vide (rejet), hors-ligne (file d'attente), pompe expirée (refus).
- **Notifications** : RM5 aux autres aidants + éventuelle surcharge (plusieurs secours dans 24 h → aucune alerte auto, le médecin voit via le rapport, RM produit : **jamais d'alerte santé auto-générée**).

### W4 — Gestion d'une dose manquée

- **Précondition** : plan actif, rappel `scheduled`.
- **Étapes** :
  1. T-0 = heure cible : push envoyé à tous les aidants de type `reminder`.
  2. Fin de fenêtre (T + X min, défaut 30) : aucun aidant n'a confirmé → rappel passe à `missed`.
  3. Notification `missed_dose` envoyée (push + local + e-mail fallback après 30 min supplémentaires, RM25).
  4. L'aidant peut répondre : *« Je l'ai donnée à »* (picker heure jusqu'à 24 h arrière, W2 rattrapage) OU *« Non, oubliée »* (journalise la dose manquée explicite, visible en gris dans l'historique).
  5. Au-delà de 24 h sans action : statut final `missed`, visible dans le rapport médecin (indicateur d'observance).
- **Post-condition** : rappel en statut final (`confirmed` via rattrapage OU `missed`).
- **Cas d'erreur** : push non délivré → fallback local + e-mail (RM25).
- **Notifications** : 1 push à T-0, 1 push à T+X, 1 e-mail à T+X+30 min maximum.

### W5 — Invitation d'un aidant

- **Précondition** : Admin connecté, <10 invitations actives (RM21).
- **Étapes** :
  1. Admin ouvre E8 (Gestion aidants) → CTA *« Inviter »*.
  2. Choix du rôle : `contributor` ou `restricted_contributor`.
  3. Saisie du nom d'affichage (« Maman », « Garderie CPE Soleil »).
  4. Génération : `invite_code` + `qr_payload` + `pin` (6 chiffres aléatoires, jamais stocké en clair).
  5. Choix du canal : e-mail, SMS (futur), QR à afficher / imprimer, lien à copier.
  6. Envoi ou partage manuel.
  7. Aidant cible ouvre le lien → si `contributor` : création de compte (magic link + acceptation CGU + consentement propres données RM22) ; si `restricted_contributor` : W6.
  8. Matérialisation : ligne `Aidant` créée, invitation passe en `consumed`, notification à l'Admin.
- **Post-condition** : 1 aidant actif supplémentaire, invitation archivée.
- **Cas d'erreur** : expiration, PIN faux 3 fois → verrouillage invitation 15 min, quota d'invitations atteint, e-mail invalide.
- **Notifications** : push à l'Admin à chaque acceptation, audit log `invitation_accepted`.

### W6 — Onboarding aidant restreint sans compte

- **Précondition** : invitation `restricted_contributor` active, aidant reçoit lien + PIN.
- **Étapes** :
  1. Aidant ouvre l'app (ou la PWA) sur un appareil partagé.
  2. Scan QR OU clic lien → pré-remplit `invite_code`.
  3. Saisie PIN 6 chiffres.
  4. Backend valide, émet un token de session 8 h (RM12) lié à une `caregiver_restricted_session_id`.
  5. Écran épuré : prénom + photo (si opt-in) de l'enfant + 2 boutons géants (Fond / Secours).
  6. Saisie d'une prise = W2 ou W3 simplifiés (pas d'historique accessible).
  7. Session expirée : retour à l'écran PIN, pas de logout manuel nécessaire.
- **Post-condition** : session restreinte 8 h, saisies attribuées à `caregiver_display_name` + `caregiver_restricted_session_id`.
- **Cas d'erreur** : PIN faux 3 fois → verrouillage 15 min. Session expirée en pleine saisie → buffer local préservé, PIN à re-saisir.
- **Notifications** : aucune reçue (aidant restreint ne reçoit pas de push). Envoi RM5 normal aux autres.

### W7 — Alerte fin de pompe et remplacement

- **Précondition** : pompe `active`, `doses_remaining <= threshold`.
- **Étapes** :
  1. Système détecte seuil atteint → notification `pump_low` à l'Admin (et contributeurs si opt-in).
  2. Admin ouvre E7 (Pompes) → CTA *« Remplacer »*.
  3. Saisie de la nouvelle pompe (nom, doses totales, péremption) ; ancienne passe à `status = replaced`, `replaced_at = now`, `replacement_pump_id = nouvelle`.
  4. Plans actifs liés à l'ancienne pompe sont automatiquement migrés vers la nouvelle (même prescription).
- **Post-condition** : nouvelle pompe active, ancienne archivée (visible en historique), plans migrés.
- **Cas d'erreur** : remplacement sans nouvelle pompe saisie → refus. Péremption déjà passée à la saisie → avertissement.
- **Notifications** : confirmation de remplacement aux autres aidants.

### W8 — Synchronisation après mode hors-ligne

- **Précondition** : 1 à N événements en file locale, reconnexion réseau.
- **Étapes** :
  1. Détection retour réseau (web / mobile).
  2. Envoi batch (`POST /sync/batch`) avec tous les événements + `Idempotency-Key` par événement (RM15).
  3. Serveur : validation, ordonnancement par `administered_at_utc`, détection des conflits (double saisie RM6, édition simultanée d'une même prise).
  4. Réponse batch : par événement, statut `accepted` / `conflict` / `duplicate` / `rejected`.
  5. Client : mise à jour locale, affichage des conflits à l'aidant (liste interactive).
  6. Émission des notifications `peer_dose_recorded` (RM5) avec mention « synchronisée à [heure] » si décalage > 5 min.
- **Post-condition** : file locale vide, base serveur cohérente, conflits présentés à l'aidant.
- **Cas d'erreur** : 5xx backend → retry exponentiel (60s, 2min, 5min, 15min, 1h). Conflit non résolu → prise reste `pending_review` jusqu'à action Admin.
- **Notifications** : regroupement (RM26) si > 3 prises à la fois.

### W9 — Export rapport médecin

- **Précondition** : foyer actif, Admin connecté (recommandation v1 : Admin uniquement).
- **Étapes** :
  1. Aidant ouvre E10 (Export) → sélection plage (dernier mois / 3 mois / personnalisé).
  2. Bouton *« Générer PDF »* → serveur génère (< 5 s cible).
  3. Aperçu en ligne + CTA *« Télécharger »*, *« Envoyer par e-mail »*, *« Copier le lien signé »* (lien expire 7 j).
  4. Le CSV brut est également téléchargeable.
  5. Entrée `report_generated` dans audit trail + notification `report_generated` à tous les Admins.
- **Post-condition** : entrée `Rapport exporté` en base, fichier S3 chiffré, lien signé expirable.
- **Cas d'erreur** : plage > 24 mois → refus (performance). Génération > 10 s → fallback asynchrone, e-mail quand prêt.
- **Notifications** : e-mail à l'Admin demandeur avec lien signé.

### W10 — Suppression de compte / foyer (RM10)

- **Précondition** : Admin connecté.
- **Étapes** :
  1. E11 Paramètres → *« Supprimer mon foyer »* → confirmation avec saisie du mot « SUPPRIMER ».
  2. Système prépare une **archive de portabilité** : export CSV complet + PDF complet des 12 derniers mois → envoi e-mail sécurisé (lien signé 7 j).
  3. Statut foyer → `pending_deletion`, affichage in-app « Suppression prévue le [date+30j] ». Possibilité d'annuler pendant 7 j.
  4. À J+7 : passage à `deleted` ; données chiffrées rendues illisibles (rotation clé KMS spécifique au foyer), purge des backups rotatifs dans les 30 j suivants.
  5. Audit trail pseudonymisé, conservé.
- **Post-condition** : foyer inaccessible, données purgées sous 30 j, preuves conservées.
- **Cas d'erreur** : plusieurs Admins → bloqué si l'Admin qui supprime n'est pas le seul ; passe par W11 d'abord.
- **Notifications** : e-mail confirmation + e-mail archive + e-mails d'information aux autres aidants 24 h avant purge effective.

### W11 — Transfert d'admin (RM1)

- **Précondition** : Admin connecté, ≥ 1 autre aidant avec rôle `contributor`.
- **Étapes** :
  1. E8 → *« Transférer l'admin »*.
  2. Sélection du contributeur cible.
  3. MFA / magic link reconfirmation de l'Admin sortant.
  4. Notification push + e-mail à la cible pour acceptation explicite.
  5. Acceptation → rôle Admin sortant devient `contributor`, cible devient `admin`, mise à jour de `rprp_user_id` si c'était le sortant.
- **Post-condition** : foyer avec nouvel Admin, ancien Admin en `contributor`.
- **Cas d'erreur** : refus de la cible → aucun changement, Admin sortant notifié.
- **Notifications** : push + e-mail aux deux parties.

### W12 — Ré-acceptation CGU après mise à jour majeure

- **Précondition** : publication d'une nouvelle version majeure des CGU / PC.
- **Étapes** :
  1. Backend pousse le nouveau `consent_version` aux clients via WebSocket ou au prochain login.
  2. Modale bloquante à l'ouverture : résumé des changements + CTA *« Voir les détails »* + *« Accepter »*.
  3. Ré-acceptation horodatée, mise à jour `consent_log`.
  4. Refus → compte mis en lecture seule, aucune nouvelle saisie. Option de suppression de compte (W10).
- **Post-condition** : tous les utilisateurs actifs sur la nouvelle version, anciens en lecture seule.
- **Cas d'erreur** : aidant restreint en cours de session → l'Admin doit ré-inviter (nouvelle session).

---

## 6. Interfaces utilisateur (écrans principaux)

Format : objectif, contenu, actions, navigation, cas particuliers.

### E1 — Accueil / tableau de bord du foyer

- **Objectif** : en 3 secondes, savoir où en est l'enfant.
- **Contenu** : prénom + photo enfant, carte « Prochaine prise prévue » (heure, statut : à venir / à l'heure / en retard / manquée), carte « Dernière prise » (aidant, heure, type), badge hors-ligne si pertinent.
- **Actions** : bouton dominant *« J'ai donné la pompe de fond »* (bleu), bouton secondaire *« Pompe de secours »* (rouge), icône historique, icône paramètres.
- **Navigation** : vers E2, E4, E11.
- **Cas vide** : pas encore de plan → CTA *« Créer un plan »*.
- **Cas offline** : badge *« Hors-ligne — x action(s) en attente »*.

### E2 — Saisie rapide prise

- **Objectif** : confirmer une prise en ≤ 10 s (cible O1).
- **Contenu** : pompe sélectionnée (par défaut = plan actif), heure (now par défaut, éditable), doses (par défaut 1).
- **Actions** : *« Confirmer »* (vert), *« Annuler »* (texte).
- **Navigation** : retour E1 après confirmation (toast undo 5 s).
- **Cas erreur** : pompe `expired` → blocage + lien vers E7 remplacement.

### E3 — Formulaire symptômes / circonstances (secours)

- **Objectif** : documenter une prise `rescue` en ≤ 30 s (cible J3).
- **Contenu** : grille icônes symptômes (6 items pré-définis + « Autre »), liste circonstances (6 items + « Autre »), champ texte libre optionnel.
- **Actions** : *« Valider »* (grisé tant que RM4 non satisfaite), *« Annuler »*.
- **Navigation** : vers E1 avec toast.

### E4 — Historique des prises (timeline filtrable)

- **Objectif** : consulter / filtrer l'historique.
- **Contenu** : timeline chronologique inversée, cartes par jour, chaque carte avec heure + aidant + type (icône + couleur) + symptômes si secours.
- **Actions** : filtres (type, plage, aidant), tap sur carte → E5.
- **Cas offline** : lecture des 30 derniers jours accessible (RM20).

### E5 — Détails / édition d'une prise

- **Objectif** : voir toutes les infos d'une prise, permettre correction ou annulation.
- **Contenu** : heure locale + UTC + heure de sync (si décalée), aidant, pompe, doses, symptômes, circonstances, commentaire, source (manuel / rattrapage / rappel).
- **Actions** : *« Modifier »* (auteur ≤ 30 min, RM18), *« Annuler la prise »* (Admin), audit trail visible.
- **Cas erreur** : modification refusée hors délai → message clair.

### E6 — Plan de traitement

- **Objectif** : visualiser et ajuster la prescription.
- **Contenu** : pompe, fréquence, heures cibles, doses par prise, statut, dates.
- **Actions** : édition (Admin), pause, reprise, nouveau plan (si ancienne pompe remplacée).
- **Cas particulier** : changement de plan en cours de journée → ajuste les rappels du reste de la journée, conserve les rappels passés en `cancelled`.

### E7 — Gestion des pompes

- **Objectif** : lister, ajouter, remplacer, consulter le niveau.
- **Contenu** : liste des pompes actives + barre de remaining doses + date péremption ; onglet historique pompes.
- **Actions** : *« Ajouter »*, *« Remplacer »* (W7), *« Archiver »*.
- **Cas erreur** : nouvelle pompe avec même nom commercial → avertissement non bloquant.

### E8 — Gestion des aidants

- **Objectif** : inviter, lister, révoquer aidants.
- **Contenu** : liste des aidants actifs avec rôle, nom d'affichage, statut (connecté il y a…, session restreinte expirant à…), invitations en cours.
- **Actions** : *« Inviter »* (W5), *« Transférer admin »* (W11), *« Retirer »*.
- **Cas particulier** : dernier Admin essaye de se retirer → prompt RM1.

### E9 — Profil enfant

- **Objectif** : infos minimales.
- **Contenu** : prénom, année de naissance, photo, notes médicales.
- **Actions** : édition par Admin uniquement.
- **Cas particulier** : ajout second enfant bloqué (RM13) → teasing v1.1.

### E10 — Export / rapport médecin

- **Objectif** : générer un PDF en 1 clic.
- **Contenu** : sélecteur de plage (Derniers 30 j / 90 j / personnalisé), aperçu miniature.
- **Actions** : *« Générer PDF »*, *« Télécharger CSV »*, *« Envoyer par e-mail »*, *« Copier le lien signé »*.
- **Cas erreur** : plage > 24 mois → refus.

### E11 — Paramètres & compte

- **Objectif** : préférences, conformité, suppression.
- **Contenu** : langue, fuseau, fenêtre confirmation, seuil pompe, notifications (opt-in granulaire), confidentialité (RPRP contact, version CGU, révocation consentement), export / suppression (W10).
- **Actions** : modification, export complet, suppression.
- **Cas particulier** : refus ré-acceptation CGU → lecture seule.

### E12 — Onboarding (3-5 écrans)

- **Objectif** : première mise en service en < 2 min (cible O5).
- **Écrans** :
  1. Bienvenue + disclaimer non-DM (RM27).
  2. Identité (e-mail magic link OU OAuth).
  3. Enfant (prénom, année).
  4. Pompe de fond + plan (valeurs par défaut 08:00 / 20:00).
  5. Invitation aidant (skip possible).
- **Cas particulier** : mode invité local sans compte, migration au premier login.

### E13 — Écran de synchronisation / conflits

- **Objectif** : transparence sur la file d'attente et les conflits.
- **Contenu** : liste des événements en attente, badge état, liste des conflits `pending_review`.
- **Actions** : *« Forcer la sync »*, *« Résoudre »* sur chaque conflit (choix parmi les doublons).

---

## 7. Contrats API

### 7.1. Approche recommandée

**REST + JSON**. Justification :
- Cache HTTP natif, outillage mature (OpenAPI, Postman, SDK auto-générés).
- Granularité fine utile pour le multi-tenant strict et l'idempotence.
- Les clients mobiles et web ont des besoins homogènes (pas de sur-fetch justifiant GraphQL).
- Temps réel assuré hors REST via **WebSocket** dédié (`/realtime`).

**Authentification** : JWT court (15 min) + refresh token rotatif (7 j), header `Authorization: Bearer <jwt>`. Sessions Contributeur restreint utilisent un token JWT spécifique avec claim `session_type=restricted` et TTL 8 h.

**Idempotence** : sur tous les `POST` de création (prises, invitations, rapports), header `Idempotency-Key` obligatoire (UUID v4). Stockage 24 h côté backend.

**Pagination** : cursor-based sur historique (`?cursor=...&limit=50`), limite 100.

**Versioning** : URL `/v1/...`. Changements majeurs = `/v2`.

**Erreurs** : format standardisé `{ "error": { "code": "string", "message": "string", "details": {...} } }`, codes métier stables.

### 7.2. Domaines et endpoints

#### Auth & comptes (`/v1/auth/*`)
- `POST /auth/magic-link` — envoi magic link (body `{email}`).
- `POST /auth/magic-link/verify` — vérification (body `{token}`, renvoie JWT).
- `POST /auth/oauth/apple`, `POST /auth/oauth/google` — OAuth.
- `POST /auth/passkey/register`, `POST /auth/passkey/authenticate` — WebAuthn.
- `POST /auth/restricted/authenticate` — body `{invite_code, pin}`.
- `POST /auth/refresh` — renouvellement JWT.
- `POST /auth/logout` — invalidation session.

#### Foyers (`/v1/households/*`)
- `GET /households/me` — foyer courant.
- `POST /households` — création (Admin uniquement, à l'onboarding).
- `PATCH /households/:id` — mise à jour (timezone, langue, fenêtres, seuils).
- `DELETE /households/:id` — déclenche W10.

#### Enfants (`/v1/children/*`)
- `GET /children/:id`.
- `POST /children` — v1.0 refuse si un enfant existe déjà (RM13).
- `PATCH /children/:id`.

#### Pompes (`/v1/inhalers/*`)
- `GET /inhalers?status=active`.
- `POST /inhalers` — Admin.
- `PATCH /inhalers/:id`.
- `POST /inhalers/:id/replace` — corps : `{new_inhaler_payload}`.

#### Plans (`/v1/treatment-plans/*`)
- `GET /treatment-plans?child_id=...`.
- `POST /treatment-plans` — Admin.
- `PATCH /treatment-plans/:id` — pause / reprise / modification.

#### Prises (`/v1/doses/*`) — **critique, avec idempotence**
- `GET /doses?range=...&cursor=...`.
- `POST /doses` — idempotent via `Idempotency-Key`.
- `PATCH /doses/:id` — édition dans les 30 min (RM18).
- `POST /doses/:id/void` — annulation avec raison.

**Exemple `POST /v1/doses`** :
```json
{
  "client_event_id": "b9e3...",
  "pump_id": "7c2f...",
  "plan_id": "4a10...",
  "type": "maintenance_planned",
  "administered_at_local": "2026-04-19T20:05:00-04:00",
  "doses_administered": 1,
  "symptoms": [],
  "circumstances": [],
  "free_text_note": null,
  "source": "manual_entry"
}
```
Réponse `201 Created` avec entité complète + `server_administered_at_utc` + statut. Renvoi `200 OK` si déjà traité (même `Idempotency-Key`).

#### Aidants & invitations (`/v1/invitations/*`, `/v1/caregivers/*`)
- `POST /invitations` — body `{target_role, channel, display_name, max_uses}` → renvoie `{invite_code, pin, qr_payload, expires_at}`.
- `GET /invitations` — liste invitations actives (Admin).
- `DELETE /invitations/:id` — révocation.
- `POST /invitations/:code/accept` — acceptation (avec `pin` si restreint).
- `GET /caregivers` — liste aidants.
- `PATCH /caregivers/:id` — changement rôle, permissions.
- `DELETE /caregivers/:id` — retrait.
- `POST /caregivers/:id/transfer-admin` — W11.

#### Notifications (`/v1/notifications/*`)
- `GET /notifications?cursor=...`.
- `PATCH /notifications/:id/read`.
- `POST /notifications/preferences` — opt-in granulaire par type.

#### Rapports (`/v1/reports/*`)
- `POST /reports/generate` — body `{range_start, range_end, format, intended_recipient}` → renvoie `{report_id, signed_url, expires_at}`.
- `GET /reports/:id`.
- `GET /reports/:id/download` — via signed URL.

**Exemple `POST /v1/reports/generate`** :
```json
{
  "range_start": "2026-01-19",
  "range_end": "2026-04-19",
  "format": "pdf",
  "intended_recipient": "physician"
}
```
Réponse `202 Accepted` avec `{report_id, status: "processing"}` si > 5 s, ou `201 Created` avec URL signée si immédiat.

#### Confidentialité & droits (`/v1/privacy/*`)
- `POST /privacy/export` — archive complète CSV + PDF, envoi e-mail.
- `POST /privacy/delete` — déclenche W10.
- `POST /privacy/consent` — acceptation version CGU (body `{version_hash}`).
- `GET /privacy/consent-log` — historique consentements.

#### Synchronisation (`/v1/sync/*`)
- `POST /sync/batch` — batch d'événements hors-ligne.
- `GET /sync/since?cursor=...` — pull des modifications serveur depuis le dernier timestamp.

**Exemple `POST /v1/sync/batch`** :
```json
{
  "events": [
    {
      "type": "dose.create",
      "client_event_id": "b9e3...",
      "payload": { /* identique POST /doses */ }
    },
    {
      "type": "dose.void",
      "client_event_id": "c1a2...",
      "payload": { "dose_id": "1234...", "voided_reason": "double saisie" }
    }
  ]
}
```
Réponse `200 OK` avec liste `{client_event_id, status, server_entity | error}` par événement.

#### Temps réel
- `GET /realtime` — upgrade WebSocket, authentifié par JWT, scopé `household_id`. Événements serveur : `dose.created`, `dose.voided`, `reminder.missed`, `pump.low`, `invitation.accepted`, etc.

---

## 8. Règles spécifiques hors-ligne & synchronisation

- **Stockage local** : pompes actives, plans actifs, 30 derniers jours de prises, préférences notifications, file d'attente d'événements. Chiffré (Keychain iOS, Android Keystore, IndexedDB + Web Crypto API web).
- **Rétention locale** : 90 j maximum (purge automatique au-delà), même si lecture offline n'est garantie qu'à 30 j.
- **Stratégie sync** :
  - **Push** par le client dès retour réseau (W8).
  - **Pull** incrémental (`GET /sync/since`) à l'ouverture de l'app et toutes les 60 s en foreground ; WebSocket pour le temps réel en plus.
  - **Horodatage serveur autoritaire** pour l'ordre, `administered_at_utc` fourni par le client conservé.
- **Résolution de conflits** :
  - **Prises** : jamais perdues, jamais fusionnées. Double saisie suspectée = RM6 (`pending_review`).
  - **Éditions simultanées** : last-write-wins par `updated_at` serveur, avec journal de l'ancienne valeur dans l'audit trail.
  - **Plan modifié puis prise offline selon ancien plan** : la prise est conservée, rattachée à la version du plan historique.
- **Délai max notification post-sync** : 5 s après `recorded_at_utc`, pas de retard artificiel.
- **Limites hors-ligne** :
  - Pas de création de plan offline (nécessite synchro pour cohérence).
  - Pas d'invitation d'aidant offline.
  - Pas d'export de rapport offline.
  - Pas de modification de l'enfant offline.

---

## 9. Règles de notifications

- **Types** :
  - `reminder` — rappel planifié (push).
  - `missed_dose` — dose manquée (push + e-mail fallback).
  - `peer_dose_recorded` — prise enregistrée par un autre (push).
  - `pump_low` — fin de pompe (push à Admin, + contributeurs si opt-in).
  - `pump_expiring` — péremption proche.
  - `dispute_detected` — double saisie suspectée (push aux deux aidants).
  - `admin_handover` — transfert admin en attente (push + e-mail).
  - `consent_update_required` — nouvelle version CGU (in-app).
  - `security_alert` — login suspect, changement mot de passe, export de données (push + e-mail).
- **Canaux** :
  - **Push OS** (APNs, FCM) — canal principal. Payload minimal (RM16).
  - **Notification locale** — redondance si push KO (programmée côté OS pour les rappels connus).
  - **E-mail** — fallback pour `missed_dose` (après 30 min sans action), `security_alert`, archives de portabilité, rapports.
- **Fréquence max** : **≤ 15 notifications/jour/aidant** toutes catégories confondues. Au-delà, regroupement forcé (RM26).
- **Regroupement** : plusieurs `peer_dose_recorded` d'un même aidant dans une fenêtre de 60 min = 1 seule notification agrégée.
- **Paramétrage** : chaque aidant désactive individuellement chaque type **sauf** `missed_dose` et `security_alert` (protection sanitaire / sécurité).
- **Quiet hours** : chaque aidant peut définir une plage « ne pas déranger » (push silencieux, pas de notification locale) — sauf `missed_dose` de nuit si plan `daily_twice` 20:00 n'a pas été confirmé à 21:00 (règle de sécurité).

---

## 10. Règles de conformité à exposer dans l'app

Correspondance directe avec `COMPLIANCE.md`.

- **Écran onboarding** : disclaimer non-DM (RM27), lien CGU + PC, case non pré-cochée de consentement (art. 9.2.a RGPD), case opt-in séparée pour crash reports.
- **Écran paramètres / confidentialité** :
  - Version des CGU acceptée (hash SHA-256 tronqué visible).
  - Date d'acceptation.
  - Bouton *« Exporter mes données »* (W9 complet).
  - Bouton *« Supprimer mon foyer »* (W10).
  - Coordonnées du RPRP.
  - Lien vers la politique de confidentialité dédiée mineurs.
  - Bouton *« Retirer mon consentement »* (implique W10).
- **Chaque rapport exporté** : mention disclaimer en pied + hash intégrité.
- **Ré-acceptation CGU** : modale bloquante (W12) à chaque version majeure.
- **Journal d'accès** : l'Admin peut consulter un résumé des 90 derniers événements d'audit le concernant (hors événements d'autres aidants).
- **Disclaimer pied d'écran** : présent discrètement sur E1, E4, E10.
- **Audit trail consultable par le RPRP** : back-office protégé, pas accessible via l'app utilisateur.

---

## 11. Exigences non fonctionnelles (NFR)

- **Performance** :
  - Ouverture app < **2 s** (95e percentile) sur mobile milieu de gamme.
  - Saisie prise (E1 → confirmation) < **10 s** médiane (cible O1).
  - `POST /sync/batch` < **5 s** pour 100 événements (95e percentile).
  - `POST /reports/generate` < **5 s** pour 90 j d'historique.
- **Disponibilité** : **99,5 %** mensuel sur l'instance officielle (SLO interne, pas d'engagement contractuel en v1).
- **Fiabilité notifications** : > **99 %** de push délivrés sous 60 s de la cible (cible O4). Monitoring instrumenté.
- **Scalabilité** : supporter **10 000 foyers actifs** sans refactor. Preuves : tests de charge sur `POST /doses`, `POST /sync/batch`, WebSocket concurrents.
- **Internationalisation** : FR + EN en v1.0. Tous les textes via fichiers i18n (pas de chaînes en dur). Dates / nombres / fuseaux formatés selon locale.
- **Accessibilité** : **WCAG 2.1 AA**. Audit automatique (axe-core) + navigation lecteur d'écran validée sur J2, J3, J5.
- **Sécurité** : conforme à `COMPLIANCE.md` (OWASP Top 10, MASVS niveau 2, chiffrement KMS, audit trail, gestion secrets).
- **Observabilité** : logs structurés JSON, métriques Prometheus-like, traces OpenTelemetry, dashboards Grafana. RPRP accès audit trail en lecture.
- **Portabilité** : code open source (AGPL v3), Docker Compose de self-hosting, documentation d'installation.
- **Compatibilité** :
  - iOS ≥ 15, Android ≥ 9 (API 28), navigateurs evergreen (Chrome / Safari / Firefox / Edge derniers 2 ans).
  - PWA installable sur Android et iOS.

---

## 12. Critères d'acceptation globaux

Par bloc fonctionnel. Les critères détaillés par story sont produits dans le backlog projet.

### Compte & foyer
- CA1 : un parent peut créer un compte et un foyer en moins de 2 min sans assistance.
- CA2 : un aidant secondaire peut rejoindre un foyer en moins de 60 s via lien + PIN.
- CA3 : un aidant restreint peut enregistrer une prise en moins de 10 s via QR + PIN.

### Saisie des prises
- CA4 : une prise de fond planifiée se confirme en 1 tap sur E1 et propage aux autres < 5 s.
- CA5 : une prise de secours sans symptôme ni circonstance est refusée avec message clair.
- CA6 : une prise enregistrée offline est synchronisée au retour réseau avec horodatage initial préservé.

### Rappels et doses manquées
- CA7 : 99 % des rappels planifiés sont livrés < 60 s de la cible sur banc de test.
- CA8 : une dose non confirmée 30 min après l'heure cible génère une notification `missed_dose`.
- CA9 : un rattrapage jusqu'à 24 h en arrière est possible avec confirmation explicite.

### Pompes
- CA10 : une pompe atteignant le seuil 20 doses restantes génère une notification à l'Admin.
- CA11 : le remplacement d'une pompe migre automatiquement les plans actifs.

### Rapport médecin
- CA12 : un PDF 1-2 pages est généré en < 5 s pour une plage de 3 mois.
- CA13 : le PDF contient disclaimer + hash intégrité en pied.
- CA14 : un médecin peut lire le PDF en moins de 30 s pour prendre une décision (validation par 1 pneumo-pédiatre).

### Conformité
- CA15 : un utilisateur peut exporter toutes ses données en 1 action.
- CA16 : un utilisateur peut supprimer son foyer, reçoit une archive et la purge s'exécute sous 30 j.
- CA17 : une mise à jour majeure des CGU bloque l'utilisation jusqu'à ré-acceptation.
- CA18 : le payload des notifications push ne contient aucune donnée santé en clair (vérifié par test automatisé).

### Multi-tenant & sécurité
- CA19 : un test d'accès IDOR à un foyer tiers renvoie systématiquement 403 / 404.
- CA20 : l'audit trail enregistre login, saisie, export, suppression, consentement.

---

## 13. Ouvertures pour v1.1 et v2.0

### v1.1 — Multi-enfants (fratrie)

- **Impact modèle** : `Foyer` 1 → N `Enfant` (le 1:1 v1.0 devient 1:N). Les tables `Pompe`, `Plan`, `Prise` référencent déjà `child_id` — aucun refactor.
- **Impact UI** : ajout sélecteur d'enfant sur E1 (picker en haut), filtrage E4 par enfant, E9 devient liste.
- **Impact API** : `POST /children` s'ouvre (levée RM13), `GET /children` retourne liste.
- **Impact rapport** : PDF séparé par enfant (1 enfant = 1 rapport).

### v2.0 — Apple HealthKit / Google Health Connect

- **Impact modèle** : ajout table `HealthIntegration` (child_id, provider, status, last_sync_at, scopes), ajout champ `external_refs` sur `Prise` (pour dédoublonner les imports).
- **Impact UI** : paramètres d'intégration par enfant, bandeau d'état (sync OK / erreur).
- **Impact API** : endpoints `/v1/integrations/apple-health/*`, `/v1/integrations/health-connect/*`.
- **Impact conformité** : DPIA additionnel, mise à jour PC, nouveau consentement.

### v2.0 — Portail pro médecin

- **Impact modèle** : nouveau rôle `physician`, table `HouseholdAccessGrant` (foyer consent à partager en lecture seule), table `Practice` / `Clinic`, table `Billing` (B2B).
- **Impact API** : domaine `/v1/practices/*`, scopes différenciés.

---

## 14. Points ouverts pour l'architecture technique

Ces points sont détaillés dans `../architecture/ARCHITECTURE.md` :

1. **Stratégie temps réel** : WebSocket vs Server-Sent Events vs polling long. Choix retenu : **WebSocket**.
2. **Framework cross-platform** : choix retenu : **React Native + Expo + React Native Web + Next.js 15**.
3. **Génération PDF** : client-side (local-first) ou server-side. Choix retenu : **client-side** pour cohérence zero-knowledge.
4. **Stack offline + sync** : choix retenu : **Automerge 2 + op-sqlite**.
5. **Authentification** : choix retenu : **magic link + passkey WebAuthn** implémenté dans le relais.
6. **Hébergement backend** : choix retenu : **AWS natif (ca-central-1) via CDK**.

---

*Fin des spécifications fonctionnelles Kinhale v1.0 — document publié sous AGPL v3.*
