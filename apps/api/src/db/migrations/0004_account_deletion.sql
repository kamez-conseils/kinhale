-- E9-S03 + E9-S04 — Suppression de compte/foyer avec période de grâce 7 jours.
--
-- 1. Étend la table `accounts` avec deux colonnes pour matérialiser l'état
--    `pending_deletion` et la date prévue de purge.
-- 2. Crée la table `deleted_accounts` pour conserver une preuve pseudonymisée
--    de la suppression (trace légale 12 mois).
-- 3. Ajuste `audit_events.account_id` : passe en NULL avec ON DELETE SET NULL
--    afin que l'audit trail soit **conservé** lors de la purge (RM10 / Loi 25).
--
-- Refs: E9-S03, E9-S04, RM10, ADR-D14, RGPD art. 17, Loi 25 art. 28.

ALTER TABLE "accounts" ADD COLUMN "deletion_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "deletion_scheduled_at_ms" bigint;--> statement-breakpoint

-- Index partiel : le worker de purge ne scanne que les comptes en attente.
CREATE INDEX "accounts_pending_deletion_idx" ON "accounts" USING btree ("deletion_scheduled_at_ms") WHERE "deletion_status" = 'pending_deletion';--> statement-breakpoint

-- Tokens step-up auth pour la confirmation de suppression. TTL 5 min,
-- consommables une seule fois (`usedAt`). Zero-knowledge : aucun email,
-- aucune donnée santé.
CREATE TABLE "account_deletion_step_up_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_deletion_step_up_tokens_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint
ALTER TABLE "account_deletion_step_up_tokens" ADD CONSTRAINT "account_deletion_step_up_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_deletion_step_up_account_idx" ON "account_deletion_step_up_tokens" USING btree ("account_id");--> statement-breakpoint

-- Table de traçabilité pseudonymisée. Conservation 12 mois (purge en v1.1
-- via worker dédié — hors scope KIN-086).
CREATE TABLE "deleted_accounts" (
	"pseudo_id" text PRIMARY KEY NOT NULL,
	"deleted_at_ms" bigint NOT NULL,
	"household_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "deleted_accounts_deleted_at_idx" ON "deleted_accounts" USING btree ("deleted_at_ms");--> statement-breakpoint

-- L'audit trail doit survivre à la suppression du compte. On retire la
-- contrainte CASCADE et on bascule sur SET NULL : après purge, account_id
-- devient NULL mais la ligne reste pour preuve réglementaire.
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "audit_events" ALTER COLUMN "account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE no action;
