-- Guardian MVP Notice Module - Priority System Enhancement
-- Date: 2024-08-19
-- Description: Adds priority level and due date functionality to notices

-- Add priority and due date fields to NOTICES table
ALTER TABLE [GUARDIAN].[NOTICES] 
ADD [PRIORITY_LEVEL] nvarchar(10) NOT NULL DEFAULT 'MEDIUM';

ALTER TABLE [GUARDIAN].[NOTICES] 
ADD [DUE_DATE] datetime2;

-- Add check constraint for priority levels
ALTER TABLE [GUARDIAN].[NOTICES] 
ADD CONSTRAINT [CHK_NOTICES_PRIORITY_LEVEL] 
CHECK ([PRIORITY_LEVEL] IN ('HIGH', 'MEDIUM', 'LOW'));

-- Create indexes for performance
CREATE INDEX [IX_NOTICES_PRIORITY_LEVEL] ON [GUARDIAN].[NOTICES] ([PRIORITY_LEVEL]);
CREATE INDEX [IX_NOTICES_DUE_DATE] ON [GUARDIAN].[NOTICES] ([DUE_DATE]);
CREATE INDEX [IX_NOTICES_PRIORITY_DUE_DATE] ON [GUARDIAN].[NOTICES] ([PRIORITY_LEVEL], [DUE_DATE]);

-- Add comments for documentation
EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Priority level for notice urgency: HIGH, MEDIUM, LOW',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICES',
    @level2type = N'COLUMN', @level2name = N'PRIORITY_LEVEL';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Optional due date for time-sensitive notices',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICES',
    @level2type = N'COLUMN', @level2name = N'DUE_DATE';