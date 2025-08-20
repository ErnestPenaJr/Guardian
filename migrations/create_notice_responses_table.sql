-- Guardian MVP Notice Module - Response System Enhancement
-- Date: 2024-08-19
-- Description: Creates NOTICE_RESPONSES table for notice acknowledgment and response tracking

-- Create NOTICE_RESPONSES table for user acknowledgments and responses
CREATE TABLE [GUARDIAN].[NOTICE_RESPONSES] (
    [NOTICE_RESPONSE_ID] int IDENTITY(1,1) NOT NULL,
    [NOTICE_ID] int NOT NULL,
    [USER_ID] int NOT NULL,
    [COMPANY_ID] int NOT NULL,
    [RESPONSE_TYPE] nvarchar(20) NOT NULL DEFAULT 'ACKNOWLEDGED', -- ACKNOWLEDGED, UNDERSTOOD, COMPLETED, REQUIRES_CLARIFICATION, CANNOT_COMPLY
    [RESPONSE_MESSAGE] nvarchar(1000) NULL, -- Optional user message/comment
    [RESPONSE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [RESPONSE_STATUS] nvarchar(15) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, WITHDRAWN, SUPERSEDED
    [REQUIRES_FOLLOWUP] bit NOT NULL DEFAULT 0, -- Whether this response requires management follow-up
    [FOLLOWUP_PRIORITY] nvarchar(10) NULL, -- HIGH, MEDIUM, LOW - only if requires_followup = 1
    [FOLLOWUP_ASSIGNED_TO] int NULL, -- Manager/Admin assigned to handle follow-up
    [FOLLOWUP_COMPLETED_DATE] datetime2 NULL, -- When follow-up was completed
    [FOLLOWUP_NOTES] nvarchar(500) NULL, -- Follow-up completion notes
    [NOTIFICATION_SENT] bit NOT NULL DEFAULT 0, -- Whether issuer was notified of this response
    [IS_ANONYMOUS] bit NOT NULL DEFAULT 0, -- Whether response should be anonymous to issuer
    [CREATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [UPDATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [CREATE_USER_ID] int NULL,
    [UPDATE_USER_ID] int NULL,

    -- Primary key
    CONSTRAINT [PK_NOTICE_RESPONSES] PRIMARY KEY CLUSTERED ([NOTICE_RESPONSE_ID] ASC),

    -- Foreign key constraints
    CONSTRAINT [FK_NOTICE_RESPONSES_NOTICE] FOREIGN KEY ([NOTICE_ID]) 
        REFERENCES [GUARDIAN].[NOTICES] ([NOTICE_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_RESPONSES_USER] FOREIGN KEY ([USER_ID]) 
        REFERENCES [GUARDIAN].[USERS] ([USER_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_RESPONSES_COMPANY] FOREIGN KEY ([COMPANY_ID]) 
        REFERENCES [GUARDIAN].[COMPANY] ([COMPANY_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_RESPONSES_FOLLOWUP_USER] FOREIGN KEY ([FOLLOWUP_ASSIGNED_TO]) 
        REFERENCES [GUARDIAN].[USERS] ([USER_ID]) ON DELETE NO ACTION,

    -- Unique constraint to prevent duplicate responses per user per notice
    CONSTRAINT [UQ_NOTICE_RESPONSES_USER_NOTICE] UNIQUE ([NOTICE_ID], [USER_ID], [RESPONSE_STATUS])
);

-- Create indexes for performance
CREATE INDEX [IX_NOTICE_RESPONSES_NOTICE_ID] ON [GUARDIAN].[NOTICE_RESPONSES] ([NOTICE_ID]);
CREATE INDEX [IX_NOTICE_RESPONSES_USER_ID] ON [GUARDIAN].[NOTICE_RESPONSES] ([USER_ID]);
CREATE INDEX [IX_NOTICE_RESPONSES_COMPANY_ID] ON [GUARDIAN].[NOTICE_RESPONSES] ([COMPANY_ID]);
CREATE INDEX [IX_NOTICE_RESPONSES_RESPONSE_DATE] ON [GUARDIAN].[NOTICE_RESPONSES] ([RESPONSE_DATE]);
CREATE INDEX [IX_NOTICE_RESPONSES_TYPE_STATUS] ON [GUARDIAN].[NOTICE_RESPONSES] ([RESPONSE_TYPE], [RESPONSE_STATUS]);
CREATE INDEX [IX_NOTICE_RESPONSES_FOLLOWUP] ON [GUARDIAN].[NOTICE_RESPONSES] ([REQUIRES_FOLLOWUP], [FOLLOWUP_COMPLETED_DATE]);
CREATE INDEX [IX_NOTICE_RESPONSES_COMPANY_NOTICE] ON [GUARDIAN].[NOTICE_RESPONSES] ([COMPANY_ID], [NOTICE_ID]);
CREATE INDEX [IX_NOTICE_RESPONSES_ANALYTICS] ON [GUARDIAN].[NOTICE_RESPONSES] ([COMPANY_ID], [RESPONSE_DATE], [RESPONSE_TYPE]);

-- Add check constraints
ALTER TABLE [GUARDIAN].[NOTICE_RESPONSES] 
ADD CONSTRAINT [CHK_NOTICE_RESPONSES_TYPE] 
CHECK ([RESPONSE_TYPE] IN ('ACKNOWLEDGED', 'UNDERSTOOD', 'COMPLETED', 'REQUIRES_CLARIFICATION', 'CANNOT_COMPLY', 'NEEDS_EXTENSION', 'PARTIALLY_COMPLETED'));

ALTER TABLE [GUARDIAN].[NOTICE_RESPONSES] 
ADD CONSTRAINT [CHK_NOTICE_RESPONSES_STATUS] 
CHECK ([RESPONSE_STATUS] IN ('ACTIVE', 'WITHDRAWN', 'SUPERSEDED'));

ALTER TABLE [GUARDIAN].[NOTICE_RESPONSES] 
ADD CONSTRAINT [CHK_NOTICE_RESPONSES_FOLLOWUP_PRIORITY] 
CHECK ([FOLLOWUP_PRIORITY] IN ('HIGH', 'MEDIUM', 'LOW', NULL));

ALTER TABLE [GUARDIAN].[NOTICE_RESPONSES] 
ADD CONSTRAINT [CHK_NOTICE_RESPONSES_MESSAGE_LENGTH] 
CHECK (LEN([RESPONSE_MESSAGE]) <= 1000);

-- Add conditional constraints
ALTER TABLE [GUARDIAN].[NOTICE_RESPONSES] 
ADD CONSTRAINT [CHK_NOTICE_RESPONSES_FOLLOWUP_LOGIC] 
CHECK (
    ([REQUIRES_FOLLOWUP] = 0 AND [FOLLOWUP_PRIORITY] IS NULL AND [FOLLOWUP_ASSIGNED_TO] IS NULL) OR
    ([REQUIRES_FOLLOWUP] = 1 AND [FOLLOWUP_PRIORITY] IS NOT NULL)
);

-- Add column descriptions
EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'User responses and acknowledgments to notices with follow-up tracking',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Type of response: ACKNOWLEDGED, UNDERSTOOD, COMPLETED, REQUIRES_CLARIFICATION, CANNOT_COMPLY, NEEDS_EXTENSION, PARTIALLY_COMPLETED',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES',
    @level2type = N'COLUMN', @level2name = N'RESPONSE_TYPE';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Optional user message or comment with the response (max 1000 characters)',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES',
    @level2type = N'COLUMN', @level2name = N'RESPONSE_MESSAGE';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Whether this response requires management follow-up action',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES',
    @level2type = N'COLUMN', @level2name = N'REQUIRES_FOLLOWUP';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Priority level for follow-up if required: HIGH, MEDIUM, LOW',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES',
    @level2type = N'COLUMN', @level2name = N'FOLLOWUP_PRIORITY';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Manager or admin assigned to handle follow-up action',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES',
    @level2type = N'COLUMN', @level2name = N'FOLLOWUP_ASSIGNED_TO';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Whether response should be shown anonymously to notice issuer',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_RESPONSES',
    @level2type = N'COLUMN', @level2name = N'IS_ANONYMOUS';