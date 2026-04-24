import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Comptes utilisateurs. L'email n'est jamais stocké en clair —
 * uniquement son SHA-256 (pseudonymisation Loi 25 / RGPD).
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  emailHash: text('email_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
