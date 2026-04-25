-- Rollback de 0000_silent_zzzax.sql (schéma initial relais).
--
-- ATTENTION : cette opération est destructive et fait disparaître toute
-- la base relais. À ne JAMAIS exécuter en production sans procédure
-- d'export préalable. Ce rollback est essentiellement utile pour les
-- tests d'intégration et la remise à zéro d'un environnement de dev.
--
-- Ordre = inverse exact de l'application :
--   1. Supprimer index uniques avant les FK (pas strictement nécessaire,
--      les DROP TABLE en CASCADE suppriment leurs propres index, mais on
--      garde l'idempotence explicite).
--   2. DROP TABLE en CASCADE pour absorber les éventuelles dépendances
--      résiduelles.
--
-- Idempotent : DROP IF EXISTS partout.

DROP INDEX IF EXISTS "push_tokens_household_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "push_tokens_device_token_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "devices_account_pubkey_idx";--> statement-breakpoint

DROP TABLE IF EXISTS "push_tokens" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "mailbox_messages" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "magic_links" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "devices" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "accounts" CASCADE;
