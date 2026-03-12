-- Migration 28: Add Analyst and Investigator fields to Fidelity-Subject form
-- These are dropdown (DD) fields that bind to the /api/users/assignable endpoint in the UI.
-- Run once against production if the seed script was already executed without these fields.

DECLARE @FormId INT;
DECLARE @AnalystFieldId INT;
DECLARE @InvestigatorFieldId INT;
DECLARE @CreateUserId INT = 1036; -- default admin user

-- Locate the Fidelity-Subject form
SELECT @FormId = FORM_ID
FROM GUARDIAN.FORMS
WHERE FORM_NAME = 'Fidelity-Subject'
  AND IS_DELETED = 0;

IF @FormId IS NULL
BEGIN
    RAISERROR('Fidelity-Subject form not found — aborting migration.', 16, 1);
    RETURN;
END

-- ── Add Analyst field ──────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM GUARDIAN.FIELDS WHERE FIELD_NAME = 'Analyst' AND IS_DELETED = 0
)
BEGIN
    INSERT INTO GUARDIAN.FIELDS (
        FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP,
        IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_REQUIRED, IS_SENSITIVE,
        CAN_SELECT_MULIPLE, ORGANIZATION_ID,
        CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
    )
    VALUES (
        'Analyst', 5 /* DD */, NULL, 1,
        1, 1, 0, 0, 0,
        0, NULL,
        @CreateUserId, @CreateUserId, GETDATE(), GETDATE()
    );

    SET @AnalystFieldId = SCOPE_IDENTITY();
    PRINT 'Created Analyst field with FIELD_ID ' + CAST(@AnalystFieldId AS VARCHAR);
END
ELSE
BEGIN
    SELECT @AnalystFieldId = FIELD_ID FROM GUARDIAN.FIELDS WHERE FIELD_NAME = 'Analyst' AND IS_DELETED = 0;
    PRINT 'Analyst field already exists with FIELD_ID ' + CAST(@AnalystFieldId AS VARCHAR);
END

-- Link Analyst to Fidelity-Subject form if not already linked
IF NOT EXISTS (
    SELECT 1 FROM GUARDIAN.FORMS_FIELDS
    WHERE FORM_ID = @FormId AND FIELD_ID = @AnalystFieldId
)
BEGIN
    INSERT INTO GUARDIAN.FORMS_FIELDS (FORM_ID, FIELD_ID, SORT_ORDER, CREATE_DATE, UPDATE_DATE)
    VALUES (@FormId, @AnalystFieldId, 64, GETDATE(), GETDATE());
    PRINT 'Linked Analyst field to Fidelity-Subject form.';
END
ELSE
    PRINT 'Analyst already linked to Fidelity-Subject form.';

-- ── Add Investigator field ─────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM GUARDIAN.FIELDS WHERE FIELD_NAME = 'Investigator' AND IS_DELETED = 0
)
BEGIN
    INSERT INTO GUARDIAN.FIELDS (
        FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP,
        IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_REQUIRED, IS_SENSITIVE,
        CAN_SELECT_MULIPLE, ORGANIZATION_ID,
        CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
    )
    VALUES (
        'Investigator', 5 /* DD */, NULL, 1,
        1, 1, 0, 0, 0,
        0, NULL,
        @CreateUserId, @CreateUserId, GETDATE(), GETDATE()
    );

    SET @InvestigatorFieldId = SCOPE_IDENTITY();
    PRINT 'Created Investigator field with FIELD_ID ' + CAST(@InvestigatorFieldId AS VARCHAR);
END
ELSE
BEGIN
    SELECT @InvestigatorFieldId = FIELD_ID FROM GUARDIAN.FIELDS WHERE FIELD_NAME = 'Investigator' AND IS_DELETED = 0;
    PRINT 'Investigator field already exists with FIELD_ID ' + CAST(@InvestigatorFieldId AS VARCHAR);
END

-- Link Investigator to Fidelity-Subject form if not already linked
IF NOT EXISTS (
    SELECT 1 FROM GUARDIAN.FORMS_FIELDS
    WHERE FORM_ID = @FormId AND FIELD_ID = @InvestigatorFieldId
)
BEGIN
    INSERT INTO GUARDIAN.FORMS_FIELDS (FORM_ID, FIELD_ID, SORT_ORDER, CREATE_DATE, UPDATE_DATE)
    VALUES (@FormId, @InvestigatorFieldId, 65, GETDATE(), GETDATE());
    PRINT 'Linked Investigator field to Fidelity-Subject form.';
END
ELSE
    PRINT 'Investigator already linked to Fidelity-Subject form.';

PRINT 'Migration 28 complete.';
