import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Comptes utilisateurs. L'email n'est jamais stocké en clair —
 * uniquement son SHA-256 (pseudonymisation Loi 25 / RGPD).
 *
 * **Suppression différée (E9-S03 / RM10)** :
 * - `deletionStatus` = `'active'` par défaut. Bascule à `'pending_deletion'`
 *   après confirmation step-up auth (POST /me/account/deletion-confirm).
 * - `deletionScheduledAtMs` = timestamp UTC ms de purge prévue (now + 7 j).
 *   `null` tant que `deletionStatus = 'active'`.
 * - À la confirmation, le check `accountIsActive` (plugin authenticate)
 *   refuse les requêtes des comptes en attente de suppression — sauf
 *   l'endpoint d'annulation qui est volontairement permissif.
 *
 * Le worker `account-purge` scanne périodiquement
 * `WHERE deletion_status = 'pending_deletion' AND deletion_scheduled_at_ms <= now`
 * (index partiel) puis exécute la purge complète + insertion audit + e-mail J+7.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    emailHash: text('email_hash').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletionStatus: text('deletion_status').notNull().default('active'),
    deletionScheduledAtMs: bigint('deletion_scheduled_at_ms', { mode: 'number' }),
  },
  (t) => [
    // Index partiel — le worker ne scanne que les comptes en attente, ce
    // qui garde le coût de scan O(K) où K = nombre de comptes en grâce.
    index('accounts_pending_deletion_idx').on(t.deletionScheduledAtMs),
  ],
);

/**
 * Statuts admis pour `accounts.deletion_status`.
 *
 * - `active` : compte normal, accessible à toutes les routes authentifiées.
 * - `pending_deletion` : compte en période de grâce (J→J+7). Toutes les
 *   routes authentifiées renvoient 403 sauf `/me/account/deletion-cancel`
 *   et `/me/account/deletion-status` (l'utilisateur doit pouvoir revenir
 *   sur sa décision et lire l'état).
 *
 * La valeur `deleted` n'existe pas en base — un compte purgé est
 * physiquement absent de la table `accounts` ; sa trace ne subsiste que
 * dans `deleted_accounts` (pseudonymisée).
 */
export const ACCOUNT_DELETION_STATUSES = ['active', 'pending_deletion'] as const;
export type AccountDeletionStatus = (typeof ACCOUNT_DELETION_STATUSES)[number];

/**
 * Tokens step-up auth pour confirmer une action sensible (E9-S03 :
 * suppression de compte). Pattern dérivé de `magic_links` mais lié à un
 * `accountId` (pas à un `emailHash`) pour éviter une réidentification
 * croisée.
 *
 * **Cycle de vie** :
 * - `POST /me/account/deletion-request` → génère un token, envoie un
 *   e-mail magic link spécifique (scope `account_deletion`).
 * - L'utilisateur clique → `POST /me/account/deletion-confirm` consomme
 *   le token (`usedAt = now`), bascule l'état du compte en
 *   `pending_deletion`.
 * - TTL strict de **5 minutes** — pattern step-up auth standard
 *   (cf. NIST SP 800-63B § 5.1.1.2 réauthentification).
 *
 * **Sécurité** :
 * - `tokenHash` : SHA-256 hex du token brut (jamais stocké en clair).
 * - `usedAt` : interdit la réutilisation (anti-replay).
 * - `accountId` : un seul token actif par compte à la fois (les anciens
 *   sont invalidés implicitement par TTL ou explicitement par marquage
 *   used à la consommation). Si l'utilisateur redemande pendant qu'un
 *   token est encore valide, on émet un nouveau token et l'ancien expire
 *   par TTL — pas besoin de DELETE explicite.
 *
 * **Zero-knowledge** : aucun email en clair, aucune donnée santé. Seul
 * un `accountId` (UUID opaque) lie le token au compte.
 */
export const accountDeletionStepUpTokens = pgTable(
  'account_deletion_step_up_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('account_deletion_step_up_account_idx').on(t.accountId)],
);

/**
 * Trace pseudonymisée des comptes purgés (E9-S03 / RM10 / Loi 25 art. 28).
 *
 * **Pourquoi pseudonymiser plutôt qu'anonymiser** :
 * - L'art. 17 RGPD impose l'effacement des données personnelles, mais
 *   permet la conservation de preuves d'effacement pour défendre un
 *   incident futur (ex. accusation d'avoir conservé les données).
 * - `pseudo_id = SHA-256(account_id || pepper)` est techniquement réversible
 *   uniquement par celui qui détient le pepper serveur — l'utilisateur ne
 *   peut être ré-identifié. C'est conforme à l'art. 4(5) RGPD.
 *
 * **Schéma minimal** :
 * - `pseudoId` : hash hex 64 chars (SHA-256 de l'accountId concaténé au
 *   pepper de l'env JWT_SECRET — sans cleartext de l'accountId).
 * - `deletedAtMs` : timestamp UTC ms de la purge effective.
 * - `householdId` : UUID du foyer — utile pour démontrer qu'un foyer a bien
 *   été purgé en cas d'audit régulateur. Pas de FK vers une table
 *   `households` (n'existe pas en v1.0 — `householdId == accountId` côté
 *   Automerge).
 * - `createdAt` : timestamp DB de l'écriture (pour debug, distinct de
 *   `deletedAtMs` qui est l'heure logique de la purge).
 *
 * **Rétention** : 12 mois post-suppression (cohérent avec la durée de
 * conservation des logs OWASP). Une purge cron sera ajoutée en v1.1 — voir
 * issue de suivi dans la PR.
 */
export const deletedAccounts = pgTable(
  'deleted_accounts',
  {
    pseudoId: text('pseudo_id').primaryKey(),
    deletedAtMs: bigint('deleted_at_ms', { mode: 'number' }).notNull(),
    householdId: uuid('household_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('deleted_accounts_deleted_at_idx').on(t.deletedAtMs)],
);

/**
 * Devices enregistrés. Chaque device porte une clé publique Ed25519
 * qui authentifie ses messages. Le householdId lie le device à un foyer.
 * Aucune donnée santé ici.
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    publicKeyHex: text('public_key_hex').notNull(),
    householdId: uuid('household_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('devices_account_pubkey_idx').on(t.accountId, t.publicKeyHex)],
);

/**
 * Magic links d'authentification. Le token n'est stocké que sous forme
 * de hash SHA-256 pour éviter toute réutilisation en cas de fuite DB.
 * TTL : 10 minutes (RM conformité).
 */
export const magicLinks = pgTable('magic_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailHash: text('email_hash').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/**
 * Messages de la mailbox E2EE. Le blob est le JSON de EncryptedBlob
 * (@kinhale/sync) — le relais ne peut pas déchiffrer son contenu.
 * TTL : 90 jours, purgé après ack du device destinataire.
 */
export const mailboxMessages = pgTable('mailbox_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull(),
  senderDeviceId: uuid('sender_device_id').notNull(),
  blobJson: text('blob_json').notNull(),
  seq: bigint('seq', { mode: 'number' }).notNull(),
  sentAtMs: bigint('sent_at_ms', { mode: 'number' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ackedAt: timestamp('acked_at'),
});

/**
 * Expo push tokens enregistrés par device. Un device peut avoir plusieurs tokens
 * (réinstallation). Payload push = opaque, sans donnée santé.
 */
export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    householdId: uuid('household_id').notNull(),
    token: text('token').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('push_tokens_device_token_idx').on(t.deviceId, t.token),
    index('push_tokens_household_idx').on(t.householdId),
  ],
);

/**
 * Préférences granulaires de notifications par compte (E5-S07).
 *
 * Les `missed_dose` et `security_alert` ne sont **jamais** persistés ici :
 * ils sont toujours actifs (SPECS §9 + RM25), et l'endpoint PUT refuse
 * toute tentative de les désactiver.
 *
 * Les types **absents** de cette table sont considérés `enabled = true` par
 * défaut (convention ergonomique : l'utilisateur n'a qu'à matérialiser les
 * refus, les acceptations étant silencieuses).
 *
 * Contrainte d'unicité (`accountId`, `notificationType`) : une seule entrée
 * par paire — un PUT réémis écrase proprement via `onConflictDoUpdate`.
 *
 * Granularité : **par compte** (et non par device). L'intention utilisateur
 * est partagée entre ses devices ; rien n'empêche une évolution future vers
 * une granularité device si le besoin émerge (ADR séparé).
 *
 * Aucune donnée santé ici — seulement une métadonnée de préférence.
 */
export const userNotificationPreferences = pgTable(
  'user_notification_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    notificationType: text('notification_type').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('user_notif_prefs_account_type_idx').on(t.accountId, t.notificationType)],
);

/**
 * Quiet hours par aidant (E5-S08).
 *
 * Une seule ligne par `accountId` (unicité stricte — un PUT écrase via
 * `onConflictDoUpdate`). L'absence de ligne équivaut à des quiet hours
 * désactivées (défaut implicite). Les colonnes `startLocalTime` et
 * `endLocalTime` stockent un format `"HH:mm"` (24h, zéro padding) dans un
 * `text` plutôt qu'un `time` Postgres pour :
 * - garder la sémantique locale **indépendante du fuseau** (le `time`
 *   Postgres serait converti en UTC au stockage dans certains drivers),
 * - garantir un round-trip exact sans tronquer à la minute via `TIME(0)`.
 *
 * `timezone` : IANA (ex: `America/Toronto`). Validé côté API par Zod +
 * `Intl.DateTimeFormat`. Pas de FK vers un référentiel séparé — Node 20
 * full ICU connaît l'intégralité de la base tz officielle.
 *
 * Aucune donnée santé ici — seulement des préférences utilisateur. Le
 * dispatcher push lit cette table pour filtrer les notifications non
 * critiques (les `missed_dose` et `security_alert` passent toujours,
 * cf. SPECS §9 + RM25 : exception sécurité).
 */
export const userQuietHours = pgTable(
  'user_quiet_hours',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull(),
    startLocalTime: text('start_local_time').notNull(),
    endLocalTime: text('end_local_time').notNull(),
    timezone: text('timezone').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('user_quiet_hours_account_idx').on(t.accountId)],
);

/**
 * Audit trail des événements de conformité (E8-S05 : génération rapport
 * médecin, E8-S04 : partage du rapport, et futurs événements
 * `account_deletion_requested`, etc.).
 *
 * **Zero-knowledge strict** (ADR-D12, ADR-D13) — `event_data` ne contient
 * **JAMAIS** :
 * - de contenu santé (prise, symptôme, plan, dose, prénom enfant),
 * - d'identifiant santé côté client (pumpId, doseId, childId),
 * - le PDF / CSV lui-même ni son HTML / texte source,
 * - le destinataire d'un partage (email, numéro téléphone, identifiant social).
 *
 * Seules autorisées pour `event_type = 'report_generated'` (E8-S05) :
 * - `reportHash` : hash SHA-256 opaque (RM24) du contenu PDF, non réversible.
 * - `rangeStartMs`, `rangeEndMs` : plage de dates (métadonnée temporelle, pas
 *   une donnée santé selon PRD §4).
 * - `generatedAtMs` : timestamp de génération.
 *
 * Seules autorisées pour `event_type = 'report_shared'` (E8-S04, KIN-084) :
 * - `reportHash` : même hash que `report_generated` (corrélation audit).
 * - `shareMethod` : enum fermée (`download` | `system_share` |
 *   `csv_download` | `csv_system_share`).
 * - `sharedAtMs` : timestamp de partage.
 *
 * Le format exact de `event_data` par type est validé en amont par un schéma
 * Zod côté route (défense en profondeur : la DB accepte un JSONB quelconque).
 *
 * **Index `account_type_idx`** : permet de lister les événements d'un compte
 * filtrés par type (UI future "historique de mes exports"). Pas un unique
 * — plusieurs `report_generated` par compte sont attendus (un par rapport).
 *
 * **Rétention** : non purgé automatiquement en v1.0 (audit réglementaire
 * Loi 25/RGPD — conservation 5 ans cf. §3.12 specs). Une purge cron sera
 * ajoutée quand la rétention légale deviendra contraignante.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // `account_id` peut être NULL après une purge (E9-S03 / RM10) : la FK
    // bascule en `ON DELETE SET NULL` plutôt que cascade. Le contenu de
    // `event_data` peut alors porter `pseudoId` pour préserver une trace
    // corrélable au compte purgé sans ré-identification possible.
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    eventType: text('event_type').notNull(),
    eventData: jsonb('event_data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('audit_events_account_type_idx').on(t.accountId, t.eventType),
    index('audit_events_created_idx').on(t.createdAt),
  ],
);
