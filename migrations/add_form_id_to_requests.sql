-- Add FORM_ID column to REQUESTS table
-- This migration adds the missing FORM_ID column that links requests to form templates

USE [GUARDIAN-DEV];
GO

-- Add the FORM_ID column to the REQUESTS table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('GUARDIAN.REQUESTS') AND name = 'FORM_ID')
BEGIN
    ALTER TABLE GUARDIAN.REQUESTS
    ADD FORM_ID INT NULL;
    
    PRINT 'FORM_ID column added to GUARDIAN.REQUESTS table';
END
ELSE
BEGIN
    PRINT 'FORM_ID column already exists in GUARDIAN.REQUESTS table';
END

-- Add foreign key constraint to link REQUESTS.FORM_ID to FORMS.FORM_ID
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_REQUESTS_FORM_ID')
BEGIN
    ALTER TABLE GUARDIAN.REQUESTS
    ADD CONSTRAINT FK_REQUESTS_FORM_ID
    FOREIGN KEY (FORM_ID) REFERENCES GUARDIAN.FORMS(FORM_ID);
    
    PRINT 'Foreign key constraint FK_REQUESTS_FORM_ID added';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_REQUESTS_FORM_ID already exists';
END

GO