-- Adds TEMPLATE_VALUES_JSON to GUARDIAN.MY_NOTICES so the rider generator can
-- read the original template field values (the form fields the user filled
-- out when creating the notice). Without this, template values are only
-- present inside the rendered NOTICE_BODY HTML and aren't reliably parseable.
--
-- TEMPLATE_FORM_ID already exists on MY_NOTICES from migration
-- 02_extend_my_notices.sql (Securities Notice MVP). The POST /api/my-notices
-- endpoint will be updated to start populating both columns going forward.
--
-- Idempotent: safe to re-run.
IF COL_LENGTH('GUARDIAN.MY_NOTICES', 'TEMPLATE_VALUES_JSON') IS NULL
    ALTER TABLE [GUARDIAN].[MY_NOTICES] ADD [TEMPLATE_VALUES_JSON] NVARCHAR(MAX) NULL;
