-- Guardian MVP Notice Module - Threading & Updates Enhancement
-- Date: 2024-08-19
-- Description: Creates NOTICE_UPDATES table for notice threading, updates, and user tagging

-- Create NOTICE_UPDATES table for threaded updates and discussions
CREATE TABLE [GUARDIAN].[NOTICE_UPDATES] (
    [NOTICE_UPDATE_ID] int IDENTITY(1,1) NOT NULL,
    [NOTICE_ID] int NOT NULL,
    [PARENT_UPDATE_ID] int NULL, -- For threading/reply functionality
    [THREAD_LEVEL] int NOT NULL DEFAULT 0, -- 0=main update, 1=first level reply, 2=second level, etc.
    [UPDATE_TYPE] nvarchar(20) NOT NULL DEFAULT 'UPDATE', -- UPDATE, CLARIFICATION, AMENDMENT, REPLY, ANNOUNCEMENT, REMINDER
    [UPDATE_TITLE] nvarchar(255) NULL, -- Optional title for major updates
    [UPDATE_CONTENT] nvarchar(4000) NOT NULL, -- Main update content
    [CONTENT_TYPE] nvarchar(15) NOT NULL DEFAULT 'TEXT', -- TEXT, MARKDOWN, HTML
    [AUTHOR_USER_ID] int NOT NULL,
    [COMPANY_ID] int NOT NULL,
    [UPDATE_STATUS] nvarchar(15) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, HIDDEN, DELETED
    [IS_PINNED] bit NOT NULL DEFAULT 0, -- Whether update is pinned to top
    [REQUIRES_ACKNOWLEDGMENT] bit NOT NULL DEFAULT 0, -- Whether users must acknowledge this update
    [PRIORITY_LEVEL] nvarchar(10) NOT NULL DEFAULT 'NORMAL', -- URGENT, HIGH, NORMAL, LOW
    [VISIBILITY_SCOPE] nvarchar(20) NOT NULL DEFAULT 'ALL_RECIPIENTS', -- ALL_RECIPIENTS, TAGGED_USERS, ADMIN_ONLY
    [TAGGED_USERS] nvarchar(1000) NULL, -- JSON array of user IDs who are tagged/mentioned
    [MENTIONED_USERS] nvarchar(1000) NULL, -- JSON array of user IDs mentioned with @username
    [UPDATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [EDIT_DATE] datetime2 NULL, -- When update was last edited
    [EDITED_BY_USER_ID] int NULL, -- Who made the last edit
    [EDIT_REASON] nvarchar(200) NULL, -- Reason for edit
    [NOTIFICATION_SENT] bit NOT NULL DEFAULT 0, -- Whether notifications were sent for this update
    [VIEW_COUNT] int NOT NULL DEFAULT 0, -- Number of times this update was viewed
    [REACTION_COUNT] int NOT NULL DEFAULT 0, -- Number of reactions/likes
    [REPLY_COUNT] int NOT NULL DEFAULT 0, -- Number of direct replies
    [CREATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [UPDATE_USER_ID] int NULL,

    -- Primary key
    CONSTRAINT [PK_NOTICE_UPDATES] PRIMARY KEY CLUSTERED ([NOTICE_UPDATE_ID] ASC),

    -- Foreign key constraints
    CONSTRAINT [FK_NOTICE_UPDATES_NOTICE] FOREIGN KEY ([NOTICE_ID]) 
        REFERENCES [GUARDIAN].[NOTICES] ([NOTICE_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_UPDATES_PARENT] FOREIGN KEY ([PARENT_UPDATE_ID]) 
        REFERENCES [GUARDIAN].[NOTICE_UPDATES] ([NOTICE_UPDATE_ID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_NOTICE_UPDATES_AUTHOR] FOREIGN KEY ([AUTHOR_USER_ID]) 
        REFERENCES [GUARDIAN].[USERS] ([USER_ID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_NOTICE_UPDATES_COMPANY] FOREIGN KEY ([COMPANY_ID]) 
        REFERENCES [GUARDIAN].[COMPANY] ([COMPANY_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_UPDATES_EDITOR] FOREIGN KEY ([EDITED_BY_USER_ID]) 
        REFERENCES [GUARDIAN].[USERS] ([USER_ID]) ON DELETE NO ACTION
);

-- Create NOTICE_UPDATE_ACKNOWLEDGMENTS table for tracking update acknowledgments
CREATE TABLE [GUARDIAN].[NOTICE_UPDATE_ACKNOWLEDGMENTS] (
    [ACKNOWLEDGMENT_ID] int IDENTITY(1,1) NOT NULL,
    [NOTICE_UPDATE_ID] int NOT NULL,
    [USER_ID] int NOT NULL,
    [COMPANY_ID] int NOT NULL,
    [ACKNOWLEDGED_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [ACKNOWLEDGMENT_TYPE] nvarchar(15) NOT NULL DEFAULT 'READ', -- read, understood, agreed, noted
    [CREATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),

    -- Primary key
    CONSTRAINT [PK_NOTICE_UPDATE_ACKNOWLEDGMENTS] PRIMARY KEY CLUSTERED ([ACKNOWLEDGMENT_ID] ASC),

    -- Foreign key constraints
    CONSTRAINT [FK_UPDATE_ACK_UPDATE] FOREIGN KEY ([NOTICE_UPDATE_ID]) 
        REFERENCES [GUARDIAN].[NOTICE_UPDATES] ([NOTICE_UPDATE_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_UPDATE_ACK_USER] FOREIGN KEY ([USER_ID]) 
        REFERENCES [GUARDIAN].[USERS] ([USER_ID]) ON DELETE NO ACTION,
    CONSTRAINT [FK_UPDATE_ACK_COMPANY] FOREIGN KEY ([COMPANY_ID]) 
        REFERENCES [GUARDIAN].[COMPANY] ([COMPANY_ID]) ON DELETE NO ACTION,

    -- Unique constraint to prevent duplicate acknowledgments
    CONSTRAINT [UQ_UPDATE_ACKNOWLEDGMENTS] UNIQUE ([NOTICE_UPDATE_ID], [USER_ID])
);

-- Create indexes for performance
CREATE INDEX [IX_NOTICE_UPDATES_NOTICE_ID] ON [GUARDIAN].[NOTICE_UPDATES] ([NOTICE_ID]);
CREATE INDEX [IX_NOTICE_UPDATES_PARENT_ID] ON [GUARDIAN].[NOTICE_UPDATES] ([PARENT_UPDATE_ID]);
CREATE INDEX [IX_NOTICE_UPDATES_AUTHOR] ON [GUARDIAN].[NOTICE_UPDATES] ([AUTHOR_USER_ID]);
CREATE INDEX [IX_NOTICE_UPDATES_COMPANY_ID] ON [GUARDIAN].[NOTICE_UPDATES] ([COMPANY_ID]);
CREATE INDEX [IX_NOTICE_UPDATES_DATE] ON [GUARDIAN].[NOTICE_UPDATES] ([UPDATE_DATE]);
CREATE INDEX [IX_NOTICE_UPDATES_STATUS_TYPE] ON [GUARDIAN].[NOTICE_UPDATES] ([UPDATE_STATUS], [UPDATE_TYPE]);
CREATE INDEX [IX_NOTICE_UPDATES_THREADING] ON [GUARDIAN].[NOTICE_UPDATES] ([NOTICE_ID], [PARENT_UPDATE_ID], [THREAD_LEVEL]);
CREATE INDEX [IX_NOTICE_UPDATES_PINNED] ON [GUARDIAN].[NOTICE_UPDATES] ([NOTICE_ID], [IS_PINNED], [UPDATE_DATE]);
CREATE INDEX [IX_UPDATE_ACK_UPDATE] ON [GUARDIAN].[NOTICE_UPDATE_ACKNOWLEDGMENTS] ([NOTICE_UPDATE_ID]);
CREATE INDEX [IX_UPDATE_ACK_USER] ON [GUARDIAN].[NOTICE_UPDATE_ACKNOWLEDGMENTS] ([USER_ID]);

-- Add check constraints
ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_TYPE] 
CHECK ([UPDATE_TYPE] IN ('UPDATE', 'CLARIFICATION', 'AMENDMENT', 'REPLY', 'ANNOUNCEMENT', 'REMINDER', 'QUESTION', 'ANSWER'));

ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_STATUS] 
CHECK ([UPDATE_STATUS] IN ('ACTIVE', 'HIDDEN', 'DELETED'));

ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_CONTENT_TYPE] 
CHECK ([CONTENT_TYPE] IN ('TEXT', 'MARKDOWN', 'HTML'));

ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_PRIORITY] 
CHECK ([PRIORITY_LEVEL] IN ('URGENT', 'HIGH', 'NORMAL', 'LOW'));

ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_VISIBILITY] 
CHECK ([VISIBILITY_SCOPE] IN ('ALL_RECIPIENTS', 'TAGGED_USERS', 'ADMIN_ONLY', 'SPECIFIC_USERS'));

ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_THREAD_LEVEL] 
CHECK ([THREAD_LEVEL] >= 0 AND [THREAD_LEVEL] <= 5); -- Limit threading depth

ALTER TABLE [GUARDIAN].[NOTICE_UPDATE_ACKNOWLEDGMENTS] 
ADD CONSTRAINT [CHK_UPDATE_ACK_TYPE] 
CHECK ([ACKNOWLEDGMENT_TYPE] IN ('read', 'understood', 'agreed', 'noted', 'dismissed'));

-- Add conditional constraints
ALTER TABLE [GUARDIAN].[NOTICE_UPDATES] 
ADD CONSTRAINT [CHK_NOTICE_UPDATES_THREAD_LOGIC] 
CHECK (
    ([THREAD_LEVEL] = 0 AND [PARENT_UPDATE_ID] IS NULL) OR
    ([THREAD_LEVEL] > 0 AND [PARENT_UPDATE_ID] IS NOT NULL)
);

-- Add column descriptions
EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Threaded updates, clarifications, and discussions for notices',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Parent update ID for threading (NULL for top-level updates)',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'PARENT_UPDATE_ID';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Threading depth level (0=main, 1=reply, 2=reply to reply, etc.)',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'THREAD_LEVEL';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Type of update: UPDATE, CLARIFICATION, AMENDMENT, REPLY, ANNOUNCEMENT, REMINDER, QUESTION, ANSWER',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'UPDATE_TYPE';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'JSON array of user IDs who are specifically tagged in this update',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'TAGGED_USERS';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'JSON array of user IDs mentioned with @username syntax',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'MENTIONED_USERS';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Whether this update is pinned to the top of the notice thread',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'IS_PINNED';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Whether users must acknowledge reading this update',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATES',
    @level2type = N'COLUMN', @level2name = N'REQUIRES_ACKNOWLEDGMENT';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'User acknowledgments and read receipts for notice updates',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_UPDATE_ACKNOWLEDGMENTS';