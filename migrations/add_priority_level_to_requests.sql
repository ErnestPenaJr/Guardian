-- Migration: Add PRIORITY_LEVEL to REQUESTS table
-- Date: 2025-08-27
-- Description: Add PRIORITY_LEVEL field to support request prioritization with Low/Standard/High values

-- Add PRIORITY_LEVEL column to REQUESTS table
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD [PRIORITY_LEVEL] nvarchar(10) NOT NULL DEFAULT 'Standard';

-- Add check constraint to ensure valid priority levels
ALTER TABLE [GUARDIAN].[REQUESTS]
ADD CONSTRAINT [CHK_REQUESTS_PRIORITY_LEVEL] 
CHECK ([PRIORITY_LEVEL] IN ('Low', 'Standard', 'High'));

-- Create index for better query performance
CREATE INDEX [IX_REQUESTS_PRIORITY_LEVEL] ON [GUARDIAN].[REQUESTS] ([PRIORITY_LEVEL]);

-- Add column description
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Priority level for request processing - Low, Standard, or High',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'REQUESTS',
    @level2type = N'COLUMN', @level2name = N'PRIORITY_LEVEL';

PRINT 'Migration completed: Added PRIORITY_LEVEL to REQUESTS table';