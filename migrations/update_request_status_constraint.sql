-- Update REQUESTS table STATUS constraint to include Cancelled status
-- Date: 2025-09-04
-- Description: Add 'X' status for Cancelled requests and improve status terminology

USE [GUARDIAN-DEV];
GO

-- Drop existing constraint if it exists
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_REQUEST_STATUS')
BEGIN
    ALTER TABLE [GUARDIAN].[REQUESTS] DROP CONSTRAINT [CK_REQUEST_STATUS];
    PRINT 'Dropped existing CK_REQUEST_STATUS constraint';
END

-- Add updated constraint with new Cancelled status
ALTER TABLE [GUARDIAN].[REQUESTS] 
ADD CONSTRAINT [CK_REQUEST_STATUS] 
CHECK ([STATUS] IN ('P', 'A', 'D', 'I', 'X', 'H', 'R'));

PRINT 'Added updated CK_REQUEST_STATUS constraint with Cancelled status (X)';

-- Add extended properties for documentation
IF NOT EXISTS (SELECT * FROM ::fn_listextendedproperty(N'MS_Description', N'SCHEMA', N'GUARDIAN', N'TABLE', N'REQUESTS', N'COLUMN', N'STATUS'))
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Request Status: P=Pending, A=Active, D=Complete, I=In Progress, X=Cancelled, H=On Hold, R=Rejected',
        @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
        @level1type = N'TABLE', @level1name = N'REQUESTS',
        @level2type = N'COLUMN', @level2name = N'STATUS';
    PRINT 'Added STATUS column documentation';
END

PRINT 'Request status constraint update completed successfully';