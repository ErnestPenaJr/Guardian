-- =====================================================================
-- Guardian MVP — app-schema patches for the PostgreSQL TS-server migration
-- Apply AFTER 01_schema.sql + 02_seed.sql.
--
-- These add columns that the canonical TS server's Prisma models / queries
-- expect but that the source SQL Server `GUARDIAN` schema is missing. They are
-- NOT produced by the generator (which faithfully mirrors the source), so they
-- live here as an idempotent patch. Each is a pre-existing schema gap: the
-- affected Prisma calls fail identically on SQL Server today.
-- =====================================================================

-- GUARDIAN.TASKS.TRACKINGID
--   The Prisma `TASKS` model declares `TRACKINGID` (and `dbo.TASKS` has it), but
--   `GUARDIAN.TASKS` never did — so prisma.tASKS.* (workflow.ts, group.ts) errors
--   with `column TASKS.TRACKINGID does not exist`. Added as nullable to match the
--   model. See docs/superpowers/notes/2026-06-05-pg-known-preexisting-drifts.md.
ALTER TABLE "GUARDIAN"."TASKS" ADD COLUMN IF NOT EXISTS "TRACKINGID" varchar(4000) NULL;
