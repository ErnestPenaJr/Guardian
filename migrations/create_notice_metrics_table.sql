-- Guardian MVP Notice Module - Analytics Enhancement
-- Date: 2024-08-19
-- Description: Creates NOTICE_METRICS table for tracking notice view time and engagement

-- Create NOTICE_METRICS table for analytics tracking
CREATE TABLE [GUARDIAN].[NOTICE_METRICS] (
    [NOTICE_METRIC_ID] int IDENTITY(1,1) NOT NULL,
    [NOTICE_ID] int NOT NULL,
    [USER_ID] int NOT NULL,
    [COMPANY_ID] int NOT NULL,
    [VIEW_START_TIME] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [VIEW_END_TIME] datetime2 NULL,
    [VIEW_DURATION_SECONDS] int NULL,
    [SCROLL_PERCENTAGE] decimal(5,2) NULL DEFAULT 0, -- How much of notice was scrolled (0-100%)
    [INTERACTION_COUNT] int NOT NULL DEFAULT 0, -- Number of clicks/interactions
    [DEVICE_TYPE] nvarchar(20) NULL, -- DESKTOP, MOBILE, TABLET
    [REFERRER_SOURCE] nvarchar(50) NULL, -- MY_NOTICES, ALL_NOTICES, DIRECT_LINK, EMAIL
    [IS_COMPLETED_VIEW] bit NOT NULL DEFAULT 0, -- Whether user viewed entire notice
    [CREATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),
    [UPDATE_DATE] datetime2 NOT NULL DEFAULT GETUTCDATE(),

    -- Primary key
    CONSTRAINT [PK_NOTICE_METRICS] PRIMARY KEY CLUSTERED ([NOTICE_METRIC_ID] ASC),

    -- Foreign key constraints
    CONSTRAINT [FK_NOTICE_METRICS_NOTICE] FOREIGN KEY ([NOTICE_ID]) 
        REFERENCES [GUARDIAN].[NOTICES] ([NOTICE_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_METRICS_USER] FOREIGN KEY ([USER_ID]) 
        REFERENCES [GUARDIAN].[USERS] ([USER_ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_NOTICE_METRICS_COMPANY] FOREIGN KEY ([COMPANY_ID]) 
        REFERENCES [GUARDIAN].[COMPANY] ([COMPANY_ID]) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX [IX_NOTICE_METRICS_NOTICE_ID] ON [GUARDIAN].[NOTICE_METRICS] ([NOTICE_ID]);
CREATE INDEX [IX_NOTICE_METRICS_USER_ID] ON [GUARDIAN].[NOTICE_METRICS] ([USER_ID]);
CREATE INDEX [IX_NOTICE_METRICS_COMPANY_ID] ON [GUARDIAN].[NOTICE_METRICS] ([COMPANY_ID]);
CREATE INDEX [IX_NOTICE_METRICS_VIEW_START_TIME] ON [GUARDIAN].[NOTICE_METRICS] ([VIEW_START_TIME]);
CREATE INDEX [IX_NOTICE_METRICS_COMPANY_NOTICE] ON [GUARDIAN].[NOTICE_METRICS] ([COMPANY_ID], [NOTICE_ID]);
CREATE INDEX [IX_NOTICE_METRICS_ANALYTICS] ON [GUARDIAN].[NOTICE_METRICS] ([COMPANY_ID], [VIEW_START_TIME], [IS_COMPLETED_VIEW]);

-- Add check constraints
ALTER TABLE [GUARDIAN].[NOTICE_METRICS] 
ADD CONSTRAINT [CHK_NOTICE_METRICS_SCROLL_PERCENTAGE] 
CHECK ([SCROLL_PERCENTAGE] >= 0 AND [SCROLL_PERCENTAGE] <= 100);

ALTER TABLE [GUARDIAN].[NOTICE_METRICS] 
ADD CONSTRAINT [CHK_NOTICE_METRICS_VIEW_DURATION] 
CHECK ([VIEW_DURATION_SECONDS] >= 0);

ALTER TABLE [GUARDIAN].[NOTICE_METRICS] 
ADD CONSTRAINT [CHK_NOTICE_METRICS_DEVICE_TYPE] 
CHECK ([DEVICE_TYPE] IN ('DESKTOP', 'MOBILE', 'TABLET', NULL));

ALTER TABLE [GUARDIAN].[NOTICE_METRICS] 
ADD CONSTRAINT [CHK_NOTICE_METRICS_REFERRER] 
CHECK ([REFERRER_SOURCE] IN ('MY_NOTICES', 'ALL_NOTICES', 'DIRECT_LINK', 'EMAIL', 'NOTIFICATION', NULL));

-- Add column descriptions
EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Analytics tracking for notice view engagement',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_METRICS';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Time when user started viewing the notice',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_METRICS',
    @level2type = N'COLUMN', @level2name = N'VIEW_START_TIME';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Time when user finished viewing the notice (closed/navigated away)',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_METRICS',
    @level2type = N'COLUMN', @level2name = N'VIEW_END_TIME';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Total time spent viewing notice in seconds',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_METRICS',
    @level2type = N'COLUMN', @level2name = N'VIEW_DURATION_SECONDS';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Percentage of notice content scrolled through (0-100)',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_METRICS',
    @level2type = N'COLUMN', @level2name = N'SCROLL_PERCENTAGE';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Whether user completed viewing entire notice content',
    @level0type = N'SCHEMA', @level0name = N'GUARDIAN',
    @level1type = N'TABLE', @level1name = N'NOTICE_METRICS',
    @level2type = N'COLUMN', @level2name = N'IS_COMPLETED_VIEW';