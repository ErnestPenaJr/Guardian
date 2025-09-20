-- Migration: Add cancellation tracking fields to REQUESTS table
-- Date: 2025-09-20
-- Description: Add dedicated fields for tracking request cancellations with proper data integrity

USE [GUARDIAN-DEV];
GO

-- Add cancellation tracking fields to REQUESTS table
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD [CANCELLATION_REASON] nvarchar(500) NULL,
    [CANCELLED_DATE] datetime NULL,
    [CANCELLED_BY] int NULL;

PRINT 'Added cancellation tracking fields to REQUESTS table';

-- Add foreign key constraint for CANCELLED_BY to reference USERS
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD CONSTRAINT [FK_REQUESTS_CANCELLED_BY] 
FOREIGN KEY ([CANCELLED_BY]) REFERENCES [GUARDIAN].[USERS]([USER_ID]);

PRINT 'Added foreign key constraint FK_REQUESTS_CANCELLED_BY';

-- Create indexes for efficient querying
CREATE INDEX [IX_REQUESTS_STATUS_CANCELLED_DATE] ON [GUARDIAN].[REQUESTS] ([STATUS], [CANCELLED_DATE])
WHERE [STATUS] = 'X';

CREATE INDEX [IX_REQUESTS_CANCELLED_BY] ON [GUARDIAN].[REQUESTS] ([CANCELLED_BY])
WHERE [CANCELLED_BY] IS NOT NULL;

PRINT 'Created cancellation-related indexes';

-- Add check constraint to ensure cancellation fields are properly managed
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD CONSTRAINT [CHK_REQUESTS_CANCELLATION_FIELDS]
CHECK (
    ([STATUS] = 'X' AND [CANCELLED_DATE] IS NOT NULL AND [CANCELLED_BY] IS NOT NULL) OR
    ([STATUS] != 'X' AND [CANCELLED_DATE] IS NULL AND [CANCELLED_BY] IS NULL AND [CANCELLATION_REASON] IS NULL)
);

PRINT 'Added cancellation fields validation constraint';

-- Add column descriptions for documentation
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'User-provided reason for request cancellation (max 500 chars)',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'REQUESTS',
    @level2type = N'COLUMN', @level2name = N'CANCELLATION_REASON';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Timestamp when the request was cancelled',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'REQUESTS',
    @level2type = N'COLUMN', @level2name = N'CANCELLED_DATE';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'User ID of the person who cancelled the request',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'REQUESTS',
    @level2type = N'COLUMN', @level2name = N'CANCELLED_BY';

PRINT 'Added column documentation';

-- Rollback statements (for reference - not executed automatically)
/*
-- To rollback this migration:

-- Drop check constraint
ALTER TABLE [GUARDIAN].[REQUESTS] DROP CONSTRAINT [CHK_REQUESTS_CANCELLATION_FIELDS];

-- Drop indexes  
DROP INDEX [IX_REQUESTS_STATUS_CANCELLED_DATE] ON [GUARDIAN].[REQUESTS];
DROP INDEX [IX_REQUESTS_CANCELLED_BY] ON [GUARDIAN].[REQUESTS];

-- Drop foreign key constraint
ALTER TABLE [GUARDIAN].[REQUESTS] DROP CONSTRAINT [FK_REQUESTS_CANCELLED_BY];

-- Drop columns
ALTER TABLE [GUARDIAN].[REQUESTS] DROP COLUMN [CANCELLATION_REASON];
ALTER TABLE [GUARDIAN].[REQUESTS] DROP COLUMN [CANCELLED_DATE]; 
ALTER TABLE [GUARDIAN].[REQUESTS] DROP COLUMN [CANCELLED_BY];
*/

PRINT 'Migration completed: Added request cancellation tracking fields with proper constraints and indexes';