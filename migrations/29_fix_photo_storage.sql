-- Migration 29: Fix photo storage in FORMS_INSTANCE_VALUES
-- 1. Widen VALUE column to NVARCHAR(MAX) to support base64 image storage
-- 2. Add dedicated 'Subject Photo Image' field to Fidelity-Subject form
--    (separates the subject photo upload from the matrix 'Photo' radio button)

-- ── Step 1: Widen the VALUE column ────────────────────────────────
-- Check current column type first
IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'GUARDIAN'
      AND TABLE_NAME   = 'FORMS_INSTANCE_VALUES'
      AND COLUMN_NAME  = 'VALUE'
      AND CHARACTER_MAXIMUM_LENGTH <> -1  -- -1 means MAX
)
BEGIN
    ALTER TABLE GUARDIAN.FORMS_INSTANCE_VALUES
        ALTER COLUMN VALUE NVARCHAR(MAX) NOT NULL;
    PRINT 'VALUE column widened to NVARCHAR(MAX).';
END
ELSE
    PRINT 'VALUE column is already NVARCHAR(MAX) — no change needed.';

-- ── Step 2: Add Subject Photo Image field ─────────────────────────
DECLARE @FormId       INT;
DECLARE @PhotoFieldId INT;
DECLARE @CreateUserId INT = 1036;

SELECT @FormId = FORM_ID
FROM GUARDIAN.FORMS
WHERE FORM_NAME = 'Fidelity-Subject' AND IS_DELETED = 0;

IF @FormId IS NULL
BEGIN
    RAISERROR('Fidelity-Subject form not found — skipping photo field.', 10, 1);
END
ELSE
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM GUARDIAN.FIELDS
        WHERE FIELD_NAME = 'Subject Photo Image' AND IS_DELETED = 0
    )
    BEGIN
        INSERT INTO GUARDIAN.FIELDS (
            FIELD_NAME, FIELD_TYPE_ID, DISPLAY_FORMAT, HAS_LOOKUP,
            IS_PUBLIC, IS_ACTIVE, IS_DELETED, IS_REQUIRED, IS_SENSITIVE,
            CAN_SELECT_MULIPLE, ORGANIZATION_ID,
            CREATE_USER_ID, UPDATE_USER_ID, CREATE_DATE, UPDATE_DATE
        )
        VALUES (
            'Subject Photo Image', 1 /* Text */, NULL, 0,
            1, 1, 0, 0, 1 /* sensitive — contains PII photo */,
            0, NULL,
            @CreateUserId, @CreateUserId, GETDATE(), GETDATE()
        );
        SET @PhotoFieldId = SCOPE_IDENTITY();
        PRINT 'Created Subject Photo Image field: FIELD_ID ' + CAST(@PhotoFieldId AS VARCHAR);
    END
    ELSE
    BEGIN
        SELECT @PhotoFieldId = FIELD_ID
        FROM GUARDIAN.FIELDS
        WHERE FIELD_NAME = 'Subject Photo Image' AND IS_DELETED = 0;
        PRINT 'Subject Photo Image already exists: FIELD_ID ' + CAST(@PhotoFieldId AS VARCHAR);
    END

    IF NOT EXISTS (
        SELECT 1 FROM GUARDIAN.FORMS_FIELDS
        WHERE FORM_ID = @FormId AND FIELD_ID = @PhotoFieldId
    )
    BEGIN
        INSERT INTO GUARDIAN.FORMS_FIELDS (FORM_ID, FIELD_ID, SORT_ORDER, CREATE_DATE, UPDATE_DATE)
        VALUES (@FormId, @PhotoFieldId, 66, GETDATE(), GETDATE());
        PRINT 'Linked Subject Photo Image to Fidelity-Subject form.';
    END
    ELSE
        PRINT 'Subject Photo Image already linked to form.';
END

PRINT 'Migration 29 complete.';
