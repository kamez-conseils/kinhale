-- Rollback de 0001_curly_iron_man.sql (KIN-080 — préférences notifications).
--
-- Idempotent : DROP avec IF EXISTS, ordre = inverse de l'application.

DROP INDEX IF EXISTS "user_notif_prefs_account_type_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "user_notification_preferences";
