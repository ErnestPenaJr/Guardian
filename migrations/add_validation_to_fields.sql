-- migrations/add_validation_to_fields.sql
-- Adds per-field validation config (compact JSON) to GUARDIAN.FIELDS.
-- Idempotent: safe to run multiple times. Apply staging-first, then prod.
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('GUARDIAN.FIELDS') AND name = 'VALIDATION'
)
BEGIN
    ALTER TABLE GUARDIAN.FIELDS ADD VALIDATION NVARCHAR(255) NULL;
END
