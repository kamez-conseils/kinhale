-- Rollback de 0004_account_deletion.sql (E9-S03 / E9-S04 / RM10).
--
-- ATTENTION : ce rollback DÉTRUIT des données :
--   1. La table `deleted_accounts` (preuve pseudonymisée 12 mois) est
--      supprimée — toute trace légale de purge est perdue.
--   2. La table `account_deletion_step_up_tokens` est supprimée — les
--      demandes de suppression en cours sont invalidées.
--   3. Les colonnes `deletion_status` / `deletion_scheduled_at_ms` sont
--      retirées de `accounts` — les comptes en période de grâce
--      basculent silencieusement en état actif.
--   4. La FK `audit_events.account_id` repasse en CASCADE et la colonne
--      redevient NOT NULL ; toute ligne `audit_events` orpheline
--      (account_id NULL après une purge effective) **fera échouer le
--      rollback**. Dans ce cas : nettoyer ces lignes manuellement avant
--      de relancer (cf. docs/runbooks/database-migrations.md §rollback).
--
-- Idempotent : tous les DROP utilisent IF EXISTS ; les ALTER sur
-- `audit_events` sont enveloppés dans un DO LANGUAGE plpgsql gardé par
-- l'existence de la table — utile quand on rollback en chaîne 0004 puis
-- 0003 (lequel supprime `audit_events`) ou quand on relance ce down.sql
-- deux fois.

-- 1. Audit events : restaure la FK CASCADE et NOT NULL si la table existe encore.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_events'
  ) THEN
    ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_account_id_accounts_id_fk";
    ALTER TABLE "audit_events" ALTER COLUMN "account_id" SET NOT NULL;
    ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END
$$;--> statement-breakpoint

-- 2. Deleted accounts (trace pseudonymisée).
DROP INDEX IF EXISTS "deleted_accounts_deleted_at_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "deleted_accounts";--> statement-breakpoint

-- 3. Step-up tokens.
DROP INDEX IF EXISTS "account_deletion_step_up_account_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "account_deletion_step_up_tokens";--> statement-breakpoint

-- 4. Index partiel + colonnes accounts.
DROP INDEX IF EXISTS "accounts_pending_deletion_idx";--> statement-breakpoint
ALTER TABLE IF EXISTS "accounts" DROP COLUMN IF EXISTS "deletion_scheduled_at_ms";--> statement-breakpoint
ALTER TABLE IF EXISTS "accounts" DROP COLUMN IF EXISTS "deletion_status";
