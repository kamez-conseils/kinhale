-- Rollback de 0003_audit_events.sql (KIN-083 — audit trail).
--
-- ATTENTION : la table `audit_events` contient des preuves réglementaires
-- (Loi 25 art. 3.1 / 3.2, RGPD art. 30). Ce DROP TABLE supprime
-- DÉFINITIVEMENT ces preuves. À utiliser uniquement en dev / test, jamais
-- en prod sans procédure d'export préalable (cf. runbook).
--
-- Idempotent : tous les DROP utilisent IF EXISTS.

DROP INDEX IF EXISTS "audit_events_created_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "audit_events_account_type_idx";--> statement-breakpoint
DROP TABLE IF EXISTS "audit_events";
