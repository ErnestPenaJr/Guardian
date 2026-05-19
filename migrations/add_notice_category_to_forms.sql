-- Adds NOTICE_CATEGORY to GUARDIAN.FORMS for the Notice Type picker in the
-- Create New Template modal. Values: 'ANCM' (Announcement), 'SEC' (Securities),
-- 'GEN' (General), 'TRGT' (Target). NULL for non-notice templates.
--
-- Distinct from NOTICE_SUBTYPE (Securities Notice MVP vocabulary:
-- SECURITIES_FRAUD / SUBPOENA_RIDER). The two columns serve different
-- workflows and should not be conflated.
--
-- Idempotent: safe to re-run.
IF COL_LENGTH('GUARDIAN.FORMS', 'NOTICE_CATEGORY') IS NULL
    ALTER TABLE [GUARDIAN].[FORMS] ADD [NOTICE_CATEGORY] NVARCHAR(10) NULL;
