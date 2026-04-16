-- Adds OPTIONS column to GUARDIAN.FIELDS for dropdown/radio/checkbox choices.
-- Nullable NVARCHAR(MAX); SQL Server propagates nullable ADD to the history table automatically.
-- Idempotent via column-existence check.
--
-- NOTE: because FIELDS is system-versioned, execute the ADD COLUMN as a
-- single batch (the reusable runner may combine statements — prefer running
-- this via scripts/run-migration.cjs which splits on END; markers, or run
-- the ALTER directly).

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('GUARDIAN.FIELDS') AND name = 'OPTIONS'
)
BEGIN
  ALTER TABLE GUARDIAN.FIELDS ADD [OPTIONS] NVARCHAR(MAX) NULL;
END;
