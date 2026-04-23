-- Add audience visibility flags to GUARDIAN.FORMS.
--
-- IS_INTERNAL / IS_EXTERNAL replace the earlier overloaded use of IS_PUBLIC
-- for template audience. Two booleans let us distinguish:
--   (1,0) Internal-only   — roles != 5
--   (0,1) External-only   — role 5 (EXTERNAL_USER)
--   (1,1) Both            — everyone
--   (0,0) Neither         — draft / nobody
--
-- IS_PUBLIC stays untouched and continues to mean "cross-organization",
-- orthogonal to audience.
--
-- Defaults are both 1 so existing rows remain visible to everyone after
-- migration (no regression). GET /api/forms applies the audience AND clause
-- after the company/allowlist filters.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('GUARDIAN.FORMS') AND name = 'IS_INTERNAL'
)
BEGIN
    ALTER TABLE GUARDIAN.FORMS
    ADD IS_INTERNAL BIT NOT NULL CONSTRAINT DF_FORMS_IS_INTERNAL DEFAULT 1;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('GUARDIAN.FORMS') AND name = 'IS_EXTERNAL'
)
BEGIN
    ALTER TABLE GUARDIAN.FORMS
    ADD IS_EXTERNAL BIT NOT NULL CONSTRAINT DF_FORMS_IS_EXTERNAL DEFAULT 1;
END;
