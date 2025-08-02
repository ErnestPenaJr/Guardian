-- Add company_id column to ATTACHMENTS table if it doesn't exist (for proper company isolation)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('GUARDIAN.ATTACHMENTS') AND name = 'COMPANY_ID')
BEGIN
    ALTER TABLE GUARDIAN.ATTACHMENTS ADD COMPANY_ID INT;
END;