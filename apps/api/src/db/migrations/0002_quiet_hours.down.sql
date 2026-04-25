-- Rollback de 0002_quiet_hours.sql (KIN-081 — préférences plages calmes).
--
-- Idempotent : DROP avec IF EXISTS, ordre = inverse de l'application.

DROP INDEX IF EXISTS "user_quiet_hours_account_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "user_quiet_hours";
